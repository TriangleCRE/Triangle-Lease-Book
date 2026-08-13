// POST /api/logout -> clears the session cookie.
'use strict';

const { clearSessionCookie } = require('../lib/auth');
const { sendJson, withErrorHandling } = require('../lib/http');

module.exports = async (req, res) => {
  await withErrorHandling(res, async () => {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return sendJson(res, 405, { error: `Method ${req.method} not allowed.` });
    }
    clearSessionCookie(res, req);
    return sendJson(res, 200, { ok: true });
  });
};
