import { site } from '../config/site';

export const formatMoney = value => new Intl.NumberFormat(site.currency.locale, {
  style: 'currency',
  currency: site.currency.code,
  maximumFractionDigits: 0
}).format(value);

export const variantKey = (product, options = {}) =>
  `${product.id}|${Object.entries(options).sort(([a],[b]) => a.localeCompare(b)).map(([k,v]) => `${k}=${v}`).join('&')}`;

export const optionSummary = (options = {}) =>
  Object.entries(options || {}).map(([key, value]) => {
    const label = key.charAt(0).toUpperCase() + key.slice(1);
    return `${label}: ${typeof value === 'object' && value !== null ? value.label : value}`;
  }).join(' · ');

const optionGroupsFor = product =>
  Array.isArray(product?.optionGroups) ? product.optionGroups
    : Array.isArray(product?.options) ? product.options
    : [];

const selectedLabel = value => typeof value === 'object' && value !== null ? value.label : value;

const matchingOptionValue = (group, selected) =>
  (group.values || []).find(value => selectedLabel(value) === selectedLabel(selected));

export const optionAdjustment = (product, options = {}) => {
  return optionGroupsFor(product).reduce((sum, group) => {
    const selected = options?.[group.key];
    const value = matchingOptionValue(group, selected);
    if (!value || typeof value === 'string') return sum;
    const amount = Math.max(0, Number(value.amount || 0));
    if (group.pricing === 'subtract') return sum - amount;
    if (group.pricing === 'add') return sum + amount;
    return sum;
  }, 0);
};

export const optionDetails = (product, options = {}) => {
  return optionGroupsFor(product).map(group => {
    const selected = options?.[group.key];
    if (selected === undefined || selected === null || selected === '') return null;
    const value = matchingOptionValue(group, selected);
    const label = selectedLabel(selected);
    if (!value || typeof value === 'string') return `${group.label || group.key}: ${label}`;
    const amount = Math.max(0, Number(value.amount || 0));
    const adjustment = group.pricing === 'subtract' ? -amount : group.pricing === 'add' ? amount : 0;
    const suffix = adjustment > 0 ? ` (+${formatMoney(adjustment)})`
      : adjustment < 0 ? ` (-${formatMoney(Math.abs(adjustment))})`
      : '';
    return `${group.label || group.key}: ${label}${suffix}`;
  }).filter(Boolean);
};

export const priceBeforeDiscount = (product, options = {}) =>
  Math.max(0, Number(product.price || 0) + optionAdjustment(product, options));

export const discountAmount = (product, options = {}) => {
  const rate = Math.max(0, Math.min(100, Number(product.discount_percent || 0)));
  return priceBeforeDiscount(product, options) * rate / 100;
};

export const finalUnitPrice = (product, options = {}) =>
  Math.max(0, priceBeforeDiscount(product, options) - discountAmount(product, options));

export const checkoutUrl = (items, total) => {
  const lines = items.map(item => {
    const options = optionDetails(item, item.options).join(' · ');
    const unit = finalUnitPrice(item, item.options);
    return `${item.qty} x ${item.name}${options ? ` (${options})` : ''} - ${formatMoney(unit * item.qty)}`;
  });
  const text = `Hello ${site.brand}, I'd like to order:\n${lines.join('\n')}\nTotal: ${formatMoney(total)}`;
  return `https://wa.me/${site.whatsapp}?text=${encodeURIComponent(text)}`;
};
