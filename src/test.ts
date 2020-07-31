/* eslint-disable no-console */
import { createPythonEnv } from './py';

const py = createPythonEnv(
  '/Users/gtagliabue/workspace/jupyter-playground/.venv/bin/python',
);

async function run() {
  await py.x`import pandas`;

  const pandas = py`pandas`;
  const s = py`${pandas}.Series(range(0, 5000))`;

  console.log('MAX:', await py`${s}.max()`);

  py.shell.kill();
}

run();
