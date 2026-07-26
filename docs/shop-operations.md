# Shop operations

## Database boundary

Every application table introduced by the shop uses the `tochukwu_shop_` prefix:

- `tochukwu_shop_products`
- `tochukwu_shop_product_variants`
- `tochukwu_shop_variant_prices`
- `tochukwu_shop_orders`
- `tochukwu_shop_order_items`
- `tochukwu_shop_digital_entitlements`
- `tochukwu_shop_shipments`

The checked commerce migrations are:

- `20260725120000_add_shop_commerce`
- `20260726100000_add_shop_cloudinary_assets`
- `20260726140000_add_shop_multicurrency_prices`
- `20260726160000_add_shop_order_processing_fee`

## Initial workbook catalogue

Run `npm run db:seed:shop` to prepare Workbooks 01–05 as drafts. The seed is safe to repeat.

Run `npm run shop:publish:workbooks` to apply the approved catalogue copy, SEO
content, cover images and prices, then publish all five workbooks. The approved
base price for each workbook is:

- NGN 10,000
- USD 20
- GBP 20
- EUR 20

Products, formats and prices can also be managed at `/internal/shop`.

## Runtime settings

- `SHOP_NIGERIA_SHIPPING_MINOR` — delivery charge in kobo for physical products.
- `SITE_VAT_PERCENT` — VAT added to NGN orders. It currently resolves to 7.5%.
- `INTL_VAT_PERCENT` — VAT added to international-currency orders. It currently resolves to 20%.
- `STRIPE_FEE_BPS` — Stripe percentage-fee setting.
- `STRIPE_FEE_FIXED_USD_MINOR`, `STRIPE_FEE_FIXED_GBP_MINOR` and
  `STRIPE_FEE_FIXED_EUR_MINOR` — fixed Stripe fee settings in minor units.
- `PAYSTACK_SECRET_KEY` — required for NGN checkout.
- `STRIPE_SECRET_KEY` — required for non-NGN checkout.
- `PAYSTACK_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` — used to verify provider webhooks.
- `AUTH_SECRET` — signs temporary guest download links.
- `CLOUDINARY_CLOUD_NAME` — Cloudinary product environment.
- `CLOUDINARY_API_KEY` — server-side Cloudinary API key.
- `CLOUDINARY_API_SECRET` — server-side signing secret. Never expose this in browser code.

Printed products are restricted to delivery within Nigeria in the first release. Digital products do not request a delivery address.

## Payment safety

Shop payments set `payment_scope=shop_order`. Paystack and Stripe returns and webhooks route that scope to shop fulfilment before the existing course fulfilment fallback.

Prices, stock, VAT, processing fees, shipping and totals are recalculated on the
server. Browser-submitted prices are never trusted. NGN checkout uses the
existing Paystack gross-up rule (1.5%, plus NGN 100 above NGN 2,500, capped at
NGN 2,000). International checkout uses the existing Stripe fee settings listed
above. The order records base price, VAT, processing fee, shipping and final
total separately.

## Digital files

Run `npm run shop:upload:workbooks` to upload the five source PDFs. Each upload is stored with:

- Resource type `raw`
- Delivery type `authenticated`
- A stable `tochukwu-shop/workbooks/` public ID

The upload script verifies that signed delivery returns a PDF and that the corresponding unsigned URL is rejected before recording the asset on its product variant.

The database stores the Cloudinary public ID and delivery metadata, not a public file URL. A paid customer starts with an authenticated student session or a signed guest email link. The shop verifies the entitlement and then generates a Cloudinary download URL that expires after two minutes.

The Cloudinary product environment must allow PDF and ZIP delivery. The API secret remains server-side.
