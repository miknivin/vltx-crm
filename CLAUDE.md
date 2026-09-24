# VLTX CRM — agent orientation

This file is project instructions for Claude Code (or any future agent
session) opened in this directory. It exists so a fresh session doesn't have
to reconstruct this project's history from `git log` and code archaeology.
For step-by-step setup/deploy commands, see [SETUP.md](SETUP.md) instead —
this file is about *why things are the way they are*, not *how to run them*.

## What this is

The CRM for **VLTX**, a business that buys luxury assets (platinum, diamonds,
gemstones, jewellery, watches) from private sellers. Sellers submit a
valuation enquiry through the VLTX **website** (a separate, sibling project —
see "Related project" below); this CRM is where the team manages those
enquiries: pipeline, tasks, assignment, and an AI-driven filter/report tool.

This codebase started life as `free-nextjs-admin-dashboard` (TailAdmin
template) built out into a full CRM for a **previous, unrelated client** —
MongoDB-backed, with invoices/proposals/services/leave/calendar/telecalling
modules that had nothing to do with VLTX. It has been migrated in place: same
frontend framework and most UI components, but the database, domain model,
module scope, and AI filter are now VLTX-specific. That migration is why the
git history and some file/variable names still say "contact" where the
business now means "enquiry" — see "Naming: contact vs enquiry" below before
assuming that's a bug.

## Related project

The VLTX **website** (marketing site + valuation form) lives at
`D:\voltx`, a sibling directory, in its own separate git repository. The two
communicate only over HTTP — no shared code, no monorepo tooling. This CRM
used to live nested inside the website's folder (`D:\voltx\crm`); it was
moved out to `D:\voltx-crm` because the nesting confused Next.js's build
tooling (see "Build configuration" below) and made the two independent git
repos fragile to keep apart. If you see anything referencing the old nested
path, it's stale — fix it to point here instead.

## Tech stack

- Next.js 15 (App Router), TypeScript, Tailwind CSS, React 19.
- **PostgreSQL on Neon**, via **Prisma** (`prisma/schema.prisma`). Migrated
  from MongoDB/Mongoose — there is no Mongoose anywhere in `src/` any more; if
  you see an import of `mongoose` or `@/app/models/*`, it's leftover dead code
  to remove, not something to "fix" by reinstalling mongoose.
- Auth is **custom JWT + bcrypt**, httpOnly cookie
  (`src/app/lib/auth/`, `src/app/api/middlewares/auth.ts`). Not NextAuth, not
  Clerk, not Neon Auth — do not introduce one of those without being asked.
- Redux Toolkit + RTK Query for client state/data fetching.
- dnd-kit for the pipeline kanban board.
- AI filter uses the Vercel AI SDK (`ai`, `@ai-sdk/gateway`) — a planner model
  turns a natural-language question into a validated query pipeline, executed
  against Prisma, then an explainer model narrates the result. See
  "AI filter architecture" below.

## Naming: "contact" vs "enquiry"

The business object is an **enquiry**: one asset submitted for valuation. A
seller (**customer**) can submit several enquiries over time — they're
separate rows, not one contact with multiple deals. This split
(`Customer` + `Enquiry` models) replaced the previous client's single
`Contact` document.

