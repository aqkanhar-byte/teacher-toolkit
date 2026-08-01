/* One-off generator for ADMIN_TOTP_SECRET — run locally, never on the server:
     node scripts/generate-admin-totp-secret.js
   Prints a random base32 secret (RFC 6238, 160-bit, same format Google Authenticator/Authy
   expect). Put the printed secret in .env / Render's env vars as ADMIN_TOTP_SECRET, and enter
   the SAME secret into your authenticator app via "Enter a setup key" / manual entry. */
const crypto = require('crypto');
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function toBase32(buf) {
  let bits = '';
  for (const b of buf) bits += b.toString(2).padStart(8, '0');
  let out = '';
  for (let i = 0; i + 5 <= bits.length; i += 5) out += ALPHABET[parseInt(bits.slice(i, i + 5), 2)];
  return out;
}

const secret = toBase32(crypto.randomBytes(20));
console.log('ADMIN_TOTP_SECRET=' + secret);
console.log('');
console.log('otpauth URI (reference only — you can type the secret above into your authenticator');
console.log('app manually instead of scanning a QR code):');
console.log('otpauth://totp/TeacherToolkit:Admin?secret=' + secret + '&issuer=TeacherToolkit&digits=6&period=30');
