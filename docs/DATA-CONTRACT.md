# Catalog ingestion and scale contract

The production catalog remains `data/products.json`. It contains 15 legacy sample records; none have licensed authentic photos or verified AZ offers. Test-only synthetic records live in the test code, never in this JSON or the production build.

## Shared validation

`src/lib/catalog-schema.js` is the runtime validator used by browser storage, browser import and the CLI. It supports up to 20,000 records, nullable unknown prices/ratings, and zero shade variants. It checks IDs, categories, translations, prices, ratings, galleries, dates, duplicate shade names, store samples and dupe references. Invalid imports are atomic: no partial records are applied. Corrupt browser storage is preserved for download while the bundled catalog is displayed safely.

Required product fields:

| Field | Meaning |
| --- | --- |
| `id`, `brand`, `name` | Stable nonempty strings; IDs must be unique. Do not generate pretend products or use an array index as a real SKU. |
| `category` | One of the existing 12 category keys exported by the validator. |
| `price_azn`, `rating` | Nonnegative number, rating at most 5, or `null` if unknown. Never substitute zero for missing prices. |
| `image` | HTTPS URL, a local `/products/…` path, a supported uploaded raster data URI, or empty string for unavailable images. |
| `description` | Object with string values for `az`, `en`, `ru`. Empty strings can represent missing source copy; do not invent product claims or translations. |
| `skin_type` | Array using the existing AZ skin-type keys; empty if not sourced. |
| `finish` | Existing finish key or `null` if not sourced. |
| `shades` | Array; empty for products with no confirmed shade information. Never add generic shades to skincare to fill the field. |
| `stores`, `dupes` | Existing sample/editorial arrays; use empty arrays when no data exists. Not verified retailer offers. |

Optional fields: `size`, `brand_tier` (`premium`/`affordable`), `images`, `default_shade`, `offers`, `provenance`. A `default_shade` only permits base-image reuse when it names that exact shade. Otherwise an absent variant image becomes a placeholder, not another shade's photo.

Each shade has `name`, `hex` (hex code or `null` if unknown), `undertone` (`warm`, `cool`, `neutral`, or `unknown`), plus optional `image`, `images`, `price_azn`, and `size`. Only add shade names and swatch colors supported by source data. The application cannot independently authenticate a supplier's factual claims.

## Image rights and responsive assets

An image asset can be a URL or `{url, sourceUrl, license, author?, width?, height?, sources?: [{url, width}]}`. The browser uses supplied widths as `srcset`; it does not guess CDN transformation URLs. Images use lazy loading and asynchronous decoding. Layout dimensions remain stable in the existing cards. Raster uploads are resized to 1000 pixels and WebP by the existing admin flow.

Every sourced external photo must include its actual permission/license statement and source URL. All responsive variants must be permitted under that statement. An image URL alone is not proof of licensing or correct product/shade identity. Do not use code-repository licenses to assume rights over third-party retailer photos. Known neutral placeholders remain available, but legitimate SVG assets are no longer automatically hidden.

## Provenance and importing

New source-backed records require `provenance` with HTTPS `source_url`, `retrieved_at` as a real YYYY-MM-DD date, `kind` (`manufacturer`, `retailer`, `community`), and nonempty `license`. This is a declaration to be reviewed, not a claim of independent verification. The CLI checks rights metadata for external photos. The browser requires provenance and rights on newly added IDs; it supports updating/exporting existing local-editor records without inventing new rights declarations.

Use the admin **Import catalog** control to select normalized JSON up to 10 MB. It previews new/update counts, then upserts by stable ID after an explicit Save import action. Other records are preserved. Unsaved edits and LocalStorage quota errors remain visible. Local changes do not affect other visitors until exported data is deployed.

Use the same normalized input for reproducible file-based ingestion:

```sh
npm run import:catalog -- /path/to/authorized-products.json
# Review the dry-run report before replacing the bundled catalog:
npm run import:catalog -- /path/to/authorized-products.json --write
```

The default CLI mode does not modify files. `--write` validates the merged catalog and atomically replaces the target through a temporary file. `--target /path/to/products.json` supports staging. It never manufactures records to reach a target count. Invalid data, missing image rights, duplicate IDs, and unresolved dupe references fail with record/field diagnostics.

## Offers, ranking data and performance

See `src/lib/offers.ts` and the existing README for the AZ/AZN verified-offer contract. Purchase/source URLs must be real HTTPS URLs without embedded credentials; impossible/future dates and duplicate offer IDs are rejected. `shade: null` represents a shade-free product; absent size or unknown selected shade cannot produce a verified comparison. The feed provider must verify factual accuracy, exact variant identity and permission to use its data.

The existing calendar keeps all 12 month candies and three product slots. It uses editorial selections until actual sales reports exist. No new rankings or future-month sales claims are generated.

Client display is paginated at 18 products, with an indexed, whitespace/diacritic-tolerant search and cached offer metadata. Unknown prices sort last and are excluded from numeric price filters. Images for other catalog pages are not mounted. Browser loading tests use 200 **test-only** records and assert that initial catalog image requests cannot exceed the visible page size.

There is no connected database. Client-side indexing is not database filtering. A future database integration needs an agreed provider, authenticated write policy, a server-side query endpoint with equivalent filter/pagination semantics, and configured credentials. No secret values belong in browser code or chat.

Hashed build assets receive immutable caching configuration in `vercel.json`; local product files use a bounded cache duration. Netlify equivalents are in `public/_headers`. These policies are prepared locally and require deployment to take effect. Remote image-CDN caching is controlled by the authorized asset provider.
