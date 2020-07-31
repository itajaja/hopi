/* eslint-disable no-console */
import { spawn } from 'child_process';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const PYTHON_SCRIPT = `
import sys, json

for line in sys.stdin:
  l = line[:-1]
  # sys.stderr.write(f'{l}')  # uncomment for debugging

  i1 = line.index('=')
  i2 = line.index('=', i1+1)

  msg_id = line[:i1]
  cmd = line[i1+1:i2]
  data = line[i2+1:]

  serializable_types = {float, int}

  status = "PASS"
  try:
    if cmd == 'EVAL':
      result = eval(data)
      result_type = type(result)
      if result_type == str:
        pass
      elif result_type in serializable_types:
        result = str(result)
      else:
        result = f'{result_type} not serializable'

    elif cmd == 'EXEC':
      exec(data)
      result = ''
  except BaseException as e:
    result = str(e)
    status = "FAIL"

  print(f"{msg_id}={status}=" + result)
`;

interface Message {
  status: 'PASS' | 'FAIL';
  data: string;
}

export default class PythonShell {
  private messages = new Map<string, Message>();

  private msgCounter = 0;

  proc: ReturnType<typeof spawn>;

  constructor(public pythonPath: string) {
    this.proc = spawn(pythonPath, ['-u', '-c', PYTHON_SCRIPT]);

    this.proc.stderr!.on('data', (d) => {
      console.warn(`STDERR: ${d}`);
    });
    this.proc.on('close', (code) => {
      console.warn(`python process exited with code ${code}`);
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
    return data;
  }

  kill() {
    this.proc.kill();
  }
}
