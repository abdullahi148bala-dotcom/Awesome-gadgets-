# Web Forge

Reusable, mobile-first storefront template.

## Client setup

Edit only these files for normal client work:
- `src/config/site.js` — brand, currency, WhatsApp, theme, feature flags, labels and copy.
- `src/data/products.js` — products, prices, categories, images, descriptions and options.

Product components and page logic are reusable.

## Product options

Products can define option groups such as Size, Color or Storage. Each selected combination is stored as its own cart variant.

## Checkout

Cart checkout builds an order message and opens the configured WhatsApp number. Set `site.whatsapp` to the client's international number without a leading plus sign.

## Development

Run `npm install`, then `npm run dev`. Use `npm run build` to verify production output.
