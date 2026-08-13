# Triangle Investment Group — Lease Dashboard

A single-page lease/tenant dashboard backed by Postgres (Neon, via the Vercel
Storage integration).

## How data is stored

Each property (with its nested tenant leases, financials, occupancy figures,
flags, timelines, etc.) is stored as one row in a `properties` table:

```sql
properties (
  id SERIAL PRIMARY KEY,
  num INTEGER UNIQUE NOT NULL,   -- the property number used throughout the UI/URLs
  data JSONB NOT NULL,           -- the whole property object, tenants included
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
```

The lease data has a long tail of optional, inconsistent fields (per-tenant
flags, rent-change history, renewal notes, timelines, ...), so it's kept as a
JSONB document per property instead of a wide, mostly-null column schema.

## Self-healing setup

The live site does **not** depend on anyone running a migration or seed
script by hand. `lib/db.js`'s `ensureReady()` runs at the top of every
`/api/properties*` request and:

1. Creates the `properties` table if it doesn't exist yet (`CREATE TABLE IF
   NOT EXISTS`).
2. Seeds it from `data/seed-properties.json` **only if the table is
   completely empty**. Once any row exists, seeding never runs again — real
   edits can never be clobbered.

This means pointing a brand-new, empty Neon database at this project and
deploying is enough; the first request against `/api/properties` sets
everything up.

## Manual/local scripts

For local development or manual intervention, the same logic is also
available standalone:

```bash
export DATABASE_URL=postgres://user:pass@host/db
npm run migrate   # scripts/migrate.js — create the table if missing
npm run seed      # scripts/seed.js    — seed only if the table is empty
```

## API

All endpoints read `data.tenants` as part of the property record — there's no
separate tenants table, so editing/adding/removing a tenant is done by
`PUT`-ing the whole updated property.

- `GET /api/properties` — list every property, ordered by `num`
- `POST /api/properties` — create a property (`name` required; `num` is
  auto-assigned if omitted)
- `GET /api/properties/:num` — fetch one property
- `PUT /api/properties/:num` — replace a property's data
- `DELETE /api/properties/:num` — remove a property

The connection string is read only from environment variables
(`DATABASE_URL`, falling back to `POSTGRES_URL` / `POSTGRES_PRISMA_URL` /
`POSTGRES_URL_NON_POOLING`) — never hard-coded.

## Front end

`index.html` fetches from `/api/properties` on load and writes back through
the same endpoints for every add/edit/delete, so changes are visible to
everyone who visits the dashboard, not just the browser that made them.
