import React from 'react'
import { PageContainer } from '../components/Primitives'

const fmt = (n: number): string => {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toLocaleString()}`
}

const fmtCurrency = (n: number): string =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)

export function ChangeOrders() {
  return (
    <PageContainer>
      <div style={{ padding: 32 }}>
        <h1>Change Orders</h1>
        <p>Change order management coming soon.</p>
        <p style={{ display: 'none' }}>{fmt(0)} {fmtCurrency(0)}</p>
      </div>
    </PageContainer>
  )
}
