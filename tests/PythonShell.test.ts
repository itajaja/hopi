import { PythonShell } from '../src';
import { PYTHON_PATH } from './config';

let shell: PythonShell;

beforeEach(() => {
  shell = new PythonShell({ pythonPath: PYTHON_PATH });
});

afterEach(() => {
  return shell.kill();
});

test('sendAndReceive', async () => {
  await shell.sendAndReceive('EXEC', 'a = 0');

  const promises: Promise<any>[] = [];
  for (let i = 0; i < 10000; i++) {
    promises.push(shell.sendAndReceive('EXEC', 'a = a+1'));
  }

  await Promise.all(promises);

  const result = await shell.sendAndReceive('EVAL', 'a');
  expect(result).toEqual(10000);
});

test('default decoders', async () => {
  const listResult = await shell.sendAndReceive('EVAL', "[1, 2, '3']");
  expect(listResult).toEqual([1, 2, '3']);
  const tupleResult = await shell.sendAndReceive('EVAL', "(1, 2, '3')");
  expect(tupleResult).toEqual([1, 2, '3']);
  const dictResult = await shell.sendAndReceive('EVAL', '{1: 2}');
  expect(dictResult).toEqual({ 1: 2 });

  await expect(shell.sendAndReceive('EVAL', 'set()')).rejects.toThrow(
    "TypeError('Object of type set is not JSON serializable')",
  );

  const int = await shell.sendAndReceive('EVAL', '1');
  const float = await shell.sendAndReceive('EVAL', '1.1');
  const str = await shell.sendAndReceive('EVAL', '"foo"');
  const none = await shell.sendAndReceive('EVAL', 'None');
  const boolTrue = await shell.sendAndReceive('EVAL', 'True');
  const boolFalse = await shell.sendAndReceive('EVAL', 'False');

  expect(int).toEqual(1);
  expect(float).toEqual(1.1);
  expect(str).toEqual('foo');
  expect(none).toEqual(null);
  expect(boolTrue).toEqual(true);
  expect(boolFalse).toEqual(false);
});

test('custom decoders', async () => {
  await shell.addDecoder({
    typeName: 'pandas.core.series.Series',
    encode: 'lambda v: v.values',
    decode: (v, decode) => decode(v),
  });
  await shell.addDecoder({
    typeName: 'numpy.ndarray',
    encode: 'list',
    decode: (v, decode) => decode(v),
  });
  await shell.addDecoder({
    typeName: 'pandas._libs.tslibs.timestamps.Timestamp',
    encode: 'lambda v: v.isoformat()',
    decode: (s: string) => new Date(s).toDateString(),
  });

  await shell.sendAndReceive('EXEC', 'import pandas as pd');
  const ret = await shell.sendAndReceive(
    'EVAL',
    'pd.Series(["a", 1, pd.Timestamp("2020-01-01")])',
  );
  expect(ret).toMatchInlineSnapshot(`
    Array [
      "a",
      1,
      "Wed Jan 01 2020",
    ]
  `);
});
