# Wyth Paddle Sandbox Catalog

This file records non-secret Paddle sandbox catalog identifiers. It must not
contain API keys, client-side tokens, webhook secrets, customer IDs, payment
details, or personal account information.

| Internal plan | Paddle product | Monthly price | Billing rule |
| --- | --- | --- | --- |
| `standard` | `pro_01kzszfg7wnezp5ate7fe4k512` | `pri_01kzszqc8792n88p0c90jd5r8c` | USD 10/month; no Paddle trial |
| `unlimited` | `pro_01kzszxkasj6jgpzz90mcwcvdp` | `pri_01kzszytcn2m8wdsgbqeasyrbh` | USD 20/month; fair use; no Paddle trial |

## Trust boundary

- These IDs identify catalog entries only; they do not grant access.
- The browser may request checkout for the internal plan names `standard` and
  `unlimited`, but it may not submit arbitrary Paddle price IDs.
- The server maps the internal plan name to the environment-owned Paddle price
  ID and attaches the authenticated Wyth user ID as trusted metadata.
- Only a verified, idempotently processed Paddle webhook may create or change a
  paid entitlement.
- Paddle.js uses a sandbox client-side token (`test_...`) stored as
  `PADDLE_CLIENT_TOKEN` in Render. It is separate from the server-only
  `PADDLE_API_KEY`; neither value belongs in this catalog file.
- The sandbox default payment link must be the approved staging origin
  `https://staging.thewyth.com/`. The browser opens checkout from a
  server-created transaction ID and never accepts a price ID from the user.
- Wyth's one-day cardless trial starts after the first successful hosted AI
  reply and is not represented by a Paddle price trial.
- Live products and prices must be created separately after account and domain
  approval. Sandbox IDs must never be reused in production.
