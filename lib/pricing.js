/* Single source of truth for pricing — used by /config and by referral rewards.
   5 packages, small → big. Per-credit price drops with volume but never below
   cost+margin (real AI cost ~Rs 15-45/doc depending on book attachments) —
   every tier stays profitable. */
const PLANS = [
  { name: 'Monthly Pro', rs: 1500, docs: 40, days: 30, tag: 'Best for regular use' }
];

const PRICES = [
  { name: 'Starter', rs: 200, credits: 4, tag: '' },
  { name: 'Basic', rs: 450, credits: 10, tag: '' },
  { name: 'Popular', rs: 850, credits: 20, tag: 'Most Popular' },
  { name: 'Pro', rs: 1600, credits: 40, tag: 'Best Value' },
  { name: 'School', rs: 3600, credits: 100, tag: 'For whole staff' }
];

const REFERRAL_CREDITS = 2; /* both referrer + referred get this many free credits, once, on the referred teacher's FIRST successful AI document */

function planActive(u) {
  return !!(u && u.plan && u.plan_expires && new Date(u.plan_expires) > new Date() && (u.plan_used || 0) < (u.plan_quota || 0));
}

module.exports = { PLANS, PRICES, REFERRAL_CREDITS, planActive };
