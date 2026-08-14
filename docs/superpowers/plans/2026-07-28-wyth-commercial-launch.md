# Wyth Commercial Launch Implementation Plan

> **Status:** Planning only. Commercial implementation begins after the product decisions in "Approval Questions" are confirmed. Each phase ends with browser review and user approval.

**Goal:** Turn the current local-first Wyth prototype into an international account-based service with reliable hosted AI replies, selective cloud sync, a one-day trial, USD 10 and USD 20 monthly plans, referral rewards, announcements, and a secure owner/admin console.

**Recommended architecture:** Preserve the current chat-first vanilla frontend and local ownership of chats, companions, and companion memories. Add a hosted Node API, Supabase email/password Auth, Postgres for account/billing/vocabulary/birthday metadata, Supabase Storage for avatars, a payment-provider adapter led by Paddle with PayPal China fallback, and server-owned DeepSeek access. The browser keeps local conversation data while cloud entitlements and model usage remain authoritative on the server.

**Preferred managed services:** Supabase (Auth, Postgres, Storage), Paddle as Merchant of Record for subscriptions/tax where the mainland-China individual application is approved, PayPal China subscriptions as the direct-merchant fallback, Resend or Postmark (transactional email), Sentry (errors), PostHog or privacy-configured product analytics, and a managed Node host such as Railway/Render/Fly.io. Vercel is acceptable if the current long-running server is first adapted to stateless functions.

**Production domain decision (2026-08-13):** `thewyth.com` is registered through Cloudflare Registrar. Use `thewyth.com` / `www.thewyth.com` for the public product and `auth.thewyth.com` as the dedicated transactional-auth email sending subdomain. The local `127.0.0.1` origin remains development-only until a managed HTTPS deployment is approved.

---

## Execution and Review Model

- Use the primary agent as technical lead and integration owner so all work stays on the existing Wyth code path.
- Use a higher-reasoning agent or independent reviewer for architecture, authentication, RLS, billing entitlements, referral fraud, admin authorization, privacy, migrations, and production go-live decisions.
- Use lower-reasoning execution for bounded tasks with an approved contract: UI wiring, schema migration transcription, fixtures, routine endpoint implementation, documentation, and focused regression tests.
- Give every delegated task exact files, interfaces, acceptance tests, and prohibited scope. Subtasks do not redesign adjacent systems.
- Require independent review for security- or money-sensitive changes before integration. The implementation agent does not approve its own billing/auth/admin work.
- Keep one integration checkpoint per phase: focused tests -> full tests -> security/behavior review -> browser preview -> user approval.
- Escalate from low to high reasoning when tests reveal ambiguous behavior, requirements conflict, or a change crosses account, money, privacy, age, or tenant boundaries.
- Preserve a concise decision log in this plan so later implementation does not repeatedly reopen settled product choices.

---

## Non-Negotiable Launch Rules

- The first public-beta validation scenario is a user who feels lost and wants a steady, emotionally literate window for reflection. Wyth listens first, separates facts from interpretation, offers one manageable next step, and never presents itself as an all-knowing authority or a substitute for professional help.
- Provider keys, payment-provider secrets, Supabase service-role keys, and webhook secrets remain server-only.
- Initial production exposes only platform-managed DeepSeek. Public model switching and user API-key entry remain disabled until a later reviewed release; local development/admin diagnostics may retain the underlying capability.
- Production must never silently present a deterministic local reply as an AI reply. Temporary provider failure returns a visible retry state; local fallback remains a development/offline feature only.
- Verified payment webhooks and the entitlement ledger are the source of truth. The browser cannot grant trials, referral weeks, or paid access.
- Spending level must not influence emotional intimacy or companion behavior. Billing only determines access to paid product capabilities.
- Chats, companions, and companion memories remain browser-local at launch and this limitation is disclosed in onboarding and announcements. Clearing browser data or changing devices can lose them unless a later opt-in backup feature is approved.
- The USD 20 plan may be marketed as unlimited only with a clearly disclosed fair-use/abuse policy and a technical emergency ceiling; no public AI plan can safely be literally unbounded.
- Every user-owned table uses Supabase RLS with indexed `user_id`/foreign keys. Administrative operations use narrowly scoped server routes.
- Staging and production use separate Supabase projects, payment-provider sandbox/live products, domains, secrets, email senders, and analytics projects.
- Every phase requires automated tests plus desktop/mobile browser approval before the next phase.

---

## Target Runtime Flow

