# Architecture

See the visual gallery in [`docs/diagrams/`](docs/diagrams/): [system map](docs/diagrams/system-map.svg), [support triage](docs/diagrams/support-triage.svg), [order updates](docs/diagrams/order-updates.svg), and [lifecycle campaigns](docs/diagrams/lifecycle-campaigns.svg). These are authored system diagrams, not evidence of connected accounts.

## What it does

Fieldnote Supply is a fictional store. The system models outbound lifecycle email and inbound support email. It separates store events and mailbox connections from message composition so a workflow platform can own triggers, credentials, timing, and delivery.

```mermaid
flowchart LR
  subgraph Lifecycle[Customer lifecycle]
    Shopify[Shopify event] --> Zapier[Zapier: opt-in and recovery]
    Shopify --> Make[Make: order and return events]
    Zapier --> EventAPI[POST /webhooks/{tool}]
    Make --> EventAPI
    EventAPI --> Composer[Node email composer]
    Composer --> EmailProvider[Connected email provider sends]
  end
  subgraph Support[Customer support]
    Gmail[Gmail support inbox] --> N8N[n8n Gmail Trigger]
    N8N --> Normalize[Normalize message fields]
    Normalize --> SupportAPI[POST /webhooks/n8n/inbound]
    SupportAPI --> Policy[Classify against store policy]
    Policy --> LLM{OpenAI key configured?}
    LLM -->|yes| DraftAI[Responses API rewrites grounded draft]
    LLM -->|no| Fallback[Deterministic policy template]
    DraftAI --> GmailDraft[Create Gmail reply draft]
    Fallback --> GmailDraft
    GmailDraft --> Review[Person checks and sends]
    Policy --> Escalate[Billing, order lookup, or exception → human review]
  end
```

## Boundaries

- **Node service:** validates/normalizes inbound payloads, composes six outbound event templates, classifies common support intents, applies fictional policy facts, optionally calls OpenAI Responses API for wording, and returns a draft payload. It has no mailbox password and never sends support replies.
- **n8n:** owns the support Gmail trigger, normalizes messages, calls the support API, creates a reply draft in the original thread, and marks the source message read after draft creation.
- **Make:** recommended owner for Shopify order, fulfillment, and return triggers. Its Router can send each event to the matching composer route and then to the connected mail provider.
- **Zapier:** recommended owner for opt-in welcome and delayed cart/win-back journeys. Delays and eligibility checks belong in the Zap before sending.
- **Email provider:** owns sender identity, SPF/DKIM verification, delivery, replies, and bounce/suppression handling.
- **OpenAI:** optional drafting aid. The canonical policy stays in `knowledge/store-policy.json`; the model may rewrite only a draft. API keys stay server-side. If the API is unavailable, the deterministic policy fallback is used.

## Event contract

Store events use `type`, `eventId`, `name`, and `email`. Order events can add `orderId`, `total`, `items`, and `tracking`. Stable `eventId` values suppress repeated events while this demo process is running.

Support events use `messageId`, `threadId` (retained by the automation platform), `from`, `name`, `subject`, and plain-text `text`. Stable `messageId` values return the existing case during the current process lifetime. The platform keeps the original `threadId` and uses it when it creates the Gmail draft.

## Current limits

Activity and duplicate IDs are in memory. The n8n export is a starter workflow: import it, attach Google credentials, test the Gmail Trigger output/body fields, set the deployment URL, and add the webhook bearer credential before enabling it. Make and Zapier are documented setup recipes rather than already-connected accounts. Production requires durable storage, real order lookup, consent/suppression enforcement, rate limits, monitoring, and deployment authentication.
