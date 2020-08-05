/* eslint-disable no-console */
import { spawn } from 'child_process';

import Deserializer, { builtinDeserializers } from './serializers';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function getPythonScript(debug: boolean) {
  return `
import sys

serializers = {}

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
            result_type = type(result)
            result_type = f"{result_type.__module__}.{result_type.__name__}"
            if result_type in serializers:
                result = serializers[result_type](result)
            else:
                raise Exception(f"{result_type} not serializable")

        elif cmd == "EXEC":
            exec(data)
            result = ""
            result_type = "str"
    except BaseException as e:
        result = e.__repr__()
        status = "FAIL"
        result_type = "str"

    print(f"{msg_id}={status}={result_type}=" + result)
`;
}

interface Message {
  status: 'PASS' | 'FAIL';
  data: string;
  typeName: string;
}

export interface PythonShellConfig {
  pythonPath: string;
  debug?: boolean;
}

export default class PythonShell {
  private messages = new Map<string, Message>();

  private msgCounter = 0;

  proc: ReturnType<typeof spawn>;

  deserializers: Dict<Deserializer<any>['config']['deserialize']> = {
    str: (v) => v,
  };

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
    const i3 = msg.indexOf('=', i2 + 1);

    const msgId = msg.substring(0, i1);
    const status = msg.substring(i1 + 1, i2) as Message['status'];
    const typeName = msg.substring(i2 + 1, i3);
    const data = msg.substring(i3 + 1);

    this.messages.set(msgId, { status, data, typeName });
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
    const { data, status, typeName } = await this.receive(msgId);
    if (status === 'FAIL') {
      throw new Error(data);
    }
    return this.deserializers[typeName](data);
  }

  async addDeserializer({ config }: Deserializer<any>) {
    await this.sendAndReceive(
      'EXEC',
      `serializers["${config.typeName}"] = ${config.serialize}`,
    );

    this.deserializers[config.typeName] = config.deserialize;
  }

  addBuiltinDeserializers() {
    return Promise.all(
      builtinDeserializers.map((s) => this.addDeserializer(s)),
    );
  }

  kill() {
    this.proc.kill();
  }
}
