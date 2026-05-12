# Tracking budget and change orders

The Budget module shows your contract value, committed costs, and forecast at completion. Change orders adjust the contract and the forecast.

## Budget view

- **Contract value** — original signed amount
- **Committed** — sum of subcontracts + POs
- **Spent** — invoiced + approved payment apps
- **Forecast at completion** — projected final cost

## Change orders

Each CO has a state machine: draft → sent → approved → executed. Approved COs add to the contract value automatically. The audit chain captures every state change.

## Margin protection

Iris flags variance > 5% on any line item by default. Adjust the threshold in Settings → Budget.
