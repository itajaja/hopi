export interface TypeDecoder {
  /** The fully qualified name (module name + name) of the python type */
  typeName: string;

  /** a stringified lambda function to convert the type to a serializable type */
  encode: string;

  /** a function that converts the decoded json */
  decode: (value: Json, fullDecode: Decoder['decode']) => any;
}

export type Json =
  | Json[]
  | { [idx: string]: Json }
  | string
  | number
  | boolean
  | null;

function mapValues<T1, T2>(o: Dict<T1>, mapper: (v: T1) => T2) {
  const ret: Dict<T2> = {};

  Object.entries(o).forEach(([k, v]) => {
    ret[k] = mapper(v);
  });

  return ret;
}

export class Decoder {
  decoders: Dict<TypeDecoder['decode'] | undefined> = {};

  decode = (val: Json): any => {
    if (Array.isArray(val)) {
      return val.map(this.decode);
    }
    if (val instanceof Object) {
      if ('%%hopi_v%%' in val && '%%hopi_t%%' in val) {
        const typeName = val['%%hopi_t%%'] as string;
        const rawValue = val['%%hopi_v%%'];
        const decode = this.decoders[typeName];
        if (!decode) {
          throw new Error(`Decoder not registered for type ${typeName}`);
        }
        return decode(rawValue, this.decode);
      }

      return mapValues(val, this.decode);
    }
    return val;
  };

  add(decoder: TypeDecoder) {
    this.decoders[decoder.typeName] = decoder.decode;
  }

  parseJson(text: string) {
    const parsed: Json = JSON.parse(text);
    return this.decode(parsed);
  }
}
