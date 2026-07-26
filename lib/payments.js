const crypto = require('crypto');

/* Records a payment/credit transaction with idempotency protection built in.
   If gatewayTransactionId is supplied and has already been recorded for this gateway, this is a
   no-op that returns the existing row instead of double-crediting the user — the single most
   important protection any payment system needs, and the reason a unique index exists on
   (gateway, gateway_transaction_id) in db/schema.sql. Works for both the current manual
   admin-driven flow (gateway defaults to 'manual', gatewayTransactionId optional) and any future
   real gateway (gatewayTransactionId required, always the gateway's own transaction/order id). */
async function recordPayment(sb, { userId, gateway, gatewayTransactionId, orderId, amountRs, credits, status, currency, metadata, note, beforeBalance, afterBalance, entryType }) {
  if (gatewayTransactionId) {
    const { data: existing } = await sb.from('tt_transactions')
      .select('*').eq('gateway', gateway || 'manual').eq('gateway_transaction_id', gatewayTransactionId).maybeSingle();
    if (existing) return { duplicate: true, transaction: existing };
  }
  const { data, error } = await sb.from('tt_transactions').insert({
    user_id: userId, credits: credits || 0, amount_rs: amountRs || 0, note: note || '',
    gateway: gateway || 'manual', gateway_transaction_id: gatewayTransactionId || null,
    order_id: orderId || null, status: status || 'completed', currency: currency || 'PKR', metadata: metadata || null,
    before_balance: beforeBalance ?? null, after_balance: afterBalance ?? null, entry_type: entryType || 'purchase'
  }).select().maybeSingle();
  if (error) throw error;
  return { duplicate: false, transaction: data };
}

/* Generic HMAC-SHA256 webhook signature check — the scheme most gateways (JazzCash, Easypaisa,
   PayFast, Stripe-style) use, just with different header names and secrets. Timing-safe compare
   so an attacker can't guess the correct signature one byte at a time. */
function verifyHmacSignature(rawBody, signatureHex, secret) {
  if (!signatureHex || !secret) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const a = Buffer.from(signatureHex), b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  try { return crypto.timingSafeEqual(a, b); } catch (e) { return false; }
}

/* Gateway adapter registry. Each real gateway, once a merchant account + credentials exist,
   registers here as:
     GATEWAYS['jazzcash'] = {
       verifyWebhook(req) => { valid, eventType, gatewayTransactionId, orderId, amountRs, raw },
       createCheckout(params) => { redirectUrl } | { clientSecret } | ...
     }
   Nothing is registered yet on purpose — /webhooks/payment/:gateway safely rejects every
   gateway name until its adapter is added, so there is no path that pretends to process a real
   payment without real verification behind it. */
const GATEWAYS = {};

module.exports = { recordPayment, verifyHmacSignature, GATEWAYS };
