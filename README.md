# Pinch

**Precision budgeting for real life.** Pinch is an envelope-based, zero-based budgeting workspace: give every dollar a job, track category envelopes, import transactions, automate categorisation, and stay ahead of recurring bills.

Built with **Next.js 16**, **React 19**, **Convex**, **Clerk**, and **Tailwind CSS 4**.

---

## Table of contents

- [What Pinch does](#what-pinch-does)
- [Screens and features](#screens-and-features)
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [Project structure](#project-structure)
- [Data model](#data-model)
- [Money and date conventions](#money-and-date-conventions)
- [Backend API map](#backend-api-map)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Available scripts](#available-scripts)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)
- [Known limitations and rough edges](#known-limitations-and-rough-edges)
- [Contributing](#contributing)

---

## What Pinch does

Pinch is a single-user budgeting app with per-user data isolation. Each signed-in Clerk user gets their own categories, envelopes, transactions, rules, budgets, recurring items, payment methods, and accounts.

Core ideas:

- **Envelopes** — every outflow category has a budget envelope with a target, an assigned amount, and a spent amount.
- **Ready to Assign** — the gap between income and what has already been assigned. Ideally it reaches zero once every dollar has a job.
- **Transactions** — negative amounts are outflows, positive amounts are inflows. Transactions can be categorised, tagged, split across categories, and marked pending / cleared / reconciled.
- **Rules** — first-match automation that can set a category, rename a payee, and add tags when new or imported transactions arrive.
- **Recurring** — weekly, biweekly, monthly, or annual bills and income, with occurrence tracking, mark-paid, and pattern detection from transaction history.
- **CSV import** — map any bank export, preview rule effects and duplicate detection, then import in bulk.
- **Responsive UI** — desktop sidebar, mobile floating dock, light/dark/system themes, and a quick-view sheet for any category.

> **First run:** Pinch does not seed categories, payment methods, or accounts. A new user starts with an empty workspace and must create categories and a payment method before adding transactions. See [First-run checklist](#6-first-run-checklist).

---

## Screens and features

### `/` — landing page

- Marketing/intro screen with **Sign in** and **Create account** actions.
- Signed-in visitors are redirected to `/dashboard`.

> The landing page's **Create account** link currently points at `/signup`; the actual route is `/sign-up`. See [Known limitations](#known-limitations-and-rough-edges).

### `/login` and `/sign-up`

- Clerk-hosted authentication with a customised Pinch appearance.
- Sign-in, sign-up, and fallback redirects are configured to `/dashboard` via environment variables.

### `/dashboard` — monthly overview

- Month selector with previous/next navigation and “back to current month”.
- Income and expenses for the selected month.
- Expense composition bar broken down by top-level category, with tooltips.
- **Ready to Assign** card: income minus the total assigned across envelopes.
- **Breakdown** panel:
  - Income grouped by payee.
  - Expenses grouped by parent category, expandable to show child categories.
  - Clicking a leaf category opens its quick view.
- **Upcoming Recurring** list with mark-paid actions and a link to `/recurring`.
- **Needs attention** panel covering overspent envelopes, underfunded envelopes, and uncategorised expenses.
- **Auto-Assign** and **Demo** are placeholders (toast / video placeholder).

### `/budget` — month-scoped budget grid

- Month navigation using the `YYYY-MM` month key.
- **Left to budget** banner: month income minus the amount budgeted in that month.
- Grouped grid of outflow categories:
  - Parent rows aggregate their leaf categories.
  - **Budgeted** is editable per leaf category and month.
  - **Activity** is the absolute value of outflow transactions in that month.
  - **Available** is cumulative assigned minus cumulative activity from the earliest month with data.
- Editable cells accept plain amounts and expressions:
  - `$1,234.56`
  - `1.5k`
  - `500 + 250`
  - `(1000/4)*5`
- Assignments are stored as integer cents in the `budgets` table, keyed by category and month.
- Edits are optimistic in the UI and persisted through `budgets.setAssignedAmount`.

### `/envelopes` — Categories

- Tree of top-level categories and subcategories.
- Columns: funded / target, progress, status, and actions.
- Status states: **Overspent**, **Fully funded**, or the remaining amount to target.
- Per-row actions: quick view, fill to target, pin/unpin, and a share placeholder.
- A category filter and a sort menu are present; the sort control is currently display-only.
- Empty state points users to Settings to create categories.

### `/transactions` — transaction list

- Search by payee or tag.
- Filter by top-level category.
- “Uncategorized only” toggle.
- Tag chips for filtering; click a tag on a row to filter by it.
- Status dots: pending, cleared, reconciled.
- Split transactions are labelled `split`.
- Per-row actions:
  - Create a rule from the payee (with optional apply-to-existing).
  - Edit the transaction.
- Bulk actions on selected rows:
  - Categorise.
  - Add tags.
  - Delete (two-step confirmation: Delete → Confirm delete).
- Inline categorisation for uncategorised outflows.
- **Import CSV** button links to `/transactions/import`.
- New transactions can be added from the header button or the mobile dock’s centre button.

### `/transactions/import` — CSV importer

A three-step wizard:

1. **File & mapping**
   - Drop or select a `.csv`; the first row is treated as headers.
   - Column guesses are based on header names (date, payee/description/merchant, amount, debit, credit, category, note/memo).
   - Supports either a single signed amount column or separate debit/credit columns.
   - Optional category mapping by category name and optional notes.
   - Dates are normalised from ISO or `M/D/YYYY`-style input.
   - Amounts support currency symbols, commas, spaces, parentheses for negatives, and leading minus signs.
   - The chosen mapping is remembered in `localStorage` under `pinch:import-mapping:<header signature>`.
2. **Preview & dedupe**
   - Shows parsed rows, rule effects, and a duplicate count.
   - Duplicate detection uses a SHA-256 hash of `date|amount|payee` stored on imported transactions.
   - Rows can be individually skipped or skipped in bulk.
3. **Import**
   - Choose a default **paid from** method.
   - Imported rows are created as `cleared`; rules are applied; envelopes are incremented.
   - Duplicate hashes are skipped again server-side.
   - Reports imported and skipped counts.

### `/rules` — automation rules

- Rules run in ascending priority order; the **first match wins**.
- Conditions:
  - Field: `payee`, `rawPayee` (original payee before cleanup), or `amount`.
  - Operator: `contains`, `equals`, `starts_with`, `greater_than`.
  - `greater_than` compares the absolute transaction amount.
- Actions:
  - Set category.
  - Rename payee.
  - Add tags.
- Create, edit, delete, and reorder rules (up/down).
- Rules apply to new and imported transactions.
- “Apply to past matching transactions” is available when creating a rule from a transaction; it is off by default elsewhere.

### `/recurring` — bills and subscriptions

- Recurring items can be expenses or income.
- Frequencies: weekly, biweekly, monthly, annual.
- Each item tracks a start date, category, tags, payment method, notes, active/paused state, paid occurrences, and last paid date.
- Summary cards: active items, projected monthly outflow, next 7 days (with overdue count).
- Grouped list: Overdue, Due soon, This month, Later, Paused.
- **Mark paid**:
  - Creates a real transaction using the recurring item’s details.
  - Applies category rules through the shared transaction insert helper.
  - Records the occurrence date and transaction ID.
  - If a past date is supplied, it advances to the next upcoming unpaid occurrence. The UI passes the item’s next due date.
- **Detected from your transactions**:
  - Looks at expense transactions grouped by normalised payee.
  - Requires at least 3 occurrences.
  - Uses the median gap between transactions and tolerates 25% for weekly/biweekly, ±5 days for monthly, and ±15 days for annual.
  - Returns up to 12 suggestions, highest confidence first.
  - Skips payees that already have a recurring item.
- Occurrence windows cover 60 days back and 90 days ahead.

### `/targets` — funding goals

- One card per envelope with assigned / target and a progress bar.
- Shows the remaining gap or “Target met”.
- **Fund** assigns exactly the remaining gap.

### `/reports` — spending by group

- Spending grouped by top-level outflow category, with child categories broken out.
- Bars are coloured from the chart palette and animate in unless reduced motion is preferred.
- Current footer copy has a known rough edge (it displays income in the “Total spent” line).

### `/accounts` — accounts and net worth

- Read-only list of accounts and their balances.
- Net worth is the sum of balances; negative balances are shown in the error colour.
- **Refresh balance** is a placeholder toast — there is no bank sync or balance refresh integration.
- Accounts can only be created directly in the Convex dashboard today; there is no account mutation in the app.

### `/settings` — preferences and configuration

- **Appearance**: light, dark, or system theme. Persisted in `localStorage` under `pinch-theme` and applied before hydration to avoid a theme flash.
- **Preference switches**: overspend alerts, weekly digest, and rollover. These are local component state only and are not persisted.
- **Payment methods**: list, add, and remove custom methods. Methods flagged `builtIn` cannot be removed.
- **Categories & Envelopes**: add, edit, and delete categories and subcategories, including parent, kind (outflow/inflow), colour slot, accent, and icon.
  - Deleting a category with subcategories is blocked.
  - Creating an outflow category automatically creates its envelope.

### `/profile` — profile form

- Displays the Clerk user’s name and email.
- Validation is client-side.
- **Save changes** currently shows a toast only; changes are not written to Clerk or Convex.

### Global UI

- **Header**: page title and subtitle, global search across categories and transactions, notifications for overspending/uncategorised items, theme toggle, new transaction button, and Clerk user button.
- **Quick view sheet**: opens for any category, even one without an envelope. Shows funded/target, spent, percentage funded, editable monthly budget, +$25/+$50/+$100 assign buttons, fill-to-target, pin, share placeholder, add-spend dialog, and recent activity.
- **Mobile dock**: Home, Categories, Activity, Reports, plus a central new-transaction button.
- **Toasts**: success and failure feedback via Sonner.

---

## Tech stack

| Layer | Technology |
| --- | --- |
| Framework | Next.js `16.4.3` (App Router) |
| UI | React `19.2.4`, Radix UI primitives, Lucide icons, Sonner toasts |
| Styling | Tailwind CSS 4, `tw-animate-css`, CSS custom-property design tokens |
| Tables | TanStack React Table `8.21.3` |
| Backend | Convex `1.43.0` (queries, mutations, HTTP actions) |
| Auth | Clerk `@clerk/nextjs` `7.6.4` + `convex/react-clerk` |
| Language | TypeScript 5 (strict mode) |
| Dates | `date-fns` |
| Fonts | Hanken Grotesk, JetBrains Mono, Material Symbols Outlined |
| Linting | ESLint 9 + `eslint-config-next` |
| Runtime | Node.js `>=20.9.0` |

No test runner, test files, or CI workflow is configured.

---

## Architecture

```
Browser
  │
  ├── Next.js App Router (app/)
  │     ├── Clerk session + route protection (proxy.ts, app/(app)/layout.tsx)
  │     └── client components under app/(app)/*
  │
  └── Convex React client (src/components/ConvexClientProvider.tsx)
        │  authenticated with the Clerk token
        ▼
      Convex deployment (convex/)
        ├── queries + mutations in convex/functions/*
        │     └── every call resolves the current user via Clerk identity
        ├── schema + indexes (convex/schema.ts)
        └── HTTP router (convex/http.ts)
              └── POST /clerk-webhook ← Clerk user events
```

Key points:

- **Authentication** is handled by Clerk middleware in `proxy.ts`; protected app routes are enforced server-side by the redirect in `app/(app)/layout.tsx`.
- **Authorisation** is per function: `getCurrentUserOrThrow` reads the Clerk identity, finds the matching `users` row by `clerkUserId`, and every query/mutation scopes its reads and writes to that user.
- **User sync** happens through the Clerk webhook. Until a user exists in the `users` table, authenticated Convex calls fail with “User not found in database.”
- **Realtime updates** come for free from Convex queries: creating a transaction updates envelopes, budgets, reports, and the dashboard reactively.
- `convex/_generated/` is generated by the Convex CLI; do not edit it by hand.
- Next.js 16 uses **`proxy.ts`** instead of `middleware.ts`. Keep the Clerk middleware in `proxy.ts`.

---

## Project structure

```
app/
  (app)/
    layout.tsx                 # auth guard + persistent mobile dock
    dashboard/page.tsx         # monthly overview
    budget/page.tsx            # month-scoped budget grid
    envelopes/page.tsx         # categories board
    transactions/page.tsx      # transaction list + bulk actions
    transactions/import/page.tsx
    rules/page.tsx
    recurring/page.tsx
    targets/page.tsx
    reports/page.tsx
    accounts/page.tsx
    settings/page.tsx
    profile/page.tsx
  login/[[...login]]/page.tsx
  sign-up/[[...sign-up]]/page.tsx
  layout.tsx                   # fonts, providers, metadata, theme bootstrap
  page.tsx                     # landing page
  providers.tsx                # theme + quick-view providers
  globals.css                  # Tailwind entry + design tokens

src/
  components/
    budget/                    # budget table, editable cell, income banner
    dashboard/                 # dialogs, envelope board, quick view, pickers
    layout/                    # app shell, sidebar, header, mobile dock, theme toggle
    settings/                  # category manager
    ui/                        # shared primitives
  hooks/
    use-budget-data.ts         # all Convex queries/mutations + lookup helpers
  lib/
    budget-utils.ts            # cents parsing/formatting and expression parser
    categories.ts              # static category seed used by mock data helpers
    mockData.ts                # shared types, palette labels, currency formatters
    month.ts                   # month windows and month keys
    quick-view.tsx             # quick-view context
    theme.tsx                  # theme context + no-flash bootstrap script
    utils.ts                   # class-name helper
    styles.css                 # design tokens and utility classes

convex/
  schema.ts                    # tables + indexes
  auth.config.ts               # Clerk JWT issuer configuration
  http.ts                      # Clerk webhook route
  functions/
    users.ts                   # current-user lookup + Clerk sync mutations
    categories.ts              # category tree + CRUD
    budget.ts                  # envelopes, transactions, accounts, payment methods
    budgets.ts                 # monthly assigned amounts
    transactions.ts            # edit/delete/batch/import
    rules.ts                   # rule CRUD, ordering, rule engine
    recurring.ts               # recurring CRUD, detection, mark paid
    helpers.ts                 # shared insert + envelope spend updates

proxy.ts                       # Clerk middleware (Next 16 name)
next.config.ts
tsconfig.json                  # strict TS, @/* -> src/*
eslint.config.mjs
```

---

## Data model

All tables live in `convex/schema.ts`. Every user-owned table stores `userId` and is indexed for per-user access.

| Table | Purpose | Notable fields |
| --- | --- | --- |
| `users` | Clerk user mirror | `clerkUserId`, `name`, `email`; indexed by `clerkUserId` |
| `categories` | Category tree | `name`, `parentId`, `color`, `icon`, `kind` (`outflow`/`inflow`), `accent` |
| `envelopes` | Budget envelope per category | `categoryId`, `target`, `assigned`, `spent`, `pinned`, `note` |
| `budgets` | Month-scoped budget assignments | `categoryId`, `month` (`YYYY-MM`), `assignedCents` (integer cents) |
| `transactions` | Money movements | `date`, `payee`, `categoryId`, `amount`, `paidFrom`, `tags`, `type`, `status`, `notes`, `rawPayee`, `hash`, `isSplit` |
| `transactionSplits` | Split lines for a transaction | `transactionId`, `categoryId`, `amount`, `note` |
| `rules` | Automation rules | `priority`, `conditionField`, `conditionOp`, `conditionValue`, `actionSetCategory`, `actionRenamePayee`, `actionAddTags` |
| `scheduledOutflows` | Recurring bills/income | `name`, `amount`, `kind`, `frequency`, `startDate`, `categoryId`, `tags`, `paidFrom`, `active`, `notes`, `lastPaid`, `paidOccurrences` |
| `accounts` | Account balances | `name`, `kind`, `balance` |
| `paymentMethods` | “Paid from” options | `label`, `kind`, `builtIn` |
| `tips` | Budgeting tip content | `rule`, `role`, `body`, `author`; not currently wired into a page |

Indexes are defined for the common access paths, including:

- `categories.by_userId`, `categories.by_userId_and_parentId`
- `envelopes.by_userId`, `envelopes.by_userId_and_categoryId`
- `transactions.by_userId_type_date`, `transactions.by_userId_hash`
- `transactionSplits.by_userId_and_transactionId`
- `rules.by_userId_priority`
- `budgets.by_userId`, `budgets.by_userId_month`, `budgets.by_userId_categoryId_month`
- `scheduledOutflows.by_userId`
- `accounts.by_userId`, `paymentMethods.by_userId`

---

## Money and date conventions

- **Transaction amounts are signed dollars**: negative = outflow/expense, positive = inflow/income.
- **Envelope amounts are dollars**: `target`, `assigned`, and `spent`.
- **Monthly budget assignments are integer cents** in `budgets.assignedCents`.
- **Dates are ISO strings**: `YYYY-MM-DD`.
- **Budget months are `YYYY-MM`**; the server validates the format.
- **Currency formatting is USD** (`en-US`) throughout. There is no currency selector.
- **Recurring math** uses UTC day arithmetic; the UI formats dates in the browser’s locale.
- **Envelope spend** is maintained by mutations:
  - Adding an outflow increments the envelope for its category (or each split category).
  - Editing, recategorising, or deleting reverses the old contribution and applies the new one.
  - Income transactions never change envelope spend.
- **Category creation** auto-creates an envelope for outflow categories. `budget.setCategoryBudget`, `assignToEnvelope`, and `togglePinEnvelope` can also lazily create an envelope.

### Two assignment stores

There are currently two related but separate stores:

1. `budgets.assignedCents` — the month-scoped grid used by `/budget`.
2. `envelopes.assigned` — the summary funding field used by `/dashboard`, `/envelopes`, `/targets`, and the quick view.

The quick view’s assign buttons and the Targets **Fund** action update `envelopes.assigned`; editing the Budget grid updates `budgets.assignedCents`. Treat this as an area to unify if you extend the app.

---

## Backend API map

All functions are exported from `convex/functions/*` and consumed through `src/hooks/use-budget-data.ts`.

### `users.ts`

- `getCurrentUserOrThrow(ctx)` — helper used by every protected function.
- `upsertFromClerk` — internal mutation for `user.created` / `user.updated`.
- `deleteFromClerk` — internal mutation for `user.deleted`.

### `categories.ts`

- Queries: `getCategories` (returns top-level categories with `children` attached).
- Mutations: `addCategory` (also seeds an outflow envelope), `updateCategory`, `deleteCategory` (blocks deletion when children exist).

### `budget.ts`

- Queries: `getEnvelopes`, `getTransactions` (optional date range), `getExpenses` (optional date range), `getPaymentMethods`, `getAccounts`.
- Mutations:
  - `addTransaction` — applies rules, persists splits, increments envelopes.
  - `categorizeTransaction` — moves spend between envelopes and preserves the original payee as `rawPayee`.
  - `addEnvelope`, `updateEnvelope`, `deleteEnvelope`.
  - `setCategoryBudget` — sets an envelope target; only outflow categories.
  - `assignToEnvelope` — adds to envelope `assigned`.
  - `togglePinEnvelope`.
  - `addPaymentMethod`, `removePaymentMethod` (built-ins protected).
  - `setTransactionTags`.

### `budgets.ts`

- Query: `getBudgets` — all month rows for the user.
- Mutation: `setAssignedAmount` — upserts integer cents for `categoryId` + `YYYY-MM`.

### `transactions.ts`

- Query: `getSplits`.
- Mutations: `updateTransaction`, `deleteTransaction`, `setTransactionStatus`, `batchCategorizeTransactions`, `batchTagTransactions`, `batchDeleteTransactions`.
- Import: `previewImport` (query) and `importTransactions` (mutation).
- Split handling: setting splits replaces all existing split rows and keeps envelope spend consistent; the parent transaction’s `categoryId` becomes `null` and `isSplit` becomes `true`.

### `rules.ts`

- Queries: `listRules`.
- Mutations: `createRule`, `updateRule`, `deleteRule`, `moveRule`, `createRuleFromTransaction`.
- Helpers: `listRulesForUser`, `applyRules`.
- Rule engine semantics: rules are sorted by ascending priority; the first matching rule applies its actions and evaluation stops.

### `recurring.ts`

- Queries: `listRecurring`, `detectRecurring`.
- Mutations: `createRecurring`, `updateRecurring`, `deleteRecurring`, `markOccurrencePaid`.

### `helpers.ts`

- `applySpentDelta` — adjust an envelope’s `spent` by a signed delta.
- `insertTransactionRecord` — shared create path for manual, imported-adjacent, and recurring transactions; applies rules, writes splits, and updates envelope spend.

### `convex/http.ts`

- `POST /clerk-webhook` — verifies Svix headers using `CLERK_WEBHOOK_SECRET`, then upserts or deletes the local user for `user.created`, `user.updated`, and `user.deleted`.

---

## Getting started

### Prerequisites

- **Node.js 20.9 or newer** (Next.js 16 requirement).
- **npm** (the repo includes `package-lock.json`).
- A **Convex** account (the CLI can create a project for you).
- A **Clerk** account with a development application.

### 1. Install dependencies

```bash
npm install
```

### 2. Create the Clerk application

1. Create an application in the [Clerk dashboard](https://dashboard.clerk.com).
2. Enable the **Convex** integration, or create a JWT template named **`convex`**. `convex/auth.config.ts` expects `applicationID: "convex"` and uses the Clerk Frontend API URL as the token issuer.
3. Copy the **Publishable key** and **Secret key** into `.env.local`.
4. Set the sign-in and sign-up paths (already the expected values in this repo):

```dotenv
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/login
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/dashboard
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/dashboard
```

5. Note the **Frontend API URL** (the Clerk issuer domain, for example `https://your-app.clerk.accounts.dev`). You will need it for both Next.js and Convex.

### 3. Configure Convex

Run the Convex dev server in a dedicated terminal:

```bash
npx convex dev
```

On first run, the CLI prompts you to log in and create/select a project. It then:

- Pushes `convex/schema.ts` and all functions to the development deployment.
- Watches for backend changes.
- Writes `CONVEX_DEPLOYMENT` and `NEXT_PUBLIC_CONVEX_URL` to `.env.local` (and usually the Convex site URL as well). If `NEXT_PUBLIC_CONVEX_SITE_URL` is missing, copy the `https://<deployment>.convex.site` URL from the Convex dashboard.

Add the environment variables that Convex functions read at runtime:

```bash
npx convex env set CLERK_FRONTEND_API_URL https://your-app.clerk.accounts.dev
npx convex env set CLERK_WEBHOOK_SECRET whsec_...
```

These belong to the **Convex deployment**, not just `.env.local`. Verify with:

```bash
npx convex env list
```

### 4. Start the Next.js app

In a second terminal:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 5. Connect the Clerk webhook

In the Clerk dashboard, add an endpoint:

- **URL:** `<NEXT_PUBLIC_CONVEX_SITE_URL>/clerk-webhook`
  - Example: `https://your-deployment-name.convex.site/clerk-webhook`
  - Check `.env.local` for `NEXT_PUBLIC_CONVEX_SITE_URL`, or copy the `convex.site` URL from the Convex dashboard.
- **Events:** `user.created`, `user.updated`, `user.deleted`.
- Copy the signing secret into the Convex deployment as `CLERK_WEBHOOK_SECRET`.

Without this webhook, sign-in succeeds but Convex calls fail because there is no matching row in `users`.

### 6. First-run checklist

Pinch starts with an empty workspace. After creating an account:

1. Open **Settings → Categories & Envelopes** and create at least one **outflow** category. This also creates its envelope.
2. Open **Settings → Payment methods** and add at least one method (for example, a bank account).
3. Add transactions from the header **New Transaction** button or the mobile dock’s **+** button.
4. Optionally import history from **Transactions → Import CSV**.
5. Set targets in the quick view or **Budget**, then assign money.
6. Add recurring items manually or accept a detected suggestion on **Recurring**.

> Accounts are not created by the UI. Insert rows in the `accounts` table via the Convex dashboard if you want the Accounts screen populated.

---

## Environment variables

### Next.js (`/.env.local`)

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_CONVEX_URL` | Yes | Convex deployment URL used by the React client. Written by `npx convex dev`. |
| `NEXT_PUBLIC_CONVEX_SITE_URL` | Yes (webhook setup) | Convex HTTP site URL; append `/clerk-webhook`. Written by `npx convex dev` or copied from the dashboard. |
| `CONVEX_DEPLOYMENT` | Yes | Deployment selector used by the Convex CLI. Written by `npx convex dev`. |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Yes | Clerk browser key. |
| `CLERK_SECRET_KEY` | Yes | Clerk server key used by Next.js. |
| `CLERK_FRONTEND_API_URL` | Yes | Clerk issuer/Frontend API URL. Also set on the Convex deployment. |
| `CLERK_WEBHOOK_SECRET` | Yes | Svix signing secret for the Clerk webhook. Also set on the Convex deployment. |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | Recommended | `/login` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | Recommended | `/sign-up` |
| `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL` | Recommended | `/dashboard` |
| `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL` | Recommended | `/dashboard` |

`.env*` is gitignored. Never commit real keys or webhook secrets.

### Convex deployment

Set these with `npx convex env set <NAME> <VALUE>`:

| Variable | Purpose |
| --- | --- |
| `CLERK_FRONTEND_API_URL` | Issuer domain used by `convex/auth.config.ts` to validate Clerk JWTs. |
| `CLERK_WEBHOOK_SECRET` | Svix secret used by `convex/http.ts` to verify webhook signatures. |

`NEXT_PUBLIC_*` variables cannot be read from Convex functions; keep runtime secrets on the Convex deployment.

---

## Available scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Next.js development server. |
| `npm run build` | Create a production build. Requires the Convex and Clerk environment variables. |
| `npm start` | Serve the production build. |
| `npm run lint` | Run ESLint with the Next.js core-web-vitals and TypeScript configs. |
| `npx convex dev` | Run the Convex development deployment and watch backend files. |
| `npx convex deploy` | Deploy schema and functions to a production Convex deployment. |

There is no test script.

---

## Deployment

### Backend (Convex)

1. Create or select a production deployment:

   ```bash
   npx convex deploy
   ```

   Use a deploy key (`CONVEX_DEPLOY_KEY`) in CI if you are not logged in interactively.

2. Set production environment variables on the deployment with the `--prod` flag:

   ```bash
   npx convex env set --prod CLERK_FRONTEND_API_URL https://your-production-clerk-domain
   npx convex env set --prod CLERK_WEBHOOK_SECRET whsec_...
   npx convex env list --prod
   ```

3. Update the production Clerk webhook to the production `.convex.site` URL.

### Frontend (Vercel or any Node host)

1. Set all Next.js environment variables from the table above to production values.
2. Build with `npm run build` and run with `npm start`, or use the platform’s Next.js preset.
3. Use the production Clerk publishable and secret keys.
4. Add the production domain to Clerk’s allowed origins and redirect URLs.
5. Ensure `NEXT_PUBLIC_CONVEX_URL`, `NEXT_PUBLIC_CONVEX_SITE_URL`, and `CONVEX_DEPLOYMENT` point at the production Convex deployment, not the dev one.

Because `NEXT_PUBLIC_*` values are inlined at build time, changing them requires a rebuild.

---

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `Missing NEXT_PUBLIC_CONVEX_URL in your .env file` | Convex has not been started or `.env.local` was not written. | Run `npx convex dev` and restart `npm run dev`. |
| `User not found in database. Ensure webhooks/sync are configured.` | Clerk webhook is missing, failing, has the wrong secret, or is not subscribed to user events. | Check the Clerk webhook endpoint, event types, and `CLERK_WEBHOOK_SECRET` on the Convex deployment. |
| `Unauthenticated call` from Convex | Clerk JWT is not being issued for Convex. | Enable the Clerk Convex integration or create the JWT template named `convex`. |
| App is empty after sign-up | No categories, payment methods, or transactions exist yet. | Follow the [first-run checklist](#6-first-run-checklist). |
| Accounts page is empty | Accounts are not created by the UI. | Add rows to the `accounts` table in the Convex dashboard. |
| CSV rows are skipped | Hash duplicate, missing date/payee, or invalid amount mapping. | Check the preview step, duplicate markers, and column mapping. |
| All imported rows are skipped | The same file was already imported. | Clear the transaction hashes or adjust the source file; dedupe is per user. |
| Convex function changes are not live | `npx convex dev` is not running. | Start it and keep it running while developing. |
| Clerk redirects to the wrong page | Sign-in/sign-up URL or fallback env vars are missing. | Set the four `NEXT_PUBLIC_CLERK_*` redirect variables. |
| Theme flashes on load | `localStorage` is unavailable or the bootstrap script was removed. | Keep `themeInitScript` in `app/layout.tsx`. |
| Build fails on missing environment variables | `ConvexClientProvider` throws during module evaluation. | Provide the Convex and Clerk env vars in the build environment. |

Useful commands:

```bash
npx convex logs          # stream backend logs
npx convex dashboard     # open the Convex dashboard
npx convex env list      # inspect dev deployment env vars
npx convex env list --prod  # inspect production deployment env vars
npm run lint             # catch TypeScript/ESLint issues
```

---

## Known limitations and rough edges

These are current behaviours, not aspirational features:

- **No bank sync.** Accounts are read-only and must be seeded manually. “Refresh balance” is a toast placeholder.
- **Placeholder actions.** Auto-Assign, the dashboard demo video, share links, and account refresh do not perform real work.
- **Profile and preference persistence.** Profile saves and the notification/rollover switches are local-only; they do not write to Clerk or Convex.
- **Two assignment stores.** The month grid (`budgets.assignedCents`) and envelope summary (`envelopes.assigned`) are separate. See [Two assignment stores](#two-assignment-stores).
- **No seed data.** A fresh user has no categories, payment methods, accounts, or transactions.
- **Category sort is display-only.** The sort menu updates its label but does not reorder rows.
- **Landing page sign-up link.** “Create account” points to `/signup`, while the route is `/sign-up`.
- **Reports footer.** The “Total spent … income” line currently formats the income total rather than total spending.
- **Tips table unused.** `tips` and `TipsCarousel` exist but are not mounted on a page.
- **Transactions and envelopes are capped.** Queries use `.take(1000)` for transactions, envelopes, and recurring items, `.take(2000)` for budgets and recurring detection, and `.take(100)` for rules. Very large datasets will be truncated in the UI.
- **No automated tests or CI.**
- **No licence file.** Add one before distributing the project.

---

## Contributing

- Keep Convex functions user-scoped: resolve the user with `getCurrentUserOrThrow` and filter every query/mutation by `userId`.
- Put shared money logic in `convex/functions/helpers.ts` so manual, imported, and recurring transactions stay consistent.
- Keep new UI aligned with the existing design tokens in `src/lib/styles.css` and the primitives in `src/components/ui/`.
- Update `src/hooks/use-budget-data.ts` when adding backend functions so components consume typed hooks.
- Run `npm run lint` and `npm run build` before opening a pull request.
- Do not edit `convex/_generated/` directly; regenerate it with `npx convex dev`.
- Remember that Next.js 16 uses `proxy.ts`, not `middleware.ts`.