1. User signs in through Supabase Auth and receives a secure session.
2. Browser calls the Wyth backend with the session token; backend verifies identity and entitlement.
3. Browser sends the selected local companion definition, bounded local memory, and recent local conversation for the current request; the backend validates and bounds this untrusted payload but does not persist it.
4. Backend calls DeepSeek with a server-owned key, timeout, bounded context, retry, entitlement check, rate limit, and usage metering.
5. Usage is written to an append-only ledger; the response and safe diagnostics are persisted.
6. Verified Paddle/PayPal webhook events update subscription state and entitlement periods idempotently.
7. Referral rewards are issued only after the configured qualifying event and fraud checks.

---

## Proposed Data Model

All IDs are UUIDs unless noted. Every foreign key is indexed; high-volume queries receive composite indexes after `EXPLAIN ANALYZE` verification.

| Table | Purpose | Important constraints |
| --- | --- | --- |
| `profiles` | User locale, timezone, birthday privacy state, onboarding | `id = auth.users.id`; minimal PII |
| `vocabulary_items` | Saved translations and pronunciation metadata | owner RLS; dedupe constraint |
| `user_preferences` | Accessibility, notifications, language, voice | one row per user |
| `subscriptions` | Mirrored provider/customer/subscription status | unique `(provider, provider_subscription_id)`; webhook-written |
| `entitlement_periods` | Trial, paid, referral, support adjustments | append-only dates + reason + source ID |
| `usage_events` | Model tokens, requests, estimated cost and result | append-only; partition later if needed |
| `referral_codes` | Stable invite code per eligible account | unique normalized code |
| `referrals` | Inviter/invitee relationship and qualification | unique invitee; no self-referral |
| `referral_rewards` | Idempotent one-week grants | unique `(referral_id, reward_type)` |
| `avatar_assets` | Supabase Storage object lifecycle | MIME/size checks; owner path |
| `announcements` | Admin-authored global or segmented notices | publish window, locale, severity, status |
| `announcement_receipts` | Per-user read/dismiss state | unique `(announcement_id, user_id)` |
| `admin_roles` | Explicit owner/support/operator permissions | no public writes; least privilege |
| `webhook_events` | Paddle/PayPal event idempotency and replay audit | unique `(provider, provider_event_id)` |
| `audit_events` | Security/account/admin events | no chat content or secrets |

RLS defaults to deny. Policies use `(select auth.uid())`, and all RLS/FK columns are indexed. Service-role access is confined to trusted backend jobs and webhook handlers.

---

## Entitlement Rules

Use one pure server-side `resolveEntitlement(userId, now)` function backed by the entitlement ledger.

- `trial`: one 24-hour period beginning with the first successful AI conversation. It requires no card and never converts automatically.
- `standard`: active provider subscription at USD 10/month with a monthly model-cost allowance targeting approximately USD 4 at current provider prices.
- `unlimited`: active provider subscription at USD 20/month with no ordinary user-facing message meter, subject to fair use, automated abuse protection, and an operator emergency ceiling.
- `referral`: seven additional days for the inviter after the invited account completes registration and email verification. Rewards may accumulate without a published count cap, but suspicious rewards can remain pending or be reversed.
- `grace`: short billing-recovery window only if explicitly approved.
- `expired`: local chat history remains accessible/exportable, but new hosted AI messages require an active plan or purchased allowance.
- `top_up`: additional metered usage purchased voluntarily after the Standard allowance is exhausted; package size and price are configured as provider one-time products/prices without changing subscription renewal.
- Referral days should normally extend the current entitlement end date, not run concurrently and disappear.

The database, not localStorage, records whether a trial was consumed. Device/IP/payment signals may inform abuse review but must not become irreversible identity proof by themselves.

---

# Phase 0 - Repair and Production-Harden Model Calls

## Task 0.1: Finish the local regression fix

**Files:** `src/openaiClient.js`, `tests/openaiClient.test.mjs`, `scripts/start-wyth.ps1`, `tests/wythLauncher.test.mjs`, `server.mjs`

