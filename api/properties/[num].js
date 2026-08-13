// GET    /api/properties/:num -> fetch a single property
// PUT    /api/properties/:num -> replace a property's data (used for tenant add/edit/delete too,
//                                 since tenants live inside the property's tenants array)
// DELETE /api/properties/:num -> remove a property
'use strict';

const { ensureReady, query } = require('../../lib/db');
const { isAuthenticated } = require('../../lib/auth');
const { getJsonBody, sendJson, withErrorHandling } = require('../../lib/http');

module.exports = async (req, res) => {
  await withErrorHandling(res, async () => {
    if (!isAuthenticated(req)) {
      return sendJson(res, 401, { error: 'Not authenticated.' });
    }

    await ensureReady();

    const num = Number(req.query && req.query.num);
    if (!Number.isInteger(num)) {
      return sendJson(res, 400, { error: 'Invalid property number.' });
    }

    if (req.method === 'GET') {
      const { rows } = await query('SELECT data FROM properties WHERE num = $1', [num]);
      if (!rows.length) return sendJson(res, 404, { error: 'Property not found.' });
      return sendJson(res, 200, rows[0].data);
    }

    if (req.method === 'PUT') {
      const body = await getJsonBody(req);
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return sendJson(res, 400, { error: 'Request body must be a JSON object.' });
      }
      const data = Object.assign({}, body, {
        num,
        tenants: Array.isArray(body.tenants) ? body.tenants : [],
      });
      const { rows } = await query(
        'UPDATE properties SET data = $2, updated_at = now() WHERE num = $1 RETURNING data',
        [num, data]
      );
      if (!rows.length) return sendJson(res, 404, { error: 'Property not found.' });
      return sendJson(res, 200, rows[0].data);
    }

    if (req.method === 'DELETE') {
      const { rows } = await query('DELETE FROM properties WHERE num = $1 RETURNING num', [num]);
      if (!rows.length) return sendJson(res, 404, { error: 'Property not found.' });
      res.status(204);
      return res.end ? res.end() : sendJson(res, 204, null);
    }

    res.setHeader('Allow', 'GET, PUT, DELETE');
    return sendJson(res, 405, { error: `Method ${req.method} not allowed.` });
  });
};
