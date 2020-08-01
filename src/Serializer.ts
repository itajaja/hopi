export default class Deserializer<T> {
  constructor(
    public config: {
      typeName: string;
      deserialize: (v: string) => T;
      serialize: string;
    },
  ) {}
}

export const builtinDeserializers = [
  new Deserializer({
    typeName: 'builtins.int',
    serialize: 'lambda v: str(v)',
    deserialize: (s) => Number(s),
  }),
  new Deserializer({
    typeName: 'builtins.float',
    serialize: 'lambda v: str(v)',
    deserialize: (s) => Number(s),
  }),
  new Deserializer({
    typeName: 'builtins.bool',
    serialize: 'lambda v: v',
    deserialize: (s) => s,
  }),
  new Deserializer({
    typeName: 'builtins.bool',
    serialize: 'lambda v: "." if v else ""',
    deserialize: (s) => Boolean(s),
  }),
];
