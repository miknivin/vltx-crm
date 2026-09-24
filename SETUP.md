# VLTX CRM — setup

The CRM manages valuation enquiries submitted through the VLTX website form.
It runs on Next.js 15 with PostgreSQL (Neon) via Prisma.

## 1. Create the Neon database

1. Sign in at <https://console.neon.tech> and create a project (the free tier
   is enough — the CRM has 2–3 users).
2. From the project dashboard, copy **both** connection strings:
   - the **pooled** one (host contains `-pooler`) → `DATABASE_URL`
   - the **direct** one (no `-pooler`) → `DIRECT_URL`

Prisma needs the direct string because migrations run DDL, which cannot go
through the connection pooler.

## 2. Configure environment

```bash
cp .env.example .env.local
```

Fill in at minimum:

| Variable              | Notes                                            |
| --------------------- | ------------------------------------------------ |
| `DATABASE_URL`        | Neon pooled connection string                     |
| `DIRECT_URL`          | Neon direct connection string                     |
| `JWT_SECRET`          | any long random string — `openssl rand -hex 32`   |
| `SEED_ADMIN_EMAIL`    | the login you want for the first admin            |
| `SEED_ADMIN_PASSWORD` | the seed refuses to run without one               |
| `AI_GATEWAY_API_KEY`  | needed only for the AI filter                     |
| `AWS_BUCKET_NAME`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | same S3 bucket the website uploads enquiry photos to — needed to render them in the enquiry detail page's photo gallery |
| `VALUATION_INTAKE_SECRET` | must be **identical** to the same-named variable in the website's env — see "Website integration" below |

## 3. Create the schema and seed

```bash
npm run db:deploy   # applies prisma/migrations to the Neon database
npm run db:seed     # admin user + Valuation Pipeline + stages + sources
```

The seed prints the pipeline and first-stage ids. Copy them into `.env.local`
as `DEFAULT_PIPELINE` / `NEXT_PUBLIC_DEFAULT_PIPELINE` and `DEFAULT_STAGE` /
`NEXT_PUBLIC_DEFAULT_STAGE`.

To inspect the data at any point: `npm run db:studio`.

## 4. Run

```bash
npm run dev
```

## Schema shape

The old CRM's single `Contact` collection is split in two, because one seller
can bring several assets over time:

- **`customers`** — the person: name, mobile (unique — the dedupe key at
  intake), email, city, preferred contact channel.
- **`enquiries`** — one asset submitted for valuation: category and the
  per-category fields the website form collects (jewellery type, brand, metal
  weight, carat, shape/cut, condition, certificate + lab, purchase year,
  description), plus the internal valuation fields (`estimatedValue`,
  `offeredAmount`, `valuedAt`, `valuedBy`).

The enquiry — not the customer — is what sits on the pipeline board, carries
tags and assignments, and is what tasks link to.

Mongo's embedded arrays became tables: `enquiry_assignments`, `enquiry_tags`,
`enquiry_activities`, `enquiry_remarks`, `enquiry_photos`, `pipeline_entries`,
`task_assignments`. The activity cap and `ActivityArchive` collection are gone
— rows are indexed and cheap, which was the reason for leaving the embedded
array in the first place.

Stage names seeded for the valuation workflow: New Enquiry → Contacted →
Valuation In Progress → Offer Made → Negotiation → **Purchased** (`isSuccess`)
→ Not Proceeding.

## What was removed

Invoices, proposals, the services catalogue, leave management, the calendar,
and contact responses (the previous client's telecalling outcome log) are gone
— along with their routes, components, models and Redux slices.

The filter drawer's "activities" section, which filtered on those call
outcomes, is replaced by valuation filters: category, condition, certificate
and lab, brand, carat/metal weight/purchase-year ranges, estimated-value
range, valuation status, outcome and assignment state. The same filter payload
drives the enquiry list and the pipeline board, so a saved filter means the
same thing in both.

## API surface

Route paths still say `contacts` — the records they serve are enquiries. The
paths were left alone deliberately: renaming them would have churned every
component and Redux endpoint without changing behaviour. Responses carry both
`contacts` and `enquiries` keys where a list is returned.

`POST /api/webhooks/valuation` accepts a submission from the website form,
gated on the `x-vltx-signature` header matching `VALUATION_INTAKE_SECRET`.

## Website integration

The website is wired to this endpoint: its valuation form uploads photos
straight to S3 (its own presigned-upload route, same bucket this CRM reads
from), then its own `/api/valuation` route forwards the completed form
server-to-server to this CRM's `/api/webhooks/valuation`. Enquiry photos
appear in this CRM's enquiry detail page (a thumbnail grid with a
click-to-zoom lightbox).

Two things must line up between the two projects' env files:

- `VALUATION_INTAKE_SECRET` — identical value in both, or intake 401s.
- The website's `CRM_API_URL` must point at wherever this CRM is actually
  reachable (a local dev port for testing, or this CRM's production URL once
  deployed). It is **not** set to a production URL yet.

## AI filter

`src/app/lib/ai/toolSpecs.ts` remains the single source of truth: the planner
prompt and the server-side validator are both generated from it, so what the
model is told and what the server enforces cannot drift.

The filterable-field list is derived from `EnquiryFilterBuilder`'s own field
map, so a column can only become AI-reachable by being added to the builder.
Ids are UUIDs now, validated as such. Mongo's projection rule became a display
-columns rule: the query always returns the full record and `columns` controls
only what the table shows, so narrowing can never hide a field the explainer
needs — while still guaranteeing that every filtered field is visible for the
person to check the answer against their question.

## Deploying to Vercel

Set the same environment variables in the Vercel project. The build command is
already `prisma migrate deploy && next build`, so migrations apply on deploy,
and `prisma generate` runs from the `postinstall` hook (Vercel caches
`node_modules`, so the client would otherwise go stale).
