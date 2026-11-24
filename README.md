# Commission Tracker

A simple commission book for solo creators (woodworkers, artists, makers) who take commissioned work: every job, what stage it's in, when it's due, what it's worth, and what's still owed.

This repo contains everything: AWS infrastructure (CDK), the React web app, and the Lambda backend.

> **Status:** Design locked. Implementation starts at MVP step 0. See the [Progress](#progress) checklist below.

---

## Key decisions

| Area | Decision |
|---|---|
| Frontend | React + Vite + TypeScript, hosted on S3 + CloudFront (default `*.cloudfront.net` URL; no custom domain yet) |
| Login | Cognito User Pool + "Sign in with Google" (Hosted UI) |
| API | API Gateway HTTP API with a Cognito JWT authorizer on every route, and one Lambda per resource |
| Database | DynamoDB, with a separate table per entity |
| Validation | zod schemas in a shared package used by both the web app and the API |
| Infra | AWS CDK (TypeScript), one stack, one environment (prod) |
| Deploy | `npm run deploy` from a local machine, no CI/CD for now |
| Accounts | One user per business for now. Data is keyed by `businessId` and users carry a `role`, so team members can be added later |
| Stages | User-customizable (rename and recolor) |

---

## Product roadmap

### MVP (free)
- Google login, with each user getting their own dashboard.
- Create and edit commissions manually.
- Track projects on the dashboard: stage board, timeline, and money overview.
- Record payments and expenses manually. These feed the revenue and expense cards.

### Premium (~$10/mo+, tiered by commission volume)
- **Phase 2:** Email sync. Each business gets a unique forwarding address (`SES inbound → S3 → SQS → parser Lambda`). Claude Haiku extracts the client, item, budget and deadline, and the result lands in an **Inbox** where the user can accept or ignore it. Other channels may come later. ⚠️ SES inbound needs a domain we control, so we pick one in this phase.
- **Phase 3:** A hosted public commission request page that clients can submit, plus payment links (Stripe Connect).
- **Phase 4 (optional):** Link a bank or credit card (Plaid or similar) to track expenses automatically.

### Prepared in the MVP for later phases
The MVP doesn't build these features, but it adds the fields they will need:
- `Businesses` gets `plan` (`free`), `planStatus` and `billingCustomerId` for future Stripe billing. There is no paywall code in the MVP.
- `Businesses` gets an optional unique `slug` for the future public request page URL.
- Commissions get a `source` field (`manual` | `email` | `form`).
- Payments get an optional `externalRef` for Stripe or bank IDs.

---

## Features

### Core concepts
- **Business:** Created on first Google sign-in. Optional fields: name, tagline, website, logo, currency, timezone, social links, and stage configuration. The dashboard header shows the business name.
- **User / membership:** A Google-login user belongs to one business and has a role (`owner` for now, `member` later).
- **Client:** Name, email, phone and notes. Can be created inline from a commission and reused across jobs.
- **Commission (job):** Title, client, description, stage, quoted price, deposit, due date, tags, reference files, notes, source, and timestamps.
- **Stages:** Defaults are New request → Quoted → In progress → Finishing → Delivered, plus the archive stages Declined and Cancelled. Stages can be renamed (for example, "In the shop") and recolored. A "request" is simply a commission in the first stage.
- **Payment:** Amount, date, method, and type (deposit / partial / final). Linked to a commission.
- **Expense:** Amount, date, category, vendor, receipt image, and an optional link to a commission.
- **Activity:** A log for each commission of stage changes, payments, and similar events.

### Screens
1. **Dashboard:**
   - Open jobs.
   - Commission requests, including how long the oldest has been waiting.
   - Expenses and revenue this month, with the change vs last month.
   - A jobs-by-stage bar, the timeline, and the latest commissions.
2. **Stage board:** A kanban board with drag-and-drop.
3. **Commissions list:** Search and filters (stage, client, overdue, balance owed). Shows the balance owed on each job.
4. **Commission detail:** Price, deposit, paid and balance, plus payments, expenses, files, notes and activity.
5. **Timeline:** All deadlines grouped by week, with overdue items highlighted.
6. **Money:** Payments and expenses tabs, a month filter, receipt upload, and CSV export.
7. **Clients:** List and detail views, with each client's jobs and lifetime value.
8. **Settings:** Business profile (name, website, etc.) and stage customization.

---

## Architecture

```
Browser (React SPA) ──► CloudFront ──┬─► S3 (static site)          /*
     │                               └─► API Gateway HTTP API      /api/*  (same domain, so no CORS)
     │
     └─► Cognito Hosted UI ("Sign in with Google") ─► JWT (sent as Authorization: Bearer)

API Gateway HTTP API
           ├─ Cognito JWT authorizer on every route (bad/missing tokens never reach our code)
           └─ routes → one Lambda per resource
                 /me, /business        → business-fn
                 /clients/*            → clients-fn
                 /commissions/*        → commissions-fn
                 /payments/*           → payments-fn
                 /expenses/*           → expenses-fn
                 /dashboard            → dashboard-fn
                 /uploads (presign)    → uploads-fn
                         │
                         ├─► DynamoDB tables
                         └─► S3 uploads bucket (presigned URLs)
```

- **Auth:**
  - The Cognito domain is a Cognito-provided prefix (`<name>.auth.<region>.amazoncognito.com`).
  - On a user's first API call, the API creates their Business and owner User records. This is a single conditional DynamoDB transaction, so it's safe if two calls arrive at once. It's more reliable than a Cognito trigger, which doesn't always fire for Google sign-ins.
  - Each Lambda reads the user id (`sub`) from the verified token, looks up the user's `businessId` and role, and scopes every query to that business.
- **Google OAuth client:** This is a one-time manual setup step. The client is created in Google Cloud Console, and its id and secret are stored in SSM Parameter Store, where CDK reads them.
- **Web:**
  - React Router for pages and TanStack Query for data fetching and caching.
  - Tailwind with the dark theme from the mockup.
  - `dnd-kit` for the stage board.
  - `oidc-client-ts` for the login redirect.
- **Files:** A private S3 bucket accessed through presigned URLs. Keys follow the pattern `businesses/<businessId>/...`.

### Data model (DynamoDB, one table per entity)
All business data is partitioned by `businessId`, not by `userId`. Adding a second user later only requires a new `Users` row that points at the same business.

| Table | PK | SK | GSIs / notes |
|---|---|---|---|
| `Businesses` | `businessId` | — | name, website, tagline, logoKey, currency, timezone, stages[], plan, planStatus, billingCustomerId, slug (GSI `bySlug`) |
| `Users` | `userId` (Cognito sub) | — | email, name, `businessId`, `role`; GSI `byBusiness` |
| `Clients` | `businessId` | `clientId` | |
| `Commissions` | `businessId` | `commissionId` | GSI `byStage` (businessId, stage#updatedAt); GSI `byDueDate` (businessId, dueDate) |
| `Payments` | `businessId` | `date#paymentId` | The date prefix allows month-range queries; GSI `byCommission` |
| `Expenses` | `businessId` | `date#expenseId` | Same pattern; GSI `byCommission` |
| `Activity` | `commissionId` | `timestamp` | |

Additional details:
- IDs are ULIDs, so they sort by creation time.
- Money is stored as integer cents.
- Tables use on-demand billing with point-in-time recovery.

### Validation (zod)
Every form has rules such as "title is required" and "price must be ≥ 0". The browser checks them so the user gets instant feedback. The API checks them again because anyone can call it directly. Each rule set is written once as a zod schema in `packages/shared`, which gives both the runtime check and the TypeScript type. The web app and the Lambdas import the same schemas, so the two never drift apart.

---

## Repo layout (npm workspaces)

```
apps/web/          React SPA
services/api/      Lambda handlers: business, clients, commissions, payments, expenses, dashboard, uploads
packages/shared/   zod schemas + TS types, money/date helpers
infra/             CDK app: bin/app.ts, lib/stack.ts (constructs for auth, data, api, web)
docs/              setup.md (Google OAuth + first deploy steps)
```

**Deploy:** `npm run deploy` builds `apps/web` and then runs `cdk deploy`.
- CDK uploads the site and invalidates the CloudFront cache.
- CDK also writes `config.json` (API URL and Cognito ids) into the site bucket, so the web app needs no manual config.

---

## Progress

### MVP
- [x] **Step 0:** Monorepo scaffold, CDK stack, Google login working end-to-end, first login creates the Business and owner User, profile settings (name, website) _(Google sign-in turns on once the OAuth client is added, see docs/setup.md)_
- [x] **Step 1:** Clients and commissions CRUD, custom stages, stage board, commission detail
- [x] **Step 2:** Manual payments and expenses, receipt uploads, dashboard metrics with month-over-month change, Money page
- [x] **Step 3:** Timeline, Clients page, visual polish to match the mockup, mobile layout

### Premium
- [ ] **Phase 2:** Email forwarding sync and Inbox
- [ ] **Phase 3:** Public request page and payment links
- [ ] **Phase 4:** Bank/card expense sync (optional)

---

## Testing
- `npm test` runs the Vitest unit tests: money/date helpers, the validation schemas, the DynamoDB update builder, and the dashboard math (checked against the mockup's numbers).
- `npm run typecheck` checks every package, and `npm run synth` builds and synthesizes before a deploy.
- `node scripts/invoke.mjs <handler> "<METHOD /api/path>" [body]` calls a deployed Lambda directly as a simulated signed-in test user (`test-user-0001`). You can test the API this way without signing in with Google.
- Manual end-to-end check: Google sign-in → business created → set the name → create a client and a commission → drag it across stages → record a payment and an expense → confirm the dashboard numbers match.
