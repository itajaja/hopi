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
        serialize: 'lambda v: str(float(v))',
        deserialize: (s) => Number(s),
      }),
    );

    const pandas = await py.import('pandas');
    const int = py`int`;
    const range = py`range`;

    const s = pandas.Series(
      range(0, 55),
      kwargs({ name: 'foo', dtype: py`float` }),
    );

    const max = int(s.max());
    const avg = int(s.mean());
    const avg2 = s`[:5]`.mean();
    console.log('result:', await max.v, await avg.v, await avg2.v);
  } catch (e) {
    console.log('received an error:', e);
  } finally {
    py.shell.kill();
  }
}

run();
