/* eslint-disable max-classes-per-file */
/* eslint-disable @typescript-eslint/no-use-before-define */
import PythonShell from './PythonShell';

interface PyBase {
  x: (strings: TemplateStringsArray, ...vars: PyVar[]) => Promise<void>;
  e: (strings: TemplateStringsArray, ...vars: PyVar[]) => Promise<string>;
  shell: PythonShell;
}

interface PythonEnv extends PyBase {
  (strings: TemplateStringsArray, ...vars: PyVar[]): PyVar;
}

function resolveVar(v: PyVar | string | number | symbol | undefined) {
  if (v === undefined) return '';
  if (typeof v === 'string' || typeof v === 'number') return v;
  if (typeof v === 'symbol') return v.description;
  return v.varId;
}

function buildCommand(strings: TemplateStringsArray, vars: PyVar[]) {
  const cmd = strings.map((s, i) => `${s}${resolveVar(vars[i])}`);
  return cmd.join('');
}

export class Py implements PyBase {
  shell: PythonShell;

  varCounter = 0;

  constructor(pythonPath: string) {
    this.shell = new PythonShell(pythonPath);
  }

  x = async (strings: TemplateStringsArray, ...vars: PyVar[]) => {
    const cmd = buildCommand(strings, vars);
    await this.shell.sendAndReceive('EXEC', cmd);
  };

  e = (strings: TemplateStringsArray, ...vars: PyVar[]) => {
    const cmd = buildCommand(strings, vars);
    return this.shell.sendAndReceive('EVAL', cmd);
  };

  expr = (strings: TemplateStringsArray, ...vars: PyVar[]): PyVar => {
    const cmd = strings.map((s, i) => `${s}${resolveVar(vars[i])}`);
    const varId = `v${this.varCounter++}`;

    const resolver = Promise.all(vars.map((v) => v.resolver)).then(() => {
      this.shell.sendAndReceive('EXEC', `${varId}=${cmd.join('')}`);
    });

    return new PyVar(this, varId, resolver);
  };
}

class PyVar implements PromiseLike<any> {
  constructor(
    private py: Py,
    public varId: string,
    public resolver: Promise<void>,
  ) {}

  then<TResult1 = any, TResult2 = never>(
    onfulfilled?:
      | ((value: any) => TResult1 | PromiseLike<TResult1>)
      | null
      | undefined,
    onrejected?:
      | ((reason: any) => TResult2 | PromiseLike<TResult2>)
      | null
      | undefined,
  ): PromiseLike<TResult1 | TResult2> {
    return this.resolver
      .then(() => this.py.e`${this}`)
      .then(onfulfilled, onrejected);
  }
}

export function createPythonEnv(pythonPath: string): PythonEnv {
  const pyObj = new Py(pythonPath);

  const py = pyObj.expr;

  return Object.assign(py, pyObj);
}
