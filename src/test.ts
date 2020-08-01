/* eslint-disable no-console */
import { createPythonEnv } from './py';

const py = createPythonEnv(
  '/Users/gtagliabue/workspace/jupyter-playground/.venv/bin/python',
);

async function run() {
  try {
    await py.x`import pandas`;
    await py.x`import random`;
    const pandas = py`pandas`;
    const int = py`int`;
    const range = py`range`;

    const s = pandas.Series(range(0, 55));

    const max = int(s.max());
    const avg = int(s.mean());
    const avg2 = int(s`[:5]`.mean());
    console.log('result:', await max, await avg, await avg2);
  } catch (e) {
    console.log('received an error:', e.message);
  } finally {
    py.shell.kill();
  }
}

run();
