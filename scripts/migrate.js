#!/usr/bin/env node
// Standalone migration script for manual/local use.
//
// The live site does NOT depend on this being run — api/properties/*.js call
// the same ensureSchema()/seedIfEmpty() logic automatically on first request.
// This script exists for people who want to prep a database by hand (e.g.
// before a deploy, or against a fresh local Postgres).
'use strict';

const { ensureSchema, closePool } = require('../lib/db');

(async () => {
  await ensureSchema();
  console.log('Migration complete: the "properties" table exists.');
})()
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exitCode = 1;
  })
  .finally(() => closePool());
