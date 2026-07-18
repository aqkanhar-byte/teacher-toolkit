const crypto = require('crypto');

function hashPin(pin) {
  const salt = crypto.randomBytes(8).toString('hex');
  return salt + ':' + crypto.scryptSync(String(pin), salt, 32).toString('hex');
}
function checkPin(pin, stored) {
  try {
    const [salt, h] = stored.split(':');
    const a = crypto.scryptSync(String(pin), salt, 32);
    const b = Buffer.from(h, 'hex');
    if (a.length !== b.length) return false; /* length leak is unavoidable; content compare is constant-time */
    return crypto.timingSafeEqual(a, b);
  } catch (e) { return false; }
}

module.exports = { hashPin, checkPin };
