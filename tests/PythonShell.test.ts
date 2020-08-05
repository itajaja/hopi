import { Deserializer, PythonShell } from '../src';
import { PYTHON_PATH } from './config';

let shell: PythonShell;

beforeEach(() => {
  shell = new PythonShell({ pythonPath: PYTHON_PATH });
});

afterEach(() => {
  return shell.kill();
});

test('deserializers', async () => {
  await shell.sendAndReceive('EXEC', 'import json');

  const listDeserializer = new Deserializer({
    typeName: 'builtins.list',
    deserialize: JSON.parse,
    serialize: 'json.dumps',
  });
  const tupleDeserializer = new Deserializer({
    typeName: 'builtins.tuple',
    deserialize: (s) => s.toUpperCase(),
    serialize: 'lambda v: f"a tuple of {len(v)} elements"',
  });

  await Promise.all([
    shell.addDeserializer(listDeserializer),
    shell.addDeserializer(tupleDeserializer),
  ]);

  const listResult = await shell.sendAndReceive('EVAL', "[1, 2, '3']");
  expect(listResult).toEqual([1, 2, '3']);
  const tupleResult = await shell.sendAndReceive('EVAL', "(1, 2, '3')");
  expect(tupleResult).toEqual('A TUPLE OF 3 ELEMENTS');

  await expect(shell.sendAndReceive('EVAL', '{}')).rejects.toThrow(
    "Exception('builtins.dict not serializable')",
  );
});

test('builtin deserializers', async () => {
  await shell.addBuiltinDeserializers();
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

test('sendAndReceive', async () => {
  await shell.addBuiltinDeserializers();
  await shell.sendAndReceive('EXEC', 'a = 0');

  const promises: Promise<any>[] = [];
  for (let i = 0; i < 10000; i++) {
    promises.push(shell.sendAndReceive('EXEC', 'a = a+1'));
  }

  await Promise.all(promises);

  const result = await shell.sendAndReceive('EVAL', 'a');
  expect(result).toEqual(10000);
});
