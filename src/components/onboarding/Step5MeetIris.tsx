// src/components/onboarding/Step5MeetIris.tsx — BRT sub-3 §3 (Step 5 of 5)
//
// 60-second tour of the AI Copilot. Shows what Iris does without making
// the user invent an RFI to test it. The CTA routes to /rfis where the
// user lands on a populated list (sample data from is_demo seeder).

import { Link } from 'react-router-dom'

const PILLARS = [
  {
    title: 'Drafts with citations',
    body: 'Every Iris draft anchors back to source data — drawing coordinates, photos, RFIs, spec sections. Eight citation kinds total. You can see what Iris read before writing.',
  },
  {
    title: 'You always approve',
    body: 'Iris suggests; you approve, edit, or reject. The AI never sends to the architect, the GC, or the field on its own.',
  },
  {
    title: 'Hash-chained audit log',
    body: 'Every approval, rejection, and edit writes to an append-only log that hashes the previous entry. Tamper-evident; deposition-grade.',
  },
]

export default function Step5MeetIris() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <p style={{ color: '#5C5C5C', fontSize: 14 }}>
        Iris is the AI layer that drafts RFIs, submittals, daily logs, and
        follow-ups based on context (drawings, photos, prior RFIs). The
        point isn't replacement — it's removing the blank page.
      </p>

      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 12 }}>
        {PILLARS.map((p) => (
          <li
            key={p.title}
            style={{
              padding: 16,
              border: '1px solid #E5E7EB',
              borderRadius: 8,
              background: 'white',
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 600, color: '#1A1A1A', marginBottom: 4 }}>{p.title}</div>
            <div style={{ fontSize: 13, color: '#5C5C5C' }}>{p.body}</div>
          </li>
        ))}
      </ul>

      <div style={{
        padding: 16,
        background: '#EEF4FF',
        border: '1px solid #BFDBFE',
        borderRadius: 8,
      }}>
        <p style={{ margin: 0, fontSize: 14, color: '#1E3A8A', marginBottom: 12 }}>
          Want to see Iris in action right now?
        </p>
        <Link
          to="/rfis"
          style={{
            display: 'inline-block',
            padding: '8px 14px',
            background: '#0066FF',
            color: 'white',
            borderRadius: 6,
            fontSize: 14,
            fontWeight: 600,
            textDecoration: 'none',
          }}
        >
          Open RFIs and try a draft →
        </Link>
        <p style={{ margin: 0, fontSize: 12, color: '#1E3A8A', marginTop: 8 }}>
          We'll mark onboarding complete and take you straight to the RFI list.
        </p>
      </div>

      <p style={{ color: '#5C5C5C', fontSize: 13 }}>
        Or click <strong>Finish</strong> below to land on your dashboard. You
        can come back to <Link to="/ai" style={{ color: '#0066FF' }}>AI Copilot</Link>{' '}
        any time.
      </p>
    </div>
  )
}
