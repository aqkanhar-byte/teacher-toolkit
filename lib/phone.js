function cleanPhone(p) {
  return String(p || '').replace(/[^0-9]/g, '').replace(/^0/, '92').slice(0, 12);
}

module.exports = { cleanPhone };
