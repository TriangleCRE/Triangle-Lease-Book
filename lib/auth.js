// Simple shared-passcode gate.
//
// There's a single site-wide PASSCODE (env var), not per-user accounts, so
// sessions are a signed, stateless token rather than a server-side session
// store (which wouldn't survive across serverless invocations anyway).
//
// Token format: "<expiryMillis>.<hmac>" where the HMAC is keyed by the
// PASSCODE itself. Nobody can forge a valid token without knowing the
// passcode, and anyone who *does* know the passcode could just log in
// normally, so reusing it as the signing key adds no real weakness while
// avoiding a second secret the user would have to configure.
'use strict';

const crypto = require('crypto');

const COOKIE_NAME = 'lb_session';
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24h safety-net cap on top of the (browser-session) cookie itself

function sign(value, secret) {
  return crypto.createHmac('sha256', secret).update(value).digest('base64url');
}

function timingSafeEqualStr(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/** Checks a candidate passcode against PASSCODE. Returns false (never throws) if PASSCODE isn't configured. */
function verifyPasscode(candidate) {
  const passcode = process.env.PASSCODE;
  if (!passcode) return false;
  return timingSafeEqualStr(String(candidate == null ? '' : candidate), passcode);
}

function createSessionToken() {
  const passcode = process.env.PASSCODE;
  if (!passcode) throw new Error('PASSCODE environment variable is not set.');
  const payload = String(Date.now() + SESSION_TTL_MS);
  return `${payload}.${sign(payload, passcode)}`;
}

function verifySessionToken(token) {
  const passcode = process.env.PASSCODE;
  if (!passcode || !token || typeof token !== 'string') return false;
  const dot = token.lastIndexOf('.');
  if (dot < 0) return false;
  const payload = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!timingSafeEqualStr(sig, sign(payload, passcode))) return false;
  const exp = Number(payload);
  return Number.isFinite(exp) && Date.now() < exp;
}

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  header.split(';').forEach((pair) => {
    const idx = pair.indexOf('=');
    if (idx < 0) return;
    out[pair.slice(0, idx).trim()] = decodeURIComponent(pair.slice(idx + 1).trim());
  });
  return out;
}

function isHttps(req) {
  const proto = req && req.headers && req.headers['x-forwarded-proto'];
  return !!proto && proto.split(',')[0].trim() === 'https';
}

/** True if the request carries a valid, unexpired session cookie. */
function isAuthenticated(req) {
  const cookies = parseCookies(req.headers && req.headers.cookie);
  return verifySessionToken(cookies[COOKIE_NAME]);
}

/** Issues a fresh session cookie. Deliberately no Max-Age: it's a browser-session cookie (cleared on browser close), capped separately by SESSION_TTL_MS inside the token itself. */
function setSessionCookie(res, req) {
  const secure = isHttps(req) ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=${createSessionToken()}; HttpOnly; Path=/; SameSite=Lax${secure}`);
}

function clearSessionCookie(res, req) {
  const secure = isHttps(req) ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${secure}`);
}

module.exports = { COOKIE_NAME, verifyPasscode, isAuthenticated, setSessionCookie, clearSessionCookie };
