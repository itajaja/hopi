/* eslint-disable no-console */
import Deserializer from './Serializer';
import { createPythonEnv, kwargs } from './py';

const py = createPythonEnv(
  '/Users/gtagliabue/workspace/jupyter-playground/.venv/bin/python',
);

async function run() {
  try {
    await py.shell.addBuiltinSerializers();
    py.shell.addSerializer(
      new Deserializer({
        typeName: 'numpy.float64',
        serialize: 'lambda v: str(v)',
        deserialize: (s) => Number(s),
      }),
    );
    py.shell.addSerializer(
      new Deserializer({
        typeName: 'numpy.int64',
        serialize: 'lambda v: str(v)',
        deserialize: (s) => Number(s),
      }),
    );

    const pandas = await py.import('pandas');
    const int = py`int`;

    const s = pandas.Series([1, 2, 3], kwargs({ dtype: py`float` }));

    const max = int(s.max());
    const avg = int(s.mean());
    const avg2 = s`[:5]`.mean();
    console.log(await max.v, await avg.v, await avg2.v);

    const df = pandas.DataFrame([
      { a: 1, b: 2 },
      { a: 3, b: 4 },
    ]);
    const x = df.iloc`[-1]`.b;
    const p75 = df.describe().a`['75%']`;
    console.log(await x.v, await p75.v);
  } catch (e) {
    console.log('received an error:', e);
  } finally {
    py.shell.kill();
  }
}

run();
