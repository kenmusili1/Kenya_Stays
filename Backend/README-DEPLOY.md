# Deploying KenyaStays

## What changed from the prototype

The old version stored everything (bookings, payments, accounts) in
in-memory JavaScript arrays - every restart wiped all data, and there was
no real login system (`admin_id=3` in a query string was enough to get
full admin access). This version fixes both:

- **PostgreSQL** persists everything. See `migrations/001_init.sql`.
- **Real authentication** - bcrypt-hashed passwords, JWTs, role-based
  access control (`CUSTOMER`, `OWNER`, `ADMIN`, `CUSTOMER CARE`). See
  `src/middleware/auth.js`.
- Payment state transitions (`PENDING → STK_INITIATED → SUCCESS`, etc.)
  are now atomic, guarded database updates (`UPDATE ... WHERE status NOT
  IN (...)`) instead of in-memory checks - safe under real concurrency,
  including multiple server instances. See
  `src/payments/paymentService.js`.
- `helmet`, restricted CORS, and rate limiting are on by default.

## 1. Local setup

```bash
cd Backend
npm install
cp .env.example .env
```

Edit `.env`:
- `DATABASE_URL` - point at a local Postgres (or use Docker: `docker run
  --name kenya-stays-db -e POSTGRES_PASSWORD=postgres -e
  POSTGRES_DB=kenya_stays -p 5432:5432 -d postgres:16`)
- `JWT_SECRET` - any long random string for local dev
- `PAYHERO_*` - your Pay Hero sandbox/production credentials
- `CORS_ALLOWED_ORIGINS` - leave empty locally (everything is allowed in
  development)

Then:

```bash
npm run migrate                 # creates all tables (safe to re-run)
ADMIN_NAME="Your Name" ADMIN_EMAIL="you@example.com" ADMIN_PASSWORD="a-strong-password" npm run seed:admin
npm run seed:demo               # OPTIONAL - sample properties for local testing only
npm run dev
```

## 2. Deploying to Render

### 2.1 Create the database

Render dashboard → **New → PostgreSQL**. Once it's up, copy the
**Internal Database URL** (starts with `postgresql://`) - you'll need it
in step 2.3.

### 2.2 Create the web service

**New → Web Service**, connect this repo.

- **Root Directory**: `Backend`
- **Build Command**: `npm install`
- **Start Command**: `node server.js`
- **Instance Type**: whatever fits your traffic - the app is stateless
  (no in-memory data), so it's safe to run multiple instances or let
  Render autoscale.

### 2.3 Environment variables

In the web service's **Environment** tab, set every variable from
`.env.example`:

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | the Internal Database URL from step 2.1 |
| `JWT_SECRET` | generate with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `CORS_ALLOWED_ORIGINS` | your actual frontend origin(s), comma-separated |
| `PAYHERO_API_USERNAME` / `PAYHERO_API_PASSWORD` / `PAYHERO_CHANNEL_ID` | from your Pay Hero account |
| `PAYHERO_CALLBACK_URL` | `https://<your-render-service>.onrender.com/api/payments/payhero/callback` |
| `PAYHERO_CALLBACK_TOKEN` | generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |

`PORT` is set automatically by Render - don't set it yourself.

The app fails to boot with a clear error message if any required
variable is missing or (for `JWT_SECRET`/`CORS_ALLOWED_ORIGINS`/
`PAYHERO_CALLBACK_TOKEN`) not production-strength - check the deploy logs
if it won't start.

### 2.4 Run the migration

Render doesn't run one-off commands automatically. After the first
deploy, open a shell on the service (**Shell** tab in the Render
dashboard) and run:

```bash
npm run migrate
```

### 2.5 Create the first admin account

Same shell:

```bash
ADMIN_NAME="Your Name" ADMIN_EMAIL="you@yourcompany.com" ADMIN_PASSWORD="a-strong-password" npm run seed:admin
```

Do **not** run `npm run seed:demo` in production - it's sample data for
local testing only.

### 2.6 Verify

```bash
curl https://<your-render-service>.onrender.com/api/health
```

Should return `{"status":"ok","database":"connected"}`.

Then log in as the admin account you just created
(`POST /api/auth/login`) and confirm `GET /api/admin/dashboard` works
with that token.

## 3. Before you consider this fully production-ready

This covers the two blocking issues (persistence and real auth) plus
baseline hardening (CORS, rate limiting, security headers). Still worth
doing before/soon after launch:

- **Automated tests.** Everything so far has been verified by hand with
  curl - a real test suite (even a handful of integration tests around
  the payment state machine) would catch regressions automatically.
- **Structured logging / error tracking** (e.g. Sentry, or Render's log
  drains to a proper aggregator) - right now it's `console.log`/
  `console.error` only, which works but isn't searchable or alertable.
- **Backups.** Render's managed Postgres supports automated backups -
  make sure they're enabled, given this now holds real payment records.
- **Password reset flow.** Not implemented - currently the only recovery
  path for a forgotten password is an admin manually resetting it via a
  direct database update.
- **Email verification** on registration, if you want to guard against
  fake signups.