- [x] Preserve a sanitized DeepSeek error code/message instead of recording only HTTP status.
- [x] Retry bounded-context requests after HTTP 400 and retry transient 408/429/5xx failures once.
- [x] Append launcher logs instead of erasing intermittent failure evidence on restart.
- [x] Add request ID, error category, attempt count, latency, selected model, and context size to structured server diagnostics without keys or message content.
- [x] Add an explicit provider timeout with `AbortController`.
- [x] Change production behavior from silent local fallback to a retryable `503` response; keep fallback only behind `ALLOW_LOCAL_FALLBACK=1` for development.
- [x] Add `/api/health/ready` that checks configuration and a lightweight provider circuit state without spending tokens.
- [x] Add a circuit breaker so repeated provider failures fail quickly, recover automatically, and alert the operator.
- [x] Verify saved model configuration survives a cold restart and a real DeepSeek chat request.

**Gate:** focused tests, full `npm test`, cold restart, forced 400/429/timeout tests, then browser approval of visible error/retry behavior.

---

# Phase 1 - Production Foundation and Environments

## Task 1.0: Beginner cloud onboarding runbook

- [x] Create `docs/wyth/cloud-setup-for-beginners.md` with screenshot-ready steps and a checklist for creating Supabase, Paddle, PayPal China, hosting, email, monitoring, DNS, and GitHub deployment access.
- [x] Explain staging versus production, environment variables, billing alerts, budgets, regions, backups, and how to revoke access without exposing credentials in chat.
- [x] Recommend an international-first stack independent of the existing Tencent Cloud and Alibaba Cloud accounts: Supabase + Paddle/PayPal China + managed Node hosting. Use Tencent/Alibaba later only for a separate mainland-China deployment if required.
- [ ] Walk through the setup interactively one provider at a time; stop after each provider for user confirmation.
- [x] Create a secret-name inventory containing variable names and dashboard locations, never secret values.

**Gate:** user can open each dashboard, identify staging and production, and deploy a harmless staging health endpoint with billing alerts enabled.

## Task 1.1: Create managed service projects

- [ ] Create separate Supabase staging/production projects.
- [ ] Apply to Paddle as an individual/sole trader after a public staging site, pricing page, terms, privacy policy, refund policy, and product description are ready; approval is not assumed.
- [ ] Register and verify a PayPal China individual seller account in parallel, then request/enable global checkout and subscription capabilities available to the approved account.
- [ ] Create sandbox/test and live USD 10 Standard, USD 20 Unlimited, and one-time top-up products only after the selected provider approves the merchant account.
- [ ] Create managed Node staging/production services with health checks and rolling deploys.
- [ ] Configure custom domain, HTTPS, DNS, environment validation, secret rotation, and restricted CORS origins.
- [ ] Add CI for tests, migrations, dependency audit, and staging deployment.
- [ ] Add Sentry plus uptime checks for web, API, database, payment-webhook lag, and model failure rate.

## Task 1.2: Refactor the Node server safely

- [ ] Split `server.mjs` routing into small modules while retaining one application entry point.
- [ ] Add request IDs, JSON logs, central error handling, security headers, body limits, and trusted-proxy configuration.
- [ ] Add environment schema validation; production refuses to start with missing/placeholder secrets.
- [ ] Add IP/user rate limiting using a managed shared store, not process memory.

**Gate:** staging deployment loads Wyth, health/readiness pass, secrets do not appear in browser/logs, and rollback is tested.

---

# Phase 2 - Accounts, Login, and Sessions

## Task 2.1: Supabase Auth integration

- [ ] Add email/password signup, mandatory email verification, logout, password reset, secure session refresh, and breached/common-password rejection where supported.
- [ ] Add route/UI states for signed out, verifying, authenticated, expired session, and account disabled.
- [ ] Verify Supabase access tokens server-side on every private API request.
- [ ] Add CSRF protection for cookie-based mutations, secure cookie attributes if cookies are used, and strict redirect allowlists.
- [ ] Rate-limit login, signup, reset, referral-code validation, and verification resend.

## Task 2.2: Account controls

- [ ] Account/profile settings, locale/timezone, notification consent, billing link, devices/sessions, export, and deletion.
- [ ] Account deletion revokes sessions, schedules storage/database deletion, cancels billing according to policy, and records a minimal audit event.

**Gate:** signup-to-login flow reviewed on desktop/mobile; reset, expired session, duplicate signup, logout-all, and deletion tests pass.

---

# Phase 3 - Cloud Data, Sync, and Migration

## Task 3.1: Database migrations and RLS

- [ ] Create versioned SQL migrations for the proposed schema.
- [ ] Enable and force RLS on user-owned tables; add owner-only policies and indexes.
- [ ] Add constraints for enum-like states, positive usage values, unique referral relationships, and idempotency keys.
- [ ] Use pooled connections for server workloads and short transactions for webhook/entitlement updates.
- [ ] Add automated cross-tenant isolation tests with two users.

