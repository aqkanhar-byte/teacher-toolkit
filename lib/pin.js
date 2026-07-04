const crypto = require('crypto');

function hashPin(pin) {
  const salt = crypto.randomBytes(8).toString('hex');
  return salt + ':' + crypto.scryptSync(String(pin), salt, 32).toString('hex');
}
function checkPin(pin, stored) {
  try {
    const [salt, h] = stored.split(':');
    return crypto.scryptSync(String(pin), salt, 32).toString('hex') === h;
  } catch (e) { return false; }
}

module.exports = { hashPin, checkPin };
