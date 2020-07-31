/* eslint-disable max-classes-per-file */
/* eslint-disable @typescript-eslint/no-use-before-define */
import PythonShell from './PythonShell';

interface PyBase {
  x: (strings: readonly string[], ...vars: PyVar[]) => Promise<void>;
  e: (strings: readonly string[], ...vars: PyVar[]) => Promise<string>;
  shell: PythonShell;
}

interface PythonEnv extends PyBase {
  (strings: readonly string[], ...vars: PyVar[]): PyVar;
}

type TemplateValue = PyVariable | string | number | symbol | undefined;

function isPyVar(v: TemplateValue): v is PyVar {
  return typeof v === 'object' || typeof v === 'function';
}

function resolveTemplateValue(v: TemplateValue) {
  if (v === undefined) return '';
  if (typeof v === 'string' || typeof v === 'number') return v;
  if (typeof v === 'symbol') return v.description;
  return v.varId;
}

function buildCommand(strings: readonly string[], vars: TemplateValue[]) {
  const cmd = strings.map((s, i) => `${s}${resolveTemplateValue(vars[i])}`);
  return cmd.join('');
}

export class Py implements PyBase {
  shell: PythonShell;

  varCounter = 0;

  constructor(pythonPath: string) {
    this.shell = new PythonShell(pythonPath);
  }

  x = async (strings: readonly string[], ...vars: PyVar[]) => {
    const cmd = buildCommand(strings, vars);
    await this.shell.sendAndReceive('EXEC', cmd);
  };

  e = (strings: readonly string[], ...vars: TemplateValue[]) => {
    const cmd = buildCommand(strings, vars);
    return this.shell.sendAndReceive('EVAL', cmd);
  };

  expr = (strings: readonly string[], ...vars: TemplateValue[]): PyVar => {
    const cmd = buildCommand(strings, vars);
    const varId = `v${this.varCounter++}`;
    const pyVars = vars.filter(isPyVar);

    const resolver = Promise.all(pyVars.map((v) => v.resolver)).then(
      async () => {
        await this.shell.sendAndReceive('EXEC', `${varId}=${cmd}`);
      },
    );
    return getPyVar(this, varId, resolver);
  };
}

class PyVariable implements PromiseLike<any> {
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

type PyArgs = TemplateValue;

interface PyVarDict {
  [idx: string]: PyVar;
}
type PyVar = PyVarDict & PyVariable & ((...a: PyArgs[]) => PyVar);

function getPyVar(py: Py, varId: string, resolver: Promise<void>): PyVar {
  const pyVar = new PyVariable(py, varId, resolver);

  return new Proxy(() => null, {
    get: (_: unknown, key: PropertyKey): PyVar => {
      if (key in pyVar) return (pyVar as any)[key];
      if (typeof key !== 'string') throw new Error('only strings supported');

      return py.expr`${pyVar}.${key}`;
    },
    apply: (_target, _thisArg, allArgs: PyArgs[]): PyVar => {
      const strings: string[] = ['', '('];
      const vars: TemplateValue[] = [pyVar];
      allArgs.forEach((a, i) => {
        const isLast = i + 1 === allArgs.length;
        vars.push(a);
        if (!isLast) {
          strings.push(',');
        }
      });
      strings.push(')');
      return py.expr(strings, ...vars);
    },
  }) as any;
}

export function createPythonEnv(pythonPath: string): PythonEnv {
  const pyObj = new Py(pythonPath);

  const py = pyObj.expr;

  return Object.assign(py, pyObj);
}
