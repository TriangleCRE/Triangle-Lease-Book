#!/usr/bin/env node
// Standalone seed script for manual/local use.
//
// The live site does NOT depend on this being run — api/properties/*.js call
// the same ensureSchema()/seedIfEmpty() logic automatically on first request.
// This only inserts data when the "properties" table is completely empty, so
// it can never overwrite real edits once real data exists.
'use strict';

const { ensureSchema, seedIfEmpty, closePool } = require('../lib/db');

(async () => {
  await ensureSchema();
  const result = await seedIfEmpty();
  if (result.seeded) {
    console.log(`Seeded ${result.count} properties.`);
  } else {
    console.log(`Table already has ${result.count} row(s); left untouched.`);
  }
})()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exitCode = 1;
  })
  .finally(() => closePool());