## Task 3.2: Local-to-cloud migration

- [ ] Sync vocabulary, birthday/profile metadata, preferences, and avatar references after login.
- [ ] Keep chats, companions, and companion memories in local browser storage; never upload them in background.
- [ ] Add an onboarding disclosure and persistent privacy/data-location screen explaining what is cloud-synced and what can be lost with browser/device changes.
- [ ] Add local encrypted export/import so users can manually move or back up chat, companions, and memories without creating cloud copies.
- [ ] Use deterministic IDs/idempotency keys so cloud-sync retries do not duplicate vocabulary or avatar metadata.

## Task 3.3: Avatar storage

- [ ] Upload processed avatar WebP files through signed/authorized storage paths.
- [ ] Enforce file type, size, dimensions, malware/content checks as appropriate, and orphan cleanup.

**Gate:** two-account RLS test, migration retry test, offline/reconnect test, data export, deletion, and backup restore drill.

---

# Phase 4 - Subscription and Billing Provider

## Task 4.0: Add a provider-neutral payment boundary

- [ ] Create one internal payment contract for checkout creation, subscription status, cancellation/management links, one-time top-ups, refunds, and normalized webhook events.
- [ ] Keep provider-specific Paddle and PayPal identifiers out of entitlement and frontend business logic.
- [ ] Store `provider` on customer, subscription, purchase, and webhook records so Paddle can be primary without preventing a PayPal fallback.
- [ ] Do not build both full integrations before approval: implement the first approved provider, retaining fixtures/contracts for the fallback.

## Task 4.1: Checkout and customer management

- [ ] Prefer Paddle hosted checkout/subscriptions when approved because Paddle acts as Merchant of Record and handles applicable global sales tax/VAT and billing administration.
- [ ] If Paddle does not approve the account promptly, implement PayPal China Subscriptions for voluntary USD plans and one-time checkout for top-ups; document that Wyth remains the direct merchant and needs accounting/tax review.
- [ ] Attach the internal user ID as trusted server-created metadata.
- [ ] Use the selected provider's customer subscription-management experience for payment method changes, invoices/receipts, and cancellation.
- [ ] Offer Standard at USD 10/month and Unlimited at USD 20/month with explicit allowance/fair-use wording.
- [ ] Keep the trial card-free. Ask for payment details only when the user voluntarily subscribes or purchases an additional usage package.
- [ ] Show localized pricing, trial conversion date, renewal date, usage state, cancellation state, and billing-support link.

## Task 4.2: Webhooks and entitlement synchronization

- [ ] Verify the selected provider's webhook signature/certificate rules from the raw request body before parsing business data.
- [ ] Persist every event ID before processing; make handlers idempotent and replay-safe.
- [ ] Handle checkout completion, subscription create/update/delete, invoice paid, payment failed, refunds/disputes where relevant.
- [ ] Reconcile provider and local subscription state with a scheduled job.
- [ ] Define failed-payment grace/dunning behavior and cancellation effective date.
- [ ] If Paddle is selected, document its Merchant-of-Record tax handling; if PayPal is selected, obtain accounting/legal guidance for tax, invoices, refunds, and required buyer information in launch markets.

**Gate:** provider sandbox/test webhooks cover subscribe, renew, fail, recover, cancel, refund, replay, and out-of-order delivery.

---

# Phase 5 - Trial and Referral Engine

## Task 5.1: One-day trial

- [ ] Grant exactly one server-side 24-hour entitlement when the first AI reply succeeds.
- [ ] Do not collect a card during trial and do not auto-convert the trial. At expiry, present Standard, Unlimited, and later-approved purchase options without blocking access to local data.
- [ ] Show exact trial end time and a reminder before expiry; never use misleading countdowns.
- [ ] Add low-friction anti-abuse checks and a support override/audit path.

## Task 5.2: Referral rewards

- [ ] Generate shareable invite links with non-enumerable codes.
- [ ] Bind inviter before the invitee's qualifying event; prohibit self-referral and referral reassignment.
- [ ] Grant the inviter seven days after the invitee completes registration and mandatory email verification.
- [ ] Allow unlimited legitimate accumulation while applying velocity/device/IP/email-domain risk checks, pending states, reversal rules, and manual review. Do not advertise an exploitable instant-credit guarantee.
- [ ] Show reward status transparently: pending, earned, rejected with support path, and expiry/extension dates.
- [ ] Publish referral terms and consent-compliant share copy; do not upload address books by default.

