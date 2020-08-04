import { Deserializer, createPythonEnv } from '../src';
import { PyVar, PythonEnv, kwargs } from '../src/py';
import { PYTHON_PATH } from './config';

let py: PythonEnv;

beforeEach(() => {
  py = createPythonEnv(PYTHON_PATH);
  return py.shell.addBuiltinDeserializers();
});

afterEach(() => {
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

test('import', async () => {
  const json = await py.import('json');
  expect(await json.dumps({ 1: 2 }).v).toEqual('{"1": 2}');
});

test('getters', async () => {
  await py.import('json');
  const list = py`list`;
  const dict = py`dict`;
  await py.shell.addDeserializer(
    new Deserializer({
      typeName: 'builtins.list',
      deserialize: JSON.parse,
      serialize: 'json.dumps',
    }),
  );

  const myList = list([1, 2, 3, 4, 5, 6]);
  const myDict = dict({ '10': 42 });

  expect(await myList[0].v).toEqual(1);
  expect(await myList[-2].v).toEqual(5);

  // these are slightly exotic behaviors, we might revisit at a later time

  await expect(myList['0:3'].v).rejects.toThrow(
    "TypeError('list indices must be integers or slices, not str')",
  );
  expect(await myList`[0:3]`.v).toEqual([1, 2, 3]);

  // unfortunately Proxy getters sees all keys as strings
  await expect(myDict[10].v).rejects.toThrow('KeyError(10)');
  await expect(myDict['10'].v).rejects.toThrow('KeyError(10)');
  expect(await myDict`['10']`.v).toEqual(42);
  // eslint-disable-next-line no-underscore-dangle
  expect(await myDict.get.__name__[1].v).toEqual('e');
});

test('templated variables', async () => {
  const one = py`1`;
  const two = py`2`;
  const myList = py`[${one}, ${two}]`;
  expect(await py`${one} + ${two}`.v).toEqual(3);
  expect(await py`"{}-{}".format(*${myList})`.v).toEqual('1-2');
  await py.import('json');

  expect(
    await py`json.dumps([${[1]}, ${{}}, ${true}, ${1.1}, ${null}, ${'abc'}])`
      .v,
  ).toMatchInlineSnapshot(`"[[1], {}, true, 1.1, null, \\"abc\\"]"`);
});

test('functions', async () => {
  await py.x`def foo(a, b, c): return a + b + c`;
  const foo = py`foo`;

  expect(await foo(1, 2, 3).v).toEqual(6);
  expect(await foo(1, kwargs({ c: 2, b: 3 })).v).toEqual(6);
  expect(() => foo(kwargs({ a: 1 }), kwargs({ c: 2, b: 3 }))).toThrow(
    'kwargs need to be last',
  );
});

test('full test', async () => {
  const pd = await py.import('pandas');
  const np = await py.import('numpy');
  await py.import('json');
  await py.shell.addDeserializer(
    new Deserializer({
      typeName: 'builtins.list',
      deserialize: JSON.parse,
      serialize: 'json.dumps',
    }),
  );
  await py.shell.addDeserializer(
    new Deserializer({
      typeName: 'pandas.core.series.Series',
      deserialize: JSON.parse,
      serialize: 'lambda v: json.dumps(list(v.values))',
    }),
  );

  const df = pd.DataFrame({
    a: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    b: [1, 3, 5, 7, 9, 10, 8, 6, 4, 2],
  });
  await py.x`${df}['c'] = (${df}.a + ${df}.b).astype(float)`;
  await py.x`${df}['c'] = ${df}.c`;

  const ema = df.c.ewm(kwargs({ span: 3, adjust: false })).mean();
  const rolling = ema.rolling(3, 0);
  const emaMin = rolling.min();

  const signal = py`${ema} * 0`;
  const d = (a: PyVar, b: PyVar) => np.absolute(py`(${a} - ${b}) / ${a}`);

  const ones = py`${d(ema, emaMin)} > .1`;
  await ones.to_json().v;

  await py.x`${signal}.loc[${ones}] = 1`;

  expect(await signal.v).toMatchInlineSnapshot(`
    Array [
      0,
      1,
      1,
      1,
      1,
      1,
      1,
      0,
      0,
      0,
    ]
  `);
});
