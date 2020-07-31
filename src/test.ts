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

    const s = py`${pandas}.Series(range(0, random.randint(0, 100)))`;

    const max = py`int(${s}.max())`;
    const avg = py`int(${s}.mean())`;
    console.log('MAX:', await max, await avg);
  } catch (e) {
    console.log('received an error:', e.message);
  } finally {
    py.shell.kill();
  }
}

run();
