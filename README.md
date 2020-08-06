# hopi [![npm version](https://badge.fury.io/js/hopi.svg)](https://badge.fury.io/js/hopi) [![hopi](https://circleci.com/gh/itajaja/hopi.svg?style=svg)](https://circleci.com/gh/itajaja/hopi)

_If it looks like python, swims like python, and quacks like python, then it probably is python._

Hopi is a Python-in-node interoperability library focused on seamlessness and developer experience.

The goal of the project is to be able to make use of python libraries and features as if they were written in Javascript.
The result is code where it's really hard to tell which parts are executed in python and which in node. Whether this is an actual good thing, it's up for debate, but it's certaintly fun ⭐️.

Use at your own risk! Hopi is currently not production ready. The APIs might change and there might be significant performance issues. Moreover, the current iteration does not offer any GC capabilities and there is significant risk of using too much memory if the python envs are long lived.

## Getting started

```sh
# yarn
yarn add hopi
# npm
npm install hopi
```

## Example

Worth a thousand words:

```ts
import { createPythonEnv, kwargs } from 'hopi';

const py = createPythonEnv('python');

async function run() {
  try {
    await shell.addDecoder({
      typeName: 'pandas._libs.tslibs.timestamps.Timestamp',
      encode: 'lambda v: v.isoformat()',
      decode: (s: string) => new Date(s).toDateString(),
    });

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
      `the biggest increase in daily new cases was ${await biggestIncrease._} and it happened on ${(
        await biggestIncreaseDay._
      ).toDateString()}`,
    );

    const juneData = df`[${df}.date.between('2020-06-01', '2020-07-01')]`;
    const usJuneDeaths = juneData`[${juneData}.iso_code == 'USA']`.new_deaths.describe();
    const median = await usJuneDeaths['50%']._;
    console.log(
      `in june, the median of daily new cases in the United states was ${median}`,
    );

    const requests = await py.import('requests');

    const resp = requests.get('https://example.com/');
    await resp.raise_for_status()._;
    console.log(await resp.text._);
  } catch (e) {
    console.log('received an error:', e);
  } finally {
    py.shell.kill();
  }
}

run();
```

## Documentation

First, to create a new environment:

```ts
const py = createPythonEnv('path_to_python_binary');
```

you can use `py` to run python code directly from javaScript.

> 💡In order to properly dispose of the environment, make sure you call `py.shell.kill()` at the end of your program.

### Execute code

To execute any code:

```ts
await py.x`import pandas`;
await py.x`x = 'abc'`;
await py.x`def add(x, y):
  return x + y`;
```

### Evaluate code

```ts
const myVal = await py.e`[1, 2, 3][-1]`; // 3
console.log(myVal); // 3
const myVal2 = await py.e`len({1, 2, ()}) == 3`;
console.log(myVal2); // true
```

### using PyVar

`PyVar`s are powerful objects that lets you compose python constructs as javaScript and extract the results when needed. To create a `PyVar`, call `py` directly with a string template:

```ts
const v = py`1 + 2`;
```

in the code above, `v` is not `3`, but rather a reference to a python variable that holds that value. To get the value, use the `_` property

```ts
const result = await v._;
print(v); // 3
```

`PyVars` are composable in many different ways. They can be used in `py`s string template:

```ts
const v1 = py`1 + 2`;
const v2 = py`3 + ${v1}`;
console.log(await v2._); // 6
```

They can be called:

```ts
import { kwargs } from './py';

const foo = py`lambda x: x.lower()`;
console.log(await foo('my JavaScript string')._);
console.log(await foo(py`"a python string!"`)._);
console.log(await foo(kwargs({ x: 'string' })));
```

They can be accessed with dot notation or square brackets notation:

```ts
const myString = py`" abc "`;
const upperString = myString.upper().strip()[2];
```

> 💡Unfortunately there is a mismatch between python and JavaScript: in JavaScript dot notation and square bracket are interchangeable, while in python they mean very different things
>
> Therefore, There are a couple of rules that apply to dot or square brackets notations
>
> - number properties are passed as integers in square brackets: eg `[1]`, `[1.1]`
> - strings that are not valid propertry names in python are stringified and passed in square brackets: eg `['0a']`, `['.']`, `['?']`
> - everything else is passed with dot notation, eg `.foo`

Lastly, `PyVars` also accept interpolated strings to be chained:

```ts
const myList = py`[1, 2, 3, 4, 5]`;
const val = myList`[2:4].index(3)`;
// which is equivalent to
const val = myList`[2:4]`.index(3);
// which is equivalent to
const val = myList`[2:4].index(3)`;
// which is equivalent to
const val = myList`[2:4]`.index`(3)`;
// which is equivalent to
const val = myList`[2:4]`.index`(${py`3`})`;
```

### Decoders

In order to read values from python in JavaScript, they need to be properly encoded in strings and then decoded in JavaScript. Custom decoders can be defined as such:

```ts
await shell.addDecoder({
  // the fully qualified type name
  typeName: 'pandas._libs.tslibs.timestamps.Timestamp',
  // stringified lambda function to encode the python value into a string
  encode: 'lambda v: v.isoformat()',
  // function to transform the value into the desired Javascript value.
  // The `decode` argument can be used to recursively call the full decoder
  decode: (v, decode) => new Date(v).toDateString(),
});
```

## TODO

- [ ] gc
