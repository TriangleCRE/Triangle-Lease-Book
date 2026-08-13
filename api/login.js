// POST /api/login -> { passcode } -> sets a session cookie on success.
// The passcode is verified only here, server-side, against the PASSCODE
// environment variable; it's never sent to or embedded in front-end code.
'use strict';

const { verifyPasscode, setSessionCookie } = require('../lib/auth');
const { getJsonBody, sendJson, withErrorHandling } = require('../lib/http');

module.exports = async (req, res) => {
  await withErrorHandling(res, async () => {
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return sendJson(res, 405, { error: `Method ${req.method} not allowed.` });
    }

    if (!process.env.PASSCODE) {
      console.error('PASSCODE environment variable is not set.');
      return sendJson(res, 500, { error: 'Login is not available right now.' });
    }

    const body = await getJsonBody(req);
    const passcode = body && body.passcode;

    if (!verifyPasscode(passcode)) {
      return sendJson(res, 401, { error: 'Incorrect passcode.' });
    }

    setSessionCookie(res, req);
    return sendJson(res, 200, { ok: true });
  });
};
