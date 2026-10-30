# Demo run-through (about 2 minutes)

## Start

1. Run `npm start` and open `http://localhost:3000`.
2. Say: “This is an email operations reference for a fictional stationery shop. It separates the workflow tools that watch events from the service that drafts customer messages.”

## Show an outbound update

1. Open **Run a store event** and choose **Order is dispatched**.
2. Keep the sample order and tracking link, then compose the preview.
3. Show the email preview and the event in Activity. Explain that Make would listen to the fulfillment event, call the composer endpoint, and send the returned subject/HTML through the configured email provider. The local preview does not deliver mail.

## Show inbound support

1. Open **Support inbox** and submit: subject “What is your return policy?”; message “Can I return a notebook if I change my mind?”
2. Review the reply. Point to `knowledge/store-policy.json` as the source of the 30-day window and return instructions.
3. Submit another message asking where order `FN-2048` is. Show that the system asks for/flags order lookup instead of inventing tracking data.
4. Explain that n8n connects Gmail, calls the inbound endpoint, creates a draft in the source thread, and leaves a person in control. OpenAI only rewrites a policy-grounded draft; the fallback works without an API key.

## Close with the platform division

- Zapier: opt-in welcome and delayed recovery journeys.
- Make: order, shipping, and return events.
- n8n: support triage, draft creation, and human escalation.

Be direct that the local service and starter n8n export are prepared; the external Gmail/Shopify/Make/Zapier accounts are not connected until their owners add credentials and a public HTTPS endpoint.