**Gate:** concurrent reward requests cannot double-grant; self-referral, replay, fake-account velocity, cancellation/refund, and cap tests pass.

---

# Phase 6 - Hosted AI Usage, Cost, and Safety Controls

## Task 6.1: Server-owned model gateway

- [ ] Remove end-user API-key entry from production UI; retain it only in local developer mode.
- [ ] Use server-owned DeepSeek credentials through a model-gateway module with timeout, retry, circuit breaker, and provider request IDs.
- [ ] Bound recent messages and memory by token budget before each call.
- [ ] Meter input/output tokens, latency, status, estimated provider cost, plan, billing month, and entitlement ID without storing chat text or secrets.
- [ ] Add per-user, per-IP, and global spend/rate limits plus emergency kill switch.
- [ ] Standard plan enforces a dynamic monthly provider-cost budget targeting USD 4, derived from actual token usage and versioned provider pricing rather than a permanently fixed token number.
- [ ] When the Standard allowance is exhausted, pause new hosted AI messages and show two voluntary actions: upgrade to Unlimited or buy a one-time additional usage package. Never silently lower reply quality.
- [ ] Implement top-ups as provider one-time products/prices and an append-only allowance ledger; webhook confirmation grants usage idempotently and refunds reverse unused allowance according to policy.
- [ ] Unlimited plan hides ordinary quota progress but still enforces anti-automation, account-sharing, denial-of-wallet, and emergency cost controls under a published fair-use policy.

## Task 6.2: Content and emotional-safety launch controls

- [ ] Add report/block controls, moderation escalation, crisis-response boundaries, and age-policy enforcement.
- [ ] Ensure billing state never enters companion prompts or relationship progression.
- [ ] Add prompt-injection and stored-content boundaries around memories and uploaded/profile data.

**Gate:** load/cost tests, quota race tests, provider outage drill, secret scan, prompt-boundary tests, and visible retry UX approval.

---

# Phase 7 - Announcements, Administration, and Operations

## Task 7.0: In-app announcement and inbox system

- [ ] Add an inbox icon with unread count while keeping the primary screen chat-first.
- [ ] Support global and segmented announcements, Chinese/English content, publish/expiry time, priority, CTA link, dismissibility, and mandatory notices.
- [ ] Add server pagination and per-user read/dismiss receipts; never place private support messages in a global announcement record.
- [ ] Use announcements for maintenance, feature releases, billing changes, referral rewards, and the local-versus-cloud data reminder.
- [ ] Sanitize rich content and restrict links to approved HTTPS destinations.

**Gate:** scheduled publish/expiry, locale fallback, unread count, read state, malicious HTML/link rejection, and mobile review pass.

## Task 7.1: Secure owner/admin console

- [ ] Use the same Supabase identity system but a separate `/admin` surface guarded by server-verified role records/claims. A hidden URL alone is never authorization.
- [ ] Bootstrap the owner's verified account through a one-time deployment allowlist or migration, then remove bootstrap access.
- [ ] Require MFA for owner/admin accounts, short sessions for sensitive actions, re-authentication, and login alerts.
- [ ] Define least-privilege roles: `owner`, `support`, `billing`, and `content`; default normal users have no admin capability.
- [ ] Add announcement publishing, user lookup, account status, entitlement adjustments, referral review, usage/cost dashboard, model health, feature flags, and maintenance controls.
- [ ] Record append-only audit events for admin logins and every mutation; require reason text for entitlement/account changes.
- [ ] Do not display raw passwords, provider keys, full payment data, or local-only chats/companions/memories. Admins cannot access data that was never uploaded.
- [ ] Give the owner account an explicit internal/testing entitlement rather than bypassing authorization or billing code paths.
- [ ] Maintain staging for updates and debugging; deploy reviewed releases to production with rollback and feature flags instead of editing production directly.

**Gate:** normal-user denial, role matrix, MFA, session expiry, audit log, privilege escalation, CSRF, and destructive-action confirmation tests pass.

## Task 7.2: Emails, analytics, and support

- [ ] Transactional emails: verification, reset, trial ending, payment receipt/failure, cancellation, referral earned, security notice.
- [ ] Privacy-configured analytics funnel: signup, first AI message, trial conversion, retention, referral qualification; never send chat text.
- [ ] Support channel, incident runbook, status page, backup/restore schedule, and alert ownership.