Despite that, **API routes still live under `/api/contacts/*`** and many
response payloads use the key `contacts`. This is deliberate, not an
oversight: renaming every route would have meant touching every Redux
endpoint and every component that calls them, for zero behavioural gain.
Responses that return a list generally include both `contacts` and
`enquiries` keys pointing at the same data. When extending this API, follow
the existing convention (new list responses can just use `enquiries`, but
don't break the `contacts` key that existing consumers read).

Frontend types: `src/app/types/enquiry.ts` exports `SerializedEnquiry` as both
`IEnquiry` and `IContact` — components written before the migration import
`IContact` and it still resolves to the right shape.

## Module scope — what's here and what's deliberately gone

**Kept**, adapted to the enquiry domain: enquiries (contacts), pipelines &
stages, tasks, users/auth, the AI filter, the dashboard, sources, company
settings.

**Deliberately removed**, along with their routes/components/Redux
slices/dependencies: **invoices, proposals, a services catalogue, leave
management, a calendar module, and "contact responses"** (a call-outcome log
for the previous client's telecalling workflow — `HAD_CONVERSATION`,
`CALLED_NOT_PICKED`, etc. — with no VLTX equivalent).

If a future request implies bringing one of these back ("add an invoicing
page", "what happened to the calendar?"), that's a scope decision for the
user to make explicitly — it was cut on purpose, not missed.

## Key files (read these before changing filter/AI behaviour)

- `prisma/schema.prisma` — the schema. `Customer` (the seller) and `Enquiry`
  (one asset) are separate; enquiry carries pipeline placement
  (`PipelineEntry`), assignment (`EnquiryAssignment`), tags, activity log,
  remarks, and photos.
- `src/app/lib/enquiry/constants.ts` — **single source of truth** for every
  enum↔label mapping (asset category, jewellery type, shape/cut, condition,
  certificate lab, preferred contact). The website form, this CRM's UI, and
  the AI filter all read from here. Add a new option here, not in three
  places.
- `src/app/lib/enquiry/serialize.ts` — `ENQUIRY_INCLUDE` (the Prisma
  `include` every enquiry query should reuse) and `serializeEnquiry` (the
  canonical wire shape, keyed on `_id` for frontend compatibility).
- `src/app/lib/enquiry/createEnquiry.ts` — the **one place** an enquiry is
  created from raw form-shaped input (labels like `"Loose Diamond"`, not
  enum values). Used by the manual "add enquiry" form, bulk import, **and**
  the website's intake webhook. Extend this, don't duplicate its logic.
- `src/app/lib/enquiry/buildFilterWhere.ts` — turns the filter drawer's
  payload into a `Prisma.EnquiryWhereInput`. Shared by the enquiry list, the
  enquiry filter endpoint, and both pipeline-board endpoints (by-stage,
  by-pipeline) — this is what guarantees a saved filter means the same thing
  everywhere. If you add a new filter field, add it here once.
- `src/app/classes/EnquiryFilterBuilder.ts` — replaces the old
  `MongoFilterBuilder`. `ENQUIRY_FIELD_SPECS` is the field allowlist; a field
  not listed here can never be filtered on, including by the AI planner.
- `src/app/classes/EnquiryAggregationBuilder.ts` — replaces
  `ContactAggregationBuilder`, for counts/grouping/sums used by the dashboard
  and the AI filter's `aggregateEnquiries` tool.
- `src/app/lib/ai/toolSpecs.ts` — **single source of truth** for the AI
  filter's tool surface. The planner prompt and the server-side validator are
  both generated from this file, so they cannot drift. The filterable-field
  list is derived from `EnquiryFilterBuilder`'s own map — a column becomes
  AI-reachable only by being added to the builder.

## Auth & authorization pattern

Roles: `user | employee | team_member | admin`. When scoping a query to "not
an admin", the codebase uses `role !== "admin"`, **not**
`role === "team_member"`. This is deliberate — the earlier, narrower check
was a real bug (any `user`/`employee` role saw the whole database) fixed
mid-migration. Keep using the `!== "admin"` form in new code.

## Website integration (valuation form intake)

The website's `ValuationForm` uploads photos straight to S3 (presigned PUT,
generated by the **website's own** `/api/uploads/presign` — not this CRM's),
then POSTs the completed form to the website's own `/api/valuation` route,
which forwards server-to-server to **this CRM's**
`POST /api/webhooks/valuation`, authenticated by an `x-vltx-signature` header
that must equal `VALUATION_INTAKE_SECRET` — the same value must be set in
both projects' env files, or intake silently 401s.

**As of this writing, the website is not pointed at a deployed CRM** — its
`CRM_API_URL` is a `http://localhost:3001` placeholder for local testing.
Update it once this CRM has a real deployment URL. Both apps' AWS credentials
currently point at the **same S3 bucket** (`sytro-user-uploaded-images` —
name is a leftover from the previous client, contents are VLTX's), so this
CRM can render enquiry photos the website uploaded without any additional
wiring.

## Build configuration — don't remove these without understanding why

`next.config.ts` has:
- `outputFileTracingRoot: path.join(__dirname)` — a safety net from when this
  project was nested inside the website's directory and Next misdetected the
  workspace root from the sibling's lockfile. Harmless now that this is a
  sibling directory, but leave it.
- A custom `webpack()` hook adding `@svgr/webpack` for `.svg` imports. Every
  icon in `src/icons/index.tsx` (50+) is imported as `./name.svg` and turned
  into a component by this loader. **Turbopack does not run this hook at
  all** — do not switch the build to `--turbopack` without first migrating
  this to Turbopack's own SVGR rule config, or every icon breaks silently.

## A recurring environment bug on this machine — read this before panicking over TS errors

`npm install` on this machine has repeatedly produced **silently incomplete
package extractions** — `npm` reports success (exit 0), but some packages end
up missing their `.d.ts` type stubs, or (once) a native binary is truncated.
This has hit `csstype`, `@prisma/client`, `@aws-sdk/client-s3`,
`html2canvas-pro`, `yet-another-react-lightbox`, `bcrypt` (its compiled
`.node` binding), and `@next/swc-win32-x64-msvc` (the Next.js compiler
itself) at various points during this project's migration.

**Symptom:** a sudden wall of `error TS7016: Could not find a declaration
file for module 'x'` across many unrelated files, or (for the SWC case) a
build that mysteriously takes several times longer than it should, or a
runtime `Cannot find module '.../bcrypt_lib.node'` crash.

**Fix:** `rm -rf node_modules/<package>` then `npm install <package>` to force
a clean re-extraction of *that one package*. A full `rm -rf node_modules &&
npm install` sometimes reproduces the same failure rather than fixing it.
**`npx prisma generate` does NOT fix missing `@prisma/client` type stubs** —
those ship in the npm tarball itself; regenerating the client doesn't create
them.

If you hit a wave of type errors that look environmental rather than
code-related, check `node_modules/<suspect-package>` for missing `.d.ts`
files or an implausibly small binary before assuming the code is wrong.

## Database & deployment status

- Neon Postgres project is provisioned, migrated (`prisma/migrations/`), and
  seeded (admin user, a "Valuation Pipeline" with 7 stages, 7 default
  sources). Connection strings live only in `.env.local` (gitignored) —
  never commit them, never put them in a markdown file.
- To reset the seeded admin's password: the seed script's `upsert` uses
  `update: {}` for the admin user, so **re-running `npm run db:seed` will
  not change an existing admin's password**. Update it directly (Prisma
  Studio, or a short one-off script) instead.
- `npm run build` is `prisma migrate deploy && next build` — migrations apply
  automatically on every deploy. `postinstall` runs `prisma generate`
  (needed because Vercel caches `node_modules` between deploys).
- **Not yet deployed to Vercel.** Deployment target is Vercel per the user's
  instruction; nothing has been pushed there yet.

## Git status — read before touching git

This repo's `origin` remote is still
**`https://github.com/miknivin/LSH-CRM.git`** — the **previous client's**
repository — on branch `main`. All migration work (Prisma schema, the whole
Postgres rewrite, module cuts, AI filter rewrite, website intake wiring) is
currently **uncommitted local changes**. The user has not yet decided whether
this goes on a new branch of that remote, a new repository, or a new remote
entirely.

**Do not commit or push without asking the user which destination they
want**, even if asked to "commit this" in passing — confirm the target first
given the remote currently points somewhere unrelated to VLTX.
