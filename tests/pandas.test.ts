import { Settings } from 'luxon';

import { createPythonEnv } from '../src';
import { addPandasDecoders } from '../src/pandas';
import { PythonEnv, kwargs } from '../src/py';
import { PYTHON_PATH } from './config';

let py: PythonEnv;

// to make the snapshots deterministic in any timezone
Settings.defaultZoneName = 'UTC';

beforeEach(async () => {
  py = createPythonEnv({ pythonPath: PYTHON_PATH });
  await addPandasDecoders(py.shell);
});

afterEach(() => {
  return py.shell.kill();
});

test('series', async () => {
  const pd = await py.import('pandas');
  const intSeries = pd.Series([1, 2]);
  expect(await intSeries._).toEqual([1, 2]);

  const floatSeries = pd.Series([1.1, 2.1]);
  expect(await floatSeries._).toEqual([1.1, 2.1]);

  const stringSeries = pd.Series(['foo', 'bar']);
  expect(await stringSeries._).toEqual(['foo', 'bar']);

  const dateSeries = pd.Series([
    pd.Timestamp('2020-01-01'),
    pd.Timestamp('2020-01-02'),
  ]);
  expect(await dateSeries._).toMatchInlineSnapshot(`
    Array [
      "2020-01-01T00:00:00.000Z",
      "2020-01-02T00:00:00.000Z",
    ]
  `);
});

test('dataframe', async () => {
  const pd = await py.import('pandas');
  const range = py`range`;
  const dateList = pd.date_range('2019-01-01', '2019-01-06');
  const df = pd.DataFrame(
    {
      a: range(0, 6),
      b: ['a', 'b', 'c', 'd', 'e', 'f'],
      c: dateList,
      d: dateList` - ${dateList}[::-1]`,
      e: [{}, [], py`[]`, 4, '-', [pd.Timestamp('2020')]],
    },
    kwargs({ index: dateList }),
  );

  expect(await df._).toMatchInlineSnapshot(`
    Array [
      Object {
        "a": 0,
        "b": "a",
        "c": "2019-01-01T00:00:00.000Z",
        "d": "PT-432000S",
        "e": Object {},
      },
      Object {
        "a": 1,
        "b": "b",
        "c": "2019-01-02T00:00:00.000Z",
        "d": "PT-259200S",
        "e": Array [],
      },
      Object {
        "a": 2,
        "b": "c",
        "c": "2019-01-03T00:00:00.000Z",
        "d": "PT-86400S",
        "e": Array [],
      },
      Object {
        "a": 3,
        "b": "d",
        "c": "2019-01-04T00:00:00.000Z",
        "d": "PT86400S",
        "e": 4,
      },
      Object {
        "a": 4,
        "b": "e",
        "c": "2019-01-05T00:00:00.000Z",
        "d": "PT259200S",
        "e": "-",
      },
      Object {
        "a": 5,
        "b": "f",
        "c": "2019-01-06T00:00:00.000Z",
        "d": "PT432000S",
        "e": Array [
          "2020-01-01T00:00:00.000Z",
        ],
      },
    ]
  `);
});
