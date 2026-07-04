/* Lightweight in-memory rate limiter (no extra deps).
   Note: per-process memory — if this app ever runs on more than one instance,
   move rlBuckets to a shared store (e.g. Redis) so limits apply globally. */
const rlBuckets = new Map();

function rlBlocked(key, max, windowMs) {
  const b = rlBuckets.get(key);
  return !!(b && Date.now() - b.start <= windowMs && b.n >= max);
}
function rlHit(key, windowMs) {
  const now = Date.now();
  const b = rlBuckets.get(key);
  if (!b || now - b.start > windowMs) rlBuckets.set(key, { start: now, n: 1 });
  else b.n++;
}
function rateLimit(key, max, windowMs) {
  if (rlBlocked(key, max, windowMs)) return false;
  rlHit(key, windowMs);
  return true;
}
function tooMany(res) {
  return res.status(429).json({ success: false, error: 'Too many attempts — please wait a few minutes and try again.' });
}
function startCleanup() {
  return setInterval(() => {
    const now = Date.now();
    for (const [k, b] of rlBuckets) if (now - b.start > 3600000) rlBuckets.delete(k);
  }, 600000).unref();
}

module.exports = { rlBuckets, rlBlocked, rlHit, rateLimit, tooMany, startCleanup };
