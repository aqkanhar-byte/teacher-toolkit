/* Unit tests for lib/payments.js — the gateway-agnostic payment core.
   Uses a tiny hand-rolled mock of the Supabase query-builder chain so the idempotency
   logic can be verified without a real database. */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');

const { recordPayment, verifyHmacSignature } = require('../lib/payments');

function makeMockSb() {
  const rows = [];
  return {
    rows,
    from(table) {
      let filters = {};
      return {
        select() { return this; },
        eq(k, v) { filters[k] = v; return this; },
        async maybeSingle() {
          const match = rows.find(r => Object.entries(filters).every(([k, v]) => r[k] === v));
          return { data: match || null, error: null };
        },
        insert(obj) {
          const row = { id: 'row_' + rows.length, ...obj };
          return { select: () => ({ maybeSingle: async () => { rows.push(row); return { data: row, error: null }; } }) };
        }
      };
    }
  };
}

test('recordPayment: inserts a new transaction when no gatewayTransactionId is given (manual flow, unchanged behavior)', async () => {
  const sb = makeMockSb();
  const r1 = await recordPayment(sb, { userId: 'u1', amountRs: 500, credits: 12, note: 'test' });
  const r2 = await recordPayment(sb, { userId: 'u1', amountRs: 500, credits: 12, note: 'test' });
  assert.equal(r1.duplicate, false);
  assert.equal(r2.duplicate, false, 'without an idempotency key, manual entries are never treated as duplicates');
  assert.equal(sb.rows.length, 2);
});

test('recordPayment: same gateway + gatewayTransactionId is only ever recorded once', async () => {
  const sb = makeMockSb();
  const r1 = await recordPayment(sb, { userId: 'u1', gateway: 'jazzcash', gatewayTransactionId: 'TXN123', amountRs: 850, credits: 20 });
  const r2 = await recordPayment(sb, { userId: 'u1', gateway: 'jazzcash', gatewayTransactionId: 'TXN123', amountRs: 850, credits: 20 });
  assert.equal(r1.duplicate, false);
  assert.equal(r2.duplicate, true, 'a replayed webhook with the same transaction id must be detected as a duplicate');
  assert.equal(sb.rows.length, 1, 'the user must only ever be credited once for TXN123');
});

test('recordPayment: same transaction id under different gateways are independent (no false-positive collision)', async () => {
  const sb = makeMockSb();
  const r1 = await recordPayment(sb, { userId: 'u1', gateway: 'jazzcash', gatewayTransactionId: 'ABC', amountRs: 500, credits: 10 });
  const r2 = await recordPayment(sb, { userId: 'u1', gateway: 'easypaisa', gatewayTransactionId: 'ABC', amountRs: 500, credits: 10 });
  assert.equal(r1.duplicate, false);
  assert.equal(r2.duplicate, false);
});

test('verifyHmacSignature: accepts a correctly-signed payload, rejects a tampered one', () => {
  const secret = 'test-secret';
  const body = JSON.stringify({ amount: 500, txn: 'ABC' });
  const sig = crypto.createHmac('sha256', secret).update(body).digest('hex');
  assert.equal(verifyHmacSignature(body, sig, secret), true);
  assert.equal(verifyHmacSignature(body, sig, 'wrong-secret'), false);
  assert.equal(verifyHmacSignature(body + 'tampered', sig, secret), false);
});

test('verifyHmacSignature: fails closed when signature or secret is missing', () => {
  assert.equal(verifyHmacSignature('body', null, 'secret'), false);
  assert.equal(verifyHmacSignature('body', 'sig', null), false);
  assert.equal(verifyHmacSignature('body', '', ''), false);
});
