// Category → CoA account code + group mapping
// Groups: COGS, FULFILLMENT, MARKETING, OPERATIONS
// Account codes match migration 028 (India D2C Fashion CoA)

const CATEGORY_MAP = {
  // ── COGS / PURCHASE (5xxx) ─────────────────────────────────────────────────
  fabric:           { key: 'fabric',           group: 'COGS',        account_code: '5010' },
  'raw materials':  { key: 'fabric',           group: 'COGS',        account_code: '5010' },
  textile:          { key: 'fabric',           group: 'COGS',        account_code: '5010' },
  sampling:         { key: 'manufacturing',    group: 'COGS',        account_code: '5020' },
  manufacturing:    { key: 'manufacturing',    group: 'COGS',        account_code: '5020' },
  'job work':       { key: 'manufacturing',    group: 'COGS',        account_code: '5020' },
  stitching:        { key: 'manufacturing',    group: 'COGS',        account_code: '5020' },
  tailoring:        { key: 'manufacturing',    group: 'COGS',        account_code: '5020' },
  embroidery:       { key: 'embroidery',       group: 'COGS',        account_code: '5030' },
  embellishment:    { key: 'embroidery',       group: 'COGS',        account_code: '5030' },
  washing:          { key: 'washing',          group: 'COGS',        account_code: '5040' },
  finishing:        { key: 'washing',          group: 'COGS',        account_code: '5040' },
  trims:            { key: 'trims',            group: 'COGS',        account_code: '5050' },
  accessories:      { key: 'trims',            group: 'COGS',        account_code: '5050' },
  buttons:          { key: 'trims',            group: 'COGS',        account_code: '5050' },
  packaging:        { key: 'packaging',        group: 'COGS',        account_code: '5060' },
  'quality check':  { key: 'quality',          group: 'COGS',        account_code: '5070' },
  qc:               { key: 'quality',          group: 'COGS',        account_code: '5070' },
  'inbound freight':{ key: 'inbound_freight',  group: 'COGS',        account_code: '5080' },
  vendor:           { key: 'manufacturing',    group: 'COGS',        account_code: '5020' },

  // ── FULFILLMENT (6xxx) ─────────────────────────────────────────────────────
  logistics:        { key: 'shipping',         group: 'FULFILLMENT', account_code: '6010' },
  shipping:         { key: 'shipping',         group: 'FULFILLMENT', account_code: '6010' },
  courier:          { key: 'shipping',         group: 'FULFILLMENT', account_code: '6010' },
  delivery:         { key: 'shipping',         group: 'FULFILLMENT', account_code: '6010' },
  delhivery:        { key: 'shipping',         group: 'FULFILLMENT', account_code: '6010' },
  bluedart:         { key: 'shipping',         group: 'FULFILLMENT', account_code: '6010' },
  warehousing:      { key: 'warehousing',      group: 'FULFILLMENT', account_code: '6020' },
  storage:          { key: 'warehousing',      group: 'FULFILLMENT', account_code: '6020' },
  returns:          { key: 'returns',          group: 'FULFILLMENT', account_code: '6030' },
  commission:       { key: 'commission',       group: 'FULFILLMENT', account_code: '6040' },
  'payment gateway':{ key: 'gateway',          group: 'FULFILLMENT', account_code: '6050' },
  razorpay:         { key: 'gateway',          group: 'FULFILLMENT', account_code: '6050' },
  cod:              { key: 'cod',              group: 'FULFILLMENT', account_code: '6060' },

  // ── MARKETING (7xxx) ──────────────────────────────────────────────────────
  marketing:        { key: 'marketing',        group: 'MARKETING',   account_code: '7010' },
  ads:              { key: 'ads',              group: 'MARKETING',   account_code: '7010' },
  meta:             { key: 'ads',              group: 'MARKETING',   account_code: '7010' },
  google:           { key: 'ads',              group: 'MARKETING',   account_code: '7010' },
  influencer:       { key: 'influencer',       group: 'MARKETING',   account_code: '7020' },
  gifting:          { key: 'influencer',       group: 'MARKETING',   account_code: '7020' },
  'content creation':{ key: 'content',         group: 'MARKETING',   account_code: '7030' },
  photography:      { key: 'content',          group: 'MARKETING',   account_code: '7030' },
  shoots:           { key: 'content',          group: 'MARKETING',   account_code: '7030' },
  'platform fees':  { key: 'platform_fees',    group: 'MARKETING',   account_code: '7040' },
  shopify:          { key: 'platform_fees',    group: 'MARKETING',   account_code: '7040' },
  pr:               { key: 'pr',               group: 'MARKETING',   account_code: '7050' },
  events:           { key: 'pr',               group: 'MARKETING',   account_code: '7050' },
  affiliate:        { key: 'affiliate',        group: 'MARKETING',   account_code: '7060' },

  // ── OPERATIONS (8xxx) ────────────────────────────────────────────────────
  rent:             { key: 'rent',             group: 'OPERATIONS',  account_code: '8010' },
  workspace:        { key: 'rent',             group: 'OPERATIONS',  account_code: '8010' },
  salary:           { key: 'salary',           group: 'OPERATIONS',  account_code: '8020' },
  salaries:         { key: 'salary',           group: 'OPERATIONS',  account_code: '8020' },
  wages:            { key: 'salary',           group: 'OPERATIONS',  account_code: '8020' },
  hr:               { key: 'salary',           group: 'OPERATIONS',  account_code: '8020' },
  contractor:       { key: 'contractor',       group: 'OPERATIONS',  account_code: '8030' },
  freelancer:       { key: 'contractor',       group: 'OPERATIONS',  account_code: '8030' },
  tech:             { key: 'software',         group: 'OPERATIONS',  account_code: '8040' },
  software:         { key: 'software',         group: 'OPERATIONS',  account_code: '8040' },
  subscriptions:    { key: 'software',         group: 'OPERATIONS',  account_code: '8040' },
  travel:           { key: 'travel',           group: 'OPERATIONS',  account_code: '8050' },
  transportation:   { key: 'travel',           group: 'OPERATIONS',  account_code: '8050' },
  conveyance:       { key: 'travel',           group: 'OPERATIONS',  account_code: '8050' },
  'bank charges':   { key: 'bank_charges',     group: 'OPERATIONS',  account_code: '8060' },
  legal:            { key: 'legal',            group: 'OPERATIONS',  account_code: '8070' },
  professional:     { key: 'legal',            group: 'OPERATIONS',  account_code: '8070' },
  gst:              { key: 'compliance',       group: 'OPERATIONS',  account_code: '8080' },
  compliance:       { key: 'compliance',       group: 'OPERATIONS',  account_code: '8080' },
  insurance:        { key: 'insurance',        group: 'OPERATIONS',  account_code: '8090' },
  office:           { key: 'misc',             group: 'OPERATIONS',  account_code: '8099' },
  admin:            { key: 'misc',             group: 'OPERATIONS',  account_code: '8099' },
  food:             { key: 'food_meals',       group: 'OPERATIONS',  account_code: '8099' },
  meals:            { key: 'food_meals',       group: 'OPERATIONS',  account_code: '8099' },
  food_meals:       { key: 'food_meals',       group: 'OPERATIONS',  account_code: '8099' },
  utilities:        { key: 'utilities',        group: 'OPERATIONS',  account_code: '8099' },
  misc:             { key: 'misc',             group: 'OPERATIONS',  account_code: '8099' },
};

