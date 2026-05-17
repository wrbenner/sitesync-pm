import 'react'

declare module 'react' {
  interface CSSProperties {
    textWrap?: 'balance' | 'pretty' | 'stable' | 'nowrap' | 'wrap' | string
  }
}
