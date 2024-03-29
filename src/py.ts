/* eslint-disable max-classes-per-file */
/* eslint-disable @typescript-eslint/no-use-before-define */
import PythonShell, { PythonShellConfig } from './PythonShell';

export interface PyBase {
  x: (strings: readonly string[], ...vars: PyVar[]) => Promise<void>;
  e: (strings: readonly string[], ...vars: PyVar[]) => Promise<any>;
  import: (name: string) => Promise<PyVar>;
  shell: PythonShell;
}

export interface PythonEnv extends PyBase {
  (strings: readonly string[], ...vars: TemplateValue[]): PyVar;
}

type TemplateValue =
  | PyVariable
  | string
  | number
  | boolean
  | null
  | TemplateValue[]
  | { [idx: string]: TemplateValue };

function isPyVariable(v: TemplateValue): v is PyVariable {
  return !!v && typeof (v as any).varId === 'string';
}
function isTemplateStrings(v: any): v is TemplateStringsArray {
  return v instanceof Array && (v as any).raw;
}

function resolveTemplateValue(v: TemplateValue): string {
  if (v === null) return 'None';
  if (typeof v === 'string') return `"${v.replace('/"/g', '\\"')}"`;
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? 'True' : 'False';
  if (v instanceof Array) return `[${v.map(resolveTemplateValue).join(',')}]`;
  if (isPyVariable(v)) return v.varId;

  // then it's a dict
  const params = Object.entries(v).map(
    ([k, vv]) => `${resolveTemplateValue(k)}: ${resolveTemplateValue(vv)}`,
  );
  return `{${params.join(',')}}`;
}

function buildCommand(strings: readonly string[], vars: TemplateValue[]) {
  const cmd = strings.map(
    (s, i) => `${s}${i in vars ? resolveTemplateValue(vars[i]) : ''}`,
  );
  return cmd.join('');
}

export class Py implements PyBase {
  shell: PythonShell;

  varCounter = 0;

  constructor(init: string | PythonShellConfig) {
    const config = typeof init === 'string' ? { pythonPath: init } : init;
    this.shell = new PythonShell(config);
  }

  *getAllVars(vars: TemplateValue[]): Generator<PyVariable> {
    for (const v of vars) {
      if (isPyVariable(v)) yield v;
      else if (Array.isArray(v)) {
        for (const vv of this.getAllVars(v)) yield vv;
      } else if (v instanceof Object) {
        for (const vv of this.getAllVars(Object.values(v))) yield vv;
      }
    }
  }

  getCommandObject(strings: readonly string[], vars: TemplateValue[]) {
    const pyVars = Array.from(this.getAllVars(vars));

    return {
      cmd: buildCommand(strings, vars),
      pyVars,
      resolve: () => Promise.all(pyVars.map((v) => v.resolver)),
    };
  }

  x = async (strings: readonly string[], ...vars: PyVar[]) => {
    const { cmd, resolve } = this.getCommandObject(strings, vars);
    await resolve();
    await this.shell.sendAndReceive('EXEC', cmd);
  };

  e = async (strings: readonly string[], ...vars: TemplateValue[]) => {
    const { cmd, resolve } = this.getCommandObject(strings, vars);
    await resolve();
    return this.shell.sendAndReceive('EVAL', cmd);
  };

  import = async (name: string) => {
    await this.x([`import ${name}`]);
    return this.expr([name]);
  };

  expr = (strings: readonly string[], ...vars: TemplateValue[]): PyVar => {
    const { cmd, resolve } = this.getCommandObject(strings, vars);
    const varId = `v${this.varCounter++}`;

    const resolver = resolve().then(async () => {
      await this.shell.sendAndReceive('EXEC', `${varId}=${cmd}`);
    });
    return getPyVar(this, varId, resolver);
  };
}

export class PyVariable {
  constructor(
    private py: Py,
    public varId: string,
    public resolver: Promise<void>,
  ) {}

  get _() {
    return this.resolver.then(() => this.py.e`${this}`);
  }
}

export class Kwargs {
  // eslint-disable-next-line no-shadow
  constructor(public kwargs: Dict<TemplateValue>) {}
}
export function kwargs(k: Dict<TemplateValue>) {
  return new Kwargs(k);
}

export type PyArgs = TemplateValue | Kwargs;

export interface PyVarDict {
  [idx: string]: PyVar;
}
export type PyVar = PyVarDict &
  PyVariable &
  ((...a: PyArgs[]) => PyVar) &
  ((strings: readonly string[], ...vars: PyVar[]) => PyVar);

function getPyVar(py: Py, varId: string, resolver: Promise<void>): PyVar {
  const pyVar = new PyVariable(py, varId, resolver);

  return new Proxy(() => null, {
    get: (_: unknown, key: string): PyVar => {
      if (key === 'then') {
        return undefined as any;
      }
      if (key in pyVar) return (pyVar as any)[key];

      if (!Number.isNaN(Number(key))) {
        return py.expr(['', `[${Number(key)}]`], pyVar);
      }
      if (!/^[a-zA-Z_][\w]*$/.test(key)) {
        return py.expr(['', `[${resolveTemplateValue(key)}]`], pyVar);
      }
      return py.expr(['', `.${key}`], pyVar);
    },
    apply: (
      _target,
      _thisArg,
      allArgs: PyArgs[] | [TemplateStringsArray, ...PyVar[]],
    ): PyVar => {
      if (isTemplateStrings(allArgs[0])) {
        const [strings, ...templateVars] = allArgs as [
          TemplateStringsArray,
          ...PyVar[]
        ];
        return py.expr(['', ...strings], ...[pyVar, ...templateVars]);
      }

      const pyArgs = allArgs as PyArgs[];

      const strings: string[] = ['', '('];
      const vars: TemplateValue[] = [pyVar];
      pyArgs.forEach((a, i) => {
        const isLast = i + 1 === pyArgs.length;
        if (!isLast) {
          if (a instanceof Kwargs) {
            throw new Error('kwargs need to be last');
          }
          vars.push(a);
          strings.push(',');
        }
        if (isLast) {
          if (a instanceof Kwargs) {
            strings.pop(); // remove last string
            Object.entries(a.kwargs).forEach(([k, v], ki) => {
              const isFirstKwarg = ki === 0;
              if (isFirstKwarg && pyArgs.length < 2) {
                strings.push(`(${k}=`);
              } else {
                strings.push(`,${k}=`);
              }
              vars.push(v);
            });
          } else {
            vars.push(a);
          }
        }
      });
      strings.push(')');
      return py.expr(strings, ...vars);
    },
  }) as any;
}

export function createPythonEnv(
  pythonPath: string | PythonShellConfig,
): PythonEnv {
  const pyObj = new Py(pythonPath);

  const py = pyObj.expr;

  return Object.assign(py, pyObj);
}