// Map group name to category_group stored on bills
const GROUP_TO_CATEGORY_GROUP = {
  COGS:        'COGS',
  FULFILLMENT: 'FULFILLMENT',
  MARKETING:   'MARKETING',
  OPERATIONS:  'OPERATIONS',
};

const DEFAULT_ENTRY = { key: 'misc', group: 'OPERATIONS', account_code: '8099' };

function normalizeCategory(rawCategory) {
  if (!rawCategory) {
    return { category: 'misc', category_group: 'OPERATIONS', account_code: '8099' };
  }
  const key = rawCategory.toString().toLowerCase().trim();
  const entry = CATEGORY_MAP[key] || _fuzzyMatch(key);
  return {
    category:       entry.key,
    category_group: GROUP_TO_CATEGORY_GROUP[entry.group] || 'OPERATIONS',
    expense_group:  entry.group,
    account_code:   entry.account_code
  };
}

function _fuzzyMatch(key) {
  if (key.includes('food') || key.includes('meal'))  return CATEGORY_MAP.food;
  if (key.includes('travel') || key.includes('flight') || key.includes('cab')) return CATEGORY_MAP.travel;
  if (key.includes('fabric') || key.includes('textile')) return CATEGORY_MAP.fabric;
  if (key.includes('manufactur') || key.includes('stitch')) return CATEGORY_MAP.manufacturing;
  if (key.includes('embroid'))   return CATEGORY_MAP.embroidery;
  if (key.includes('packag'))    return CATEGORY_MAP.packaging;
  if (key.includes('ship') || key.includes('logist') || key.includes('courier')) return CATEGORY_MAP.shipping;
  if (key.includes('market') || key.includes(' ad') || key.includes('ads')) return CATEGORY_MAP.marketing;
  if (key.includes('influenc'))  return CATEGORY_MAP.influencer;
  if (key.includes('content') || key.includes('photo') || key.includes('shoot')) return CATEGORY_MAP.photography;
  if (key.includes('salary') || key.includes('wage') || key.includes('payroll')) return CATEGORY_MAP.salary;
  if (key.includes('rent'))      return CATEGORY_MAP.rent;
  if (key.includes('software') || key.includes('tech') || key.includes('saas')) return CATEGORY_MAP.software;
  if (key.includes('legal') || key.includes('profession')) return CATEGORY_MAP.legal;
  if (key.includes('bank') || key.includes('charge')) return CATEGORY_MAP['bank charges'];
  if (key.includes('return'))    return CATEGORY_MAP.returns;
  if (key.includes('gateway') || key.includes('razorpay')) return CATEGORY_MAP['payment gateway'];
  return DEFAULT_ENTRY;
}

// CoA account code for a given channel (revenue side)
const CHANNEL_ACCOUNT = {
  D2C_WEBSITE: '4100',
  MYNTRA:      '4110',
  AJIO:        '4120',
  NYKAA:       '4130',
  INSTAGRAM:   '4140',
  POPUP:       '4160',
  OTHER:       '4150',
};

function channelAccountCode(channel) {
  return CHANNEL_ACCOUNT[(channel || '').toUpperCase()] || '4150';
}

module.exports = { normalizeCategory, channelAccountCode, CHANNEL_ACCOUNT };
