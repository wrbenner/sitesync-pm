// text-wrap is not yet in @types/react — augment CSSProperties so callers
// can use balance/pretty values in inline styles without unsafe casts.
import 'react';
declare module 'react' {
  interface CSSProperties {
    textWrap?: 'balance' | 'pretty' | 'stable' | 'nowrap' | 'wrap' | string;
  }
}

declare global {
  const __APP_VERSION__: string;
}
