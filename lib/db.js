// Postgres data access for the Lease Dashboard.
//
// The lease/tenant data has a long tail of optional, inconsistent fields
// (flags, rent_changes, timeline, renewal notes, financials, occupancy
// breakdowns, ...) that vary property to property. Rather than model a wide,
// mostly-null column schema, each property (including its nested tenant
// leases) is stored as a single JSONB document. `num` is pulled out into its
// own column because it's simple, uniform, and used as the natural key.
'use strict';

const { Pool } = require('pg');
const path = require('path');

let pool = null;

function connectionString() {
  const conn =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL_NON_POOLING;
  if (!conn) {
    throw new Error(
      'No database connection string found. Set DATABASE_URL (or POSTGRES_URL) in the environment.'
    );
  }
  return conn;
}

function needsSSL(conn) {
  if (process.env.PGSSLMODE === 'disable') return false;
  if (/sslmode=disable/.test(conn)) return false;
  // Local/dev Postgres (docker, local install) never needs TLS. Anything
  // else (Neon, Vercel Postgres, RDS, ...) does.
  return !/(localhost|127\.0\.0\.1)/.test(conn);
}

function getPool() {
  if (!pool) {
    const conn = connectionString();
    pool = new Pool({
      connectionString: conn,
      ssl: needsSSL(conn) ? { rejectUnauthorized: false } : undefined,
    });
  }
  return pool;
}

function query(text, params) {
  return getPool().query(text, params);
}

async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

/** Idempotent: create the table if it doesn't already exist. Safe to run any number of times. */
async function ensureSchema() {
  await query(`
    CREATE TABLE IF NOT EXISTS properties (
      id SERIAL PRIMARY KEY,
      num INTEGER UNIQUE NOT NULL,
      data JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

/** Load the bundled seed data (the original hard-coded lease dataset). */
function loadSeedData() {
  // eslint-disable-next-line global-require
  return require(path.join(__dirname, '..', 'data', 'seed-properties.json'));
}

/**
 * Only seeds when the table is completely empty, so it can never clobber
 * real edits once real data exists.
 */
async function seedIfEmpty() {
  const { rows } = await query('SELECT COUNT(*)::int AS count FROM properties');
  if (rows[0].count > 0) return { seeded: false, count: rows[0].count };

  const seed = loadSeedData();
  for (const property of seed) {
    await query(
      'INSERT INTO properties (num, data) VALUES ($1, $2) ON CONFLICT (num) DO NOTHING',
      [property.num, property]
    );
  }
  return { seeded: true, count: seed.length };
}

// Self-healing setup: memoize the ensure/seed check per warm serverless
// instance so every request is safe even if it's the very first one to hit a
// brand-new database, but we don't re-check on every single request.
let readyPromise = null;

function ensureReady() {
  if (!readyPromise) {
    readyPromise = (async () => {
      await ensureSchema();
      await seedIfEmpty();
    })().catch((err) => {
      // Allow the next call to retry instead of permanently caching a failure
      // (e.g. a transient connection error on cold start).
      readyPromise = null;
      throw err;
    });
  }
  return readyPromise;
}

module.exports = {
  getPool,
  query,
  closePool,
  ensureSchema,
  seedIfEmpty,
  ensureReady,
  loadSeedData,
};
