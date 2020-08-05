/* eslint-disable no-console */
import { spawn } from 'child_process';

import { Decoder, TypeDecoder } from './Decoder';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function getPythonScript(debug: boolean) {
  return `
import sys
import json

encoders = {}

class Encoder(json.JSONEncoder):
  def default(self, o):
      o_type = type(o)
      typename = f"{o_type.__module__}.{o_type.__name__}"
      if typename in encoders:
          return {
              "%%hopi_v%%": encoders[typename](o),
              "%%hopi_t%%": typename,
          }

      return super().default(o)



for line in sys.stdin:
  l = line[:-1]
  ${debug ? 'sys.stderr.write(l)' : ''}
  i1 = line.index("=")
  i2 = line.index("=", i1 + 1)

  msg_id = line[:i1]
  cmd = line[i1 + 1 : i2]
  data = line[i2 + 1 :]

  status = "PASS"
  try:
      if cmd == "EVAL":
          result = eval(data)
          result = json.dumps(result, cls=Encoder)

      elif cmd == "EXEC":
          exec(data)
          result = 0
  except BaseException as e:
      result = e.__repr__()
      status = "FAIL"

  print(f"{msg_id}={status}={result}")
`;
}

interface Message {
  status: 'PASS' | 'FAIL';
  data: string;
}

export interface PythonShellConfig {
  pythonPath: string;
  debug?: boolean;
}

export default class PythonShell {
  private messages = new Map<string, Message>();

  private msgCounter = 0;

  proc: ReturnType<typeof spawn>;

  decoder = new Decoder();

  constructor({ pythonPath, debug = false }: PythonShellConfig) {
    const pythonScript = getPythonScript(debug);
    this.proc = spawn(pythonPath, ['-u', '-c', pythonScript]);

    this.proc.stderr!.on('data', (d) => {
      console.warn(`STDERR: ${d}`);
    });

    this.proc.stdout!.on('data', (c: string) => {
      c.toString().split('\n').filter(Boolean).forEach(this.onResponse);
    });
  }

  onResponse = (msg: string) => {
    const i1 = msg.indexOf('=');
    const i2 = msg.indexOf('=', i1 + 1);

    const msgId = msg.substring(0, i1);
    const status = msg.substring(i1 + 1, i2) as Message['status'];
    const data = msg.substring(i2 + 1);

    this.messages.set(msgId, { status, data });
  };

  async receive(msgId: string) {
    while (!this.messages.has(msgId)) {
      // eslint-disable-next-line no-await-in-loop
      await sleep(1);
    }

    const msg = this.messages.get(msgId)!;
    this.messages.delete(msgId);
    return msg;
  }

  send(cmd: 'EVAL' | 'EXEC', msg: string) {
    const msgId = this.msgCounter++;
    this.proc.stdin!.write(`${msgId}=${cmd}=${msg}\n`);
    return msgId.toString();
  }

  async sendAndReceive(cmd: 'EVAL' | 'EXEC', msg: string) {
    const msgId = this.send(cmd, msg);
    const { data, status } = await this.receive(msgId);
    if (status === 'FAIL') {
      throw new Error(data);
    }

    return this.decoder.parseJson(data);
  }

  async addDecoder(typeDecoder: TypeDecoder) {
    this.decoder.add(typeDecoder);
    await this.sendAndReceive(
      'EXEC',
      `encoders["${typeDecoder.typeName}"] = ${typeDecoder.encode}`,
    );
  }

  kill() {
    this.proc.kill();
  }
}
