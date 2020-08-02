# hopi

## Example:

```ts
import Deserializer from './Serializer';
import { createPythonEnv, kwargs } from './py';

const py = createPythonEnv('python');

async function run() {
  try {
    await py.shell.addBuiltinSerializers();
    await py.shell.addSerializer(
      new Deserializer({
        typeName: 'numpy.float64',
        serialize: 'lambda v: str(v)',
        deserialize: (s) => Number(s),
      }),
    );
    await py.shell.addSerializer(
      new Deserializer({
        typeName: 'pandas._libs.tslibs.timestamps.Timestamp',
        serialize: 'lambda v: v.isoformat()',
        deserialize: (s) => new Date(s),
      }),
    );

    const pd = await py.import('pandas');
    let df = pd.read_csv(
      'https://covid.ourworldindata.org/data/owid-covid-data.csv',
    );
    df = df.assign(kwargs({ date: pd.to_datetime(df.date) }));
    // remove total world count
    df = df`[${df}.iso_code != 'OWID_WRL']`;
    const newCases = df.groupby('date').new_cases;
    const diffCases = newCases
      .sum()
      .diff()
      .sort_values(kwargs({ ascending: false }));

    const biggestIncrease = diffCases.iloc[0];
    const biggestIncreaseDay = diffCases.index[0];
    console.log(
      `the biggest increase in daily new cases was ${await biggestIncrease.v} and it happened on ${(
        await biggestIncreaseDay.v
      ).toDateString()}`,
    );

    const juneData = df`[${df}.date.between('2020-06-01', '2020-07-01')]`;
    const usJuneDeaths = juneData`[${juneData}.iso_code == 'USA']`.new_deaths.describe();
    const median = await usJuneDeaths['50%'].v;
    console.log(
      `in june, the median of daily new cases in the United states was ${median}`,
    );

    const requests = await py.import('requests');

    const resp = requests.get('https://example.com/');
    await resp.raise_for_status().v;
    console.log(await resp.text.v);
  } catch (e) {
    console.log('received an error:', e);
  } finally {
    py.shell.kill();
  }
}

run();
```

## TODO

- [x] better match send /w receive
- [x] error handling
- [x] proxy for dots and methods
- [x] add kwargs
- [x] deserializers
- [ ] serializers
- [ ] pandas
- [ ] gc
- [ ] tests
- [ ] CI
- [ ] readme/docs/examples
