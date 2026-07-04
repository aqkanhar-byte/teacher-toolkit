/* Unit tests for the pure logic extracted into lib/ during the production audit.
   Uses Node's built-in test runner — no new dependency required.
   Run with: node --test */
const test = require('node:test');
const assert = require('node:assert/strict');

const { cleanPhone } = require('../lib/phone');
const { hashPin, checkPin } = require('../lib/pin');
const { planActive, PLANS, PRICES } = require('../lib/pricing');
const { rlBlocked, rlHit, rateLimit } = require('../lib/rateLimit');

test('cleanPhone: normalizes local formats to 92xxxxxxxxxx', () => {
  assert.equal(cleanPhone('0300-1234567'), '923001234567');
  assert.equal(cleanPhone('03001234567'), '923001234567');
  assert.equal(cleanPhone('923001234567'), '923001234567');
  assert.equal(cleanPhone(''), '');
  assert.equal(cleanPhone(null), '');
});

test('hashPin/checkPin: correct PIN verifies, wrong PIN fails', () => {
  const hash = hashPin('1234');
  assert.equal(checkPin('1234', hash), true);
  assert.equal(checkPin('9999', hash), false);
  assert.equal(checkPin('1234', 'not-a-real-hash'), false);
});

test('hashPin: same PIN produces different hashes (random salt)', () => {
  assert.notEqual(hashPin('1234'), hashPin('1234'));
});

test('planActive: false when no plan, expired, or quota exhausted', () => {
  assert.equal(planActive(null), false);
  assert.equal(planActive({}), false);
  assert.equal(planActive({ plan: 'Monthly Pro', plan_expires: new Date(Date.now() - 1000).toISOString(), plan_quota: 40, plan_used: 0 }), false);
  assert.equal(planActive({ plan: 'Monthly Pro', plan_expires: new Date(Date.now() + 86400000).toISOString(), plan_quota: 10, plan_used: 10 }), false);
});

test('planActive: true with a valid, unexpired, non-exhausted plan', () => {
  assert.equal(planActive({ plan: 'Monthly Pro', plan_expires: new Date(Date.now() + 86400000).toISOString(), plan_quota: 40, plan_used: 10 }), true);
});

test('pricing: every package/plan has positive price and credit values, priced above rough cost floor', () => {
  const ROUGH_COST_PER_DOC = 15; // conservative floor established during the audit
  for (const p of PRICES) {
    assert.ok(p.rs > 0 && p.credits > 0, `${p.name} must have positive rs/credits`);
    assert.ok(p.rs / p.credits >= ROUGH_COST_PER_DOC, `${p.name} per-doc price (${p.rs / p.credits}) must stay above cost floor`);
  }
  for (const plan of PLANS) {
    assert.ok(plan.rs / plan.docs >= ROUGH_COST_PER_DOC, `${plan.name} per-doc price must stay above cost floor`);
  }
});

test('rate limiter: blocks after max hits within the window, resets after window elapses', () => {
  const key = 'test:' + Math.random();
  for (let i = 0; i < 3; i++) assert.equal(rateLimit(key, 3, 1000), true, `hit ${i + 1} should be allowed`);
  assert.equal(rateLimit(key, 3, 1000), false, '4th hit within the window should be blocked');
  assert.equal(rlBlocked(key, 3, 1000), true);
});

test('rate limiter: independent keys do not interfere with each other', () => {
  const keyA = 'a:' + Math.random(), keyB = 'b:' + Math.random();
  assert.equal(rateLimit(keyA, 1, 1000), true);
  assert.equal(rateLimit(keyA, 1, 1000), false);
  assert.equal(rateLimit(keyB, 1, 1000), true, 'a different key must not be affected by keyA being blocked');
});
