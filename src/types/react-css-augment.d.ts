// Module augmentation for CSS properties not yet in @types/react 19.x.
// export {} makes this a module file so the declare module block is treated
// as an augmentation of the existing react module, not a replacement.
export {}

declare module 'react' {
  interface CSSProperties {
    textWrap?: 'wrap' | 'nowrap' | 'balance' | 'pretty' | 'stable' | (string & {})
  }
}
