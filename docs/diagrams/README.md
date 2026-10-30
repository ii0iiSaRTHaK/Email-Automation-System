# Workflow visuals

These SVGs are authored architecture diagrams for the reference implementation. They are not screenshots of connected n8n, Make, Zapier, Gmail, or Shopify accounts. Editable Mermaid sources sit beside each SVG. Update the `.mmd` source and its SVG together when the design changes.

| Visual | What it explains |
| --- | --- |
| [System map](system-map.svg) | Which system owns each event stream and the shared composition API |
| [Support triage](support-triage.svg) | Incoming customer email to policy-grounded draft and human review |
| [Order updates](order-updates.svg) | Shopify events routed through Make to customer updates |
| [Lifecycle campaigns](lifecycle-campaigns.svg) | Consent-aware welcome, cart recovery, and win-back journeys |

For genuine platform evidence, see [`../../screenshots/README.md`](../../screenshots/README.md). Capture those only after connecting and testing real accounts.
