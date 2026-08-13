// GET  /api/properties  -> list every property (with its nested tenants), ordered by num
// POST /api/properties  -> create a new property
'use strict';

const { ensureReady, query } = require('../../lib/db');
const { isAuthenticated } = require('../../lib/auth');
const { getJsonBody, sendJson, withErrorHandling } = require('../../lib/http');

module.exports = async (req, res) => {
  await withErrorHandling(res, async () => {
    // This route sits behind the passcode gate: check the session before
    // touching the database at all.
    if (!isAuthenticated(req)) {
      return sendJson(res, 401, { error: 'Not authenticated.' });
    }

    // Self-healing: make sure the table exists and is seeded before we touch it.
    await ensureReady();

    if (req.method === 'GET') {
      const { rows } = await query('SELECT data FROM properties ORDER BY num ASC');
      return sendJson(res, 200, rows.map((r) => r.data));
    }

    if (req.method === 'POST') {
      const body = await getJsonBody(req);
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return sendJson(res, 400, { error: 'Request body must be a JSON object.' });
      }
      if (!body.name || !String(body.name).trim()) {
        return sendJson(res, 400, { error: 'A property "name" is required.' });
      }

      let num = Number(body.num);
      if (!Number.isInteger(num)) {
        const { rows } = await query('SELECT COALESCE(MAX(num), 0) + 1 AS next FROM properties');
        num = rows[0].next;
      }

      const data = Object.assign({}, body, {
        num,
        tenants: Array.isArray(body.tenants) ? body.tenants : [],
      });

      try {
        const { rows } = await query(
          'INSERT INTO properties (num, data) VALUES ($1, $2) RETURNING data',
          [num, data]
        );
        return sendJson(res, 201, rows[0].data);
      } catch (err) {
        if (err && err.code === '23505') {
          return sendJson(res, 409, { error: `Property number ${num} already exists.` });
        }
        throw err;
      }
    }

    res.setHeader('Allow', 'GET, POST');
    return sendJson(res, 405, { error: `Method ${req.method} not allowed.` });
  });
};
