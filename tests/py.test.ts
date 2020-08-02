import { createPythonEnv } from '../src';

const py = createPythonEnv('python');

beforeAll(() => {
  return py.shell.addBuiltinSerializers();
});

afterAll(() => {
  return py.shell.kill();
});

test('simple test', async () => {
  const list = py`list`;
  const max = py`max`;
  const l = list([1, 2, 3, 4, 5]);

  const maxValue = await max(l).v;
  const minValue = await py`min`(l).v;

  expect(maxValue).toEqual(5);
  expect(minValue).toEqual(1);
});
