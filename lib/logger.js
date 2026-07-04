/* Minimal structured error logging (no paid service required).
   Every line is one JSON object — greppable in Render's log viewer, and a
   ready drop-in for Sentry/Logtail/etc. later without changing call sites. */
function logError(context, err, extra) {
  const entry = {
    level: 'error',
    time: new Date().toISOString(),
    context,
    message: err && err.message ? err.message : String(err),
    ...(extra || {})
  };
  console.error(JSON.stringify(entry));
}

module.exports = { logError };
