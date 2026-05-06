/**
 * SignaturePadHardened — signing UI for daily logs (parallel to SignaturePad).
 *
 * Sits next to the existing SignaturePad without replacing it. Adds:
 *   • Cryptographic acknowledgment: shows the chain hash that will be
 *     written, so the signer sees what they're committing to.
 *   • Clear "this seals the log" copy — no "save" buttons that look reversible.
 *   • Disabled state when offline (signing must be online so the chain hash
 *     can be reserved against the server's last hash).
 */

import React, { useState } from 'react'
import { Lock, ShieldCheck, AlertTriangle } from 'lucide-react'
import { colors, typography, spacing } from '../../styles/theme'
import { Btn } from '../Primitives'
import { Eyebrow } from '../atoms'

export interface SignaturePadHardenedProps {
  /** True when offline — signing is blocked. */
  online?: boolean
  /** What the user types to confirm. The signer's display name; we compare
   *  against it to make sure they didn't bump the screen. */
  expectedSignerName: string
  /** Pre-computed preview hash so the signer sees "you are committing to
   *  abc123…". Chain math runs in `dailyLog/signing.ts`. */
  previewChainHash?: string | null
  /** Called when the signer confirms. Parent runs the sign flow + DB writes. */
  onConfirm: () => void
  /** Called for "Not yet — review again". */
  onCancel: () => void
}

export const SignaturePadHardened: React.FC<SignaturePadHardenedProps> = ({
  online = true,
  expectedSignerName,
  previewChainHash,
  onConfirm,
  onCancel,
}) => {
  const [typed, setTyped] = useState('')
  const matches = typed.trim().toLowerCase() === expectedSignerName.trim().toLowerCase()

  return (
    <div
      style={{
        padding: spacing['4'],
        border: '1px solid var(--hairline)',
        borderRadius: 12,
        backgroundColor: 'var(--color-surfaceRaised, #FFFFFF)',
        display: 'flex',
        flexDirection: 'column',
        gap: spacing['3'],
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <ShieldCheck size={16} style={{ color: colors.statusActive }} />
        <Eyebrow>Sign and seal</Eyebrow>
      </div>

      <h3
        style={{
          margin: 0,
          fontFamily: typography.fontFamilySerif,
          fontSize: 22,
          fontWeight: 400,
          color: colors.ink,
          letterSpacing: '-0.01em',
          lineHeight: 1.25,
        }}
      >
        Sealing this log makes it <em>immutable</em>.
      </h3>

      <p
        style={{
          margin: 0,
          fontFamily: typography.fontFamilySerif,
          fontSize: 15,
          lineHeight: 1.55,
          color: colors.ink2,
          maxWidth: 580,
        }}
      >
        Once sealed, edits are recorded as revisions on a forward-only chain — the original is preserved for audit. This is what an OSHA inspector or a delay-claim proceeding will rely on.
      </p>

      {previewChainHash && (
        <div
          style={{
            fontFamily: typography.fontFamilyMono ?? 'ui-monospace, monospace',
            fontSize: 11,
            padding: spacing['2'],
            background: colors.surfaceInset,
            borderRadius: 6,
            color: colors.ink3,
            wordBreak: 'break-all',
          }}
        >
          chain hash → {previewChainHash}
        </div>
      )}

      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: colors.ink3, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Type your name to confirm
        </span>
        <input
          type="text"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
          aria-label="Type your name to confirm signing"
          style={{
            padding: '10px 12px',
            border: '1px solid var(--hairline)',
            borderRadius: 8,
            fontFamily: typography.fontFamily,
            fontSize: 14,
            backgroundColor: colors.surfaceInset,
          }}
        />
        <span style={{ fontSize: 11, color: colors.ink4 }}>
          Expected: {expectedSignerName}
        </span>
      </label>

      {!online && (
        <div
          role="alert"
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            fontFamily: typography.fontFamily, fontSize: 12,
            color: colors.statusCritical,
          }}
        >
          <AlertTriangle size={12} />
          Signing requires connection — chain hash must be reserved with the server.
        </div>
      )}

      <div style={{ display: 'flex', gap: spacing['2'], justifyContent: 'flex-end' }}>
        <Btn variant="ghost" onClick={onCancel}>Not yet — review again</Btn>
        <Btn
          variant="primary"
          icon={<Lock size={14} />}
          disabled={!matches || !online}
          onClick={onConfirm}
        >
          Sign and seal
        </Btn>
      </div>
    </div>
  )
}
