/* eslint-disable no-console */
import { createPythonEnv, kwargs } from './py';

const py = createPythonEnv(
  '/Users/gtagliabue/workspace/jupyter-playground/.venv/bin/python',
);

async function run() {
  try {
    const pandas = await py.import('pandas');
    const int = py`int`;
    const range = py`range`;

    const s = pandas.Series(
      range(0, 55),
      kwargs({ name: 'foo', dtype: py`float` }),
    );

    const max = int(s.max());
    const avg = int(s.mean());
    const avg2 = int(s`[:5]`.mean());
    console.log('result:', await max.v, await avg.v, await avg2.v);
  } catch (e) {
    console.log('received an error:', e.message);
  } finally {
    py.shell.kill();
  }
}

run();