## Task 7.3: Legal, privacy, and release readiness

- [ ] Terms, privacy policy, subscription/refund/cancellation terms, referral terms, cookie/analytics consent, and AI disclosure.
- [ ] Data inventory, retention schedule, export/delete SLA, subprocessors, and breach-response process.
- [ ] Age policy and launch-market compliance review.
- [ ] Accessibility, performance, browser/mobile, SEO/social metadata, domain email authentication, and abuse-response QA.
- [ ] Staged rollout: internal -> invited beta -> limited production -> full launch, with rollback switches.

**Gate:** production checklist signed off, live-mode $1-equivalent test/refund if legally/account appropriate, restore drill, incident drill, and final browser approval.

---

## Testing Strategy

- Pure entitlement/referral/model policy modules use `node:test` with deterministic clocks.
- API integration tests run against local Supabase or an isolated staging project and the selected provider's sandbox/test mode.
- RLS tests always use at least two normal users plus an unauthenticated client.
- Webhook fixtures test duplicate, delayed, missing, and out-of-order events.
- End-to-end tests cover signup -> trial -> chat -> referral -> subscribe -> portal -> cancel -> export/delete.
- Production smoke tests never mutate real user data and never print secrets.

---

## Approved Product Decisions - 2026-07-28

1. International-first launch.
2. Email/password authentication with email verification required by the implementation.
3. Trial starts at the first successful AI conversation; users may attach a card and explicitly choose automatic conversion.
4. Referral reward is seven days for the inviter after registration/email verification; legitimate rewards have no published accumulation cap.
5. USD 10 Standard plan targets approximately USD 4 of provider usage per billing month; USD 20 Unlimited plan uses fair-use and emergency abuse controls.
6. Cloud sync includes vocabulary, birthday/profile metadata, preferences, and avatars. Chats, companions, and companion memories remain local and must be clearly disclosed.
7. Minors may use non-romantic companionship. The backend derives an eligibility flag; the product does not expose a stigmatizing "minor mode" label, while the age/privacy explanation remains transparent.
8. No domain or production cloud stack exists yet. Setup will be taught one managed provider at a time using the beginner runbook.
9. A secure owner/admin login and console is required for operation, announcements, support, monitoring, and controlled internal use.
10. The trial is card-free and never auto-renews. Payment details are requested only for a voluntary subscription or top-up purchase.
11. At the Standard usage limit, Wyth pauses new hosted AI messages and offers both Unlimited upgrade and one-time top-up purchase.
12. Email verification is mandatory before an inviter receives the seven-day referral reward.
13. Encrypted local export/import for chats, companions, and memories is required before commercial launch.
14. Initial launch uses the owner's platform-managed DeepSeek key. Public model switching is announced as temporarily unavailable so launch is not delayed by multi-provider product work.
15. A mainland-China individual cannot rely on a standard Stripe account. Payment development uses a provider-neutral adapter; Paddle application is preferred and PayPal China individual seller subscriptions are the fallback. No borrowed identity, false address, or shell overseas entity will be used.

## Risks and Remaining Decisions

Registration-triggered uncapped referrals are a major fraud/liability risk, so mandatory email verification, pending risk review, reversals, and operator alerts are required. "Unlimited" must mean normal human fair use rather than unlimited automated API consumption. Birthday data is sensitive cloud PII. Local-only chats/companions/memory require export/import and conspicuous device-loss disclosure. Silent fallback is unacceptable once users pay.

## Remaining Pricing Detail

The one-time top-up package price and included provider-cost allowance will be set after staging usage measurements. It must preserve a positive gross margin and display the granted allowance clearly before checkout; this operational price does not block Phase 0, authentication, cloud-sync, announcement, or admin development.

## Paddle Sandbox Catalog - 2026-08-12

- Standard: `pri_01kzszqc8792n88p0c90jd5r8c` (USD 10/month)
- Unlimited: `pri_01kzszytcn2m8wdsgbqeasyrbh` (USD 20/month, fair use)
- Neither Paddle price includes a Paddle-managed trial. Wyth grants its own one-day cardless trial after the first successful hosted AI reply.
- The identifiers are sandbox-only and do not authorize access; paid entitlements require a verified Paddle webhook tied to an authenticated Wyth user.

All architecture-blocking product decisions are now recorded. Implementation can begin with Phase 0 completion and Phase 1.0 cloud setup, with a browser/user review at every gate.
