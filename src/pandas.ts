// eslint-disable-next-line import/no-extraneous-dependencies
import { DateTime, Duration } from 'luxon';

import { Json, TypeDecoder } from './Decoder';
import PythonShell from './PythonShell';

const decoders: TypeDecoder[] = [
  {
    typeName: 'numpy.int64',
    encode: 'lambda v: int(v)',
    decode: (v) => v,
  },
  {
    typeName: 'numpy.float64',
    encode: 'lambda v: float(v)',
    decode: (v) => v,
  },
  {
    typeName: 'pandas.core.series.Series',
    encode: 'lambda v: v.to_list()',
    decode: (v, decode) => decode(v),
  },
  {
    typeName: 'pandas.core.frame.DataFrame',
    encode: 'lambda v: [list(list(x) for x in v.values), list(v.columns)]',
    decode: (rawV, decode) => {
      const [values, columns] = rawV as [Json[][], string[]];
      return values.map((v) => {
        const row: Dict = {};
        v.forEach((vv, i) => {
          row[columns[i]] = decode(vv);
        });
        return row;
      });
    },
  },
  {
    typeName: 'pandas._libs.tslibs.timestamps.Timestamp',
    encode: 'lambda v: v.isoformat()',
    decode: (s: string) => DateTime.fromISO(s),
  },
  {
    typeName: 'pandas._libs.tslibs.timedeltas.Timedelta',
    encode: 'lambda v: v.total_seconds() * 1000',
    decode: (s: number) => Duration.fromMillis(s),
  },
];

export async function addPandasDecoders(shell: PythonShell) {
  await Promise.all(decoders.map(shell.addDecoder));
}
