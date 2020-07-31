/* eslint-disable no-console */
import { spawn } from 'child_process';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const PYTHON_SCRIPT = `
import sys, json

for line in sys.stdin:
  l = line[:-1]
  sys.stderr.write(f'{l}')

  cmd = line[:4]
  data = line[4:]
  if cmd == 'EVAL':
    print(eval(data))
  elif cmd == 'EXEC':
    exec(data)
    print('.')
`;

export default class PythonShell {
  private messages: string[] = [];

  proc: ReturnType<typeof spawn>;

  constructor(public pythonPath: string) {
    this.proc = spawn(pythonPath, ['-u', '-c', PYTHON_SCRIPT]);

    this.proc.stderr!.on('data', (d) => {
      console.warn(`STDERR: ${d}`);
    });
    this.proc.on('close', (code) => {
      console.warn(`python process exited with code ${code}`);
    });

    this.proc.stdout!.on('data', (c) => {
      this.messages.push(...c.toString().split('\n').filter(Boolean));
    });
  }

  async receive() {
    while (!this.messages.length) {
      // eslint-disable-next-line no-await-in-loop
      await sleep(1);
    }
    return this.messages.splice(0, 1)[0];
  }

  send(msg: string) {
    this.proc.stdin!.write(`${msg}\n`);
  }

  async sendAndReceive(msg: string) {
    this.send(msg);
    const response = await this.receive();
    return response;
  }

  kill() {
    this.proc.kill();
  }
}
