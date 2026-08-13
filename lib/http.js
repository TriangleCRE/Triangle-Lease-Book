// Small helpers shared by the /api serverless functions.
'use strict';

/**
 * Read a JSON request body. On Vercel's Node runtime, req.body is already
 * parsed for us; this falls back to reading the raw stream for any other
 * runtime (e.g. local testing) where it isn't.
 */
function getJsonBody(req) {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'string') {
      try {
        return Promise.resolve(req.body ? JSON.parse(req.body) : {});
      } catch (err) {
        return Promise.reject(new Error('Request body is not valid JSON.'));
      }
    }
    return Promise.resolve(req.body);
  }
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
    });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (err) {
        reject(new Error('Request body is not valid JSON.'));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, body) {
  res.status(status).json(body);
}

async function withErrorHandling(res, handler) {
  try {
    await handler();
  } catch (err) {
    console.error(err);
    sendJson(res, 500, { error: 'Internal server error.' });
  }
}

module.exports = { getJsonBody, sendJson, withErrorHandling };
