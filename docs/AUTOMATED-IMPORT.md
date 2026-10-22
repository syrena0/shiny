# Automated image and price imports

This is an existing React/Vite static site. Product data lives in `data/products.json`; the admin panel saves browser-local overrides. There is no database, pricing API, authenticated production admin backend, or writable image bucket hidden behind the website.

## Findings and current coverage

All 70 shipped products had `price_azn: null`, no shade prices, and zero retailer offers. The renderer could not truthfully produce a price. An additional bug allowed product cards to take a minimum offer from a different shade/size while showing the default variant's photo. Undefined/invalid values and fallback base prices also needed consistent handling.

The shared pricing module now scopes prices to the displayed shade and size, selects the lowest verified available AZN offer, ignores invalid/non-AZN/out-of-stock offers, normalizes numeric feed prices (including decimal commas), and displays an explicit localized unavailable message. A base reference price applies only to the default variant unless explicitly declared `pricing_scope: "all_variants"`. Other manually entered prices are labeled reference prices. Card shade selection carries into its detail/compare view. Detail size selection uses explicit `variants` records and exact-size offers. Filters and sorting use the same default-variant price as the initial card. No prices were fabricated: **0/70 currently have verified prices; all 70 need retailer data**. See `data/verification-report.json` or the admin report download for their names.

The available reusable source is Open Beauty Facts: ODbL/DbCL database and CC BY-SA 3.0 photographs. Its community collection mixes studio photos and consumer snapshots. Visual review retained **41 primary product images** and rejected **29 primary images plus one additional shade image**. Rejected assets are quarantined and no longer used as primary product/shade photos. Old saved catalogs are protected by the same URL rejection policy. Missing variants use a clean placeholder, never another shade's photo.

The built-in `data/studio-feed.csv` has **51 exact SKU image records** across those 41 products. Where available (45 records), it uses source-declared full-resolution photos. This subset can be imported without supplier credentials. It is not a complete 200-product studio photo library and supplies no Azerbaijani prices.

## Import without downloading individual photos

In the existing admin panel, expand **Image & price verification**. Download the CSV template, preview a supplier CSV, inspect row-level errors, apply permitted price/catalog updates, download the verification report, and approve or reject quarantined image candidates. CSV uploads never publish an arbitrary remote image URL as a primary photo.

To download and optimize images into this project's storage, choose either:

1. **Local worker:** run the existing website locally and, in another terminal, `npm run import:server`. Open its existing local admin panel, select the CSV file, preview it, then choose **Download and optimize images**. This processes all image URLs in the feed automatically, writes optimized files and `data/products.json`, and reloads the catalog into the admin session. The worker listens only on loopback port 5180 and accepts only the known local development/preview origins. Never expose this unauthenticated local worker to the public Internet.
2. **Repository job:** configure an authorized source once, then run the **Import authorized product feed** GitHub Actions workflow with its source ID. It fetches the configured feed, downloads permitted images, validates/builds, and commits files to `main` using the repository's built-in workflow token. A connected deployment must permit builds for workflow-created commits; if an installation skips these, trigger its deployment hook or deploy the resulting commit in the hosting dashboard. This avoids a permanent publicly writable backend.
3. **CLI:** `npm run import:feed -- path/to/feed.csv` previews only; add `--write` to download and apply. Normalized JSON arrays are also supported. `npm run import:feed -- --source open-beauty-facts --write` fetches the bundled licensed studio subset from the deployed website after this release is live.

The hosted Vercel frontend can preview/import browser-local data and review/export results. It cannot write into a GitHub repository or persist new files in a static deployment. Running its local-worker button on a hosted URL gives an explicit explanation, not a false success. For a fully hosted one-click importer with shared admin changes, supply an authenticated backend and writable object storage (for example a server-side storage service); never put its secrets in the Vite bundle. Browser-local approvals can be published by exporting products JSON and importing that catalog into the repository. Existing downloaded candidate files are already present in project storage.

## Authorize a supplier once

Add a source entry to `data/import-sources.json` with:

- Stable source `id`, `enabled`, `kind`, public `terms_url`, precise image `license`/permission identifier, `license_url`, and data license.
- Explicit `image_hosts` for permitted image downloads and `page_hosts` for source pages.
- Optional `feed_url`, `feed_hosts`, and `feed_format` (`csv` or `json`) for automatic fetching.
- Optional `records_path` and `field_map` mapping our normalized columns to dotted supplier fields; `defaults` can provide source-supplied constants. Example: `records_path: "products"`, `field_map: {"gtin":"barcode","brand":"brand.name","product_name":"title","image_url":"photo.url"}`. Each row must identify one SKU/variant; nested variant arrays need a vendor adapter/export that flattens them first. No fuzzy matching is used.
- `trusted_studio: true` only when the supplier contract/feed explicitly guarantees studio-only assets with correct SKU mapping. Otherwise downloads are quarantined for visual approval. An exact `approved_assets` URL allowlist can authorize an already visually reviewed subset, as in the built-in public source. Visually approved original byte hashes can also be stored as `approved_sha256`, avoiding repeated background-heuristic flags for the same reviewed image.
- For retailer prices: `price_import: true` and explicit `price_hosts`. Every row still needs its verification evidence.
- Optional `token_env` / `image_token_env` are **names** of server/CI environment variables containing bearer tokens. Provide credentials privately to that process or configure a GitHub Actions secret and explicit job environment binding. Do not commit token values or signed/token-bearing URLs. Tokens are only sent to the original configured host, not to redirect destinations.

Authorization metadata is a supplier/operator attestation, not a license automatically inferred from a public URL. Sephora or Google search results are not permission to reuse images. A supplier feed, licensed dataset, affiliate/catalog API, or explicit image-reuse permission can be used once its terms are recorded. Current network restrictions may also require authorizing additional supplier/CDN domains in the execution environment.

## Normalized CSV

Use UTF-8 (BOM accepted), comma separation, RFC-style quoted/escaped fields. GTINs are strings to preserve leading zeroes. One row represents a product + shade + size + store offer. The template lists all supported columns.

Required identity: `source_id`, `brand`, `product_name`; use `product_id` or exact `gtin` for reliable existing matches. New products additionally need a real GTIN and supported `category`. Brand/name, GTIN owner, shade and size must agree. An ambiguous or conflicting row rejects the catalog import without partial price changes. New variants need distinct exact GTINs; multiple sizes use product `variants` records. Matching does not infer colors from pixels or similarity in product names.

Image fields: `image_url`, `image_source_url`, `image_license`, `image_author`, `image_type=studio`, and `background=white|neutral|transparent`. Review/influencer photos, screenshots, collages, banners and missing/unknown photography classifications are excluded from primary imports. Conflicting image URLs for the same SKU must be resolved before importing.

Price fields: `store`, `price` (decimal number, no currency text), `currency=AZN`, `market=AZ`, `price_verified=true`, `purchase_url`, `price_source_url`, `last_checked=YYYY-MM-DD`, exact `shade` (empty for unshaded products), exact `size`, and `online_available` / `physical_available` (`true`, `false`, or empty for unknown). Both links must belong to an authorized retailer host. Foreign prices are not silently converted or represented as local offers. No feed is currently authorized for real retailer prices; provide a retailer/supplier feed or source export with this evidence.

## Download, quality and storage behavior

The worker validates HTTPS hosts and redirects, rejects IP URLs, credentials in URLs and secret-bearing query strings, bounds time and download size, rejects unsupported/animated/blank/low-resolution images, and prevents oversized pixel decoding. Direct connections check public DNS destinations; when using an operator-configured egress proxy, that proxy resolves DNS and must enforce private-network blocking. This environment uses that managed proxy. Source registries are trusted repository configuration, never anonymous user input.

Sharp creates content-hashed WebP files under `public/products/imported/`, with card images up to 600px and detail images up to 1200px, without enlargement. Photos are oriented, flattened on white, resized and encoded; products are never generated, recolored, cropped or stretched. License/author/source URL, original and optimized hashes, transformation description, and review state stay attached to the asset. Optimized source derivatives retain their source license.

Neutral border checks are conservative heuristics, not a semantic image classifier. They cannot prove an image depicts the right product or reliably detect a mislabeled collage. Exact feed identity, authorized photography classifications and source trust are therefore required; uncertain/untrusted candidates stay out of primary display pending review. A failed or pending replacement does not remove an existing approved photo for that variant.

Writes are staged; the catalog is validated before being atomically replaced, after image files exist. A failed image is recorded for review. `data/import-report.json` stores the latest worker decisions; product `image_reviews` stores candidates and later approvals. Dry runs perform no downloads and write no data. GitHub job concurrency prevents overlapping automated imports; do not run a CLI import and local worker simultaneously on the same checkout.

## Checks

Run `npm run audit:assets`, `npm run audit:catalog`, `npm run lint`, `npm run typecheck`, `npm run build`, and the production Playwright tests. Regression coverage includes 200-row imports, CSV quoting and leading-zero identifiers, wrong brand/shade/size/GTIN rejection, permission/source validation, malformed prices, available offer minimums, mobile shade/size price changes, placeholders, historical saved catalogs, and existing calendar/admin/favorites behavior.

The real source import was executed successfully for all 51 studio SKU records, using full-resolution files for 45 where declared. The optimized outputs were visually reviewed and approved; 102 WebP files occupy approximately 2.3 MB. Conservative automatic border flags remain in the machine-run report; subsequent approvals are recorded on the catalog image reviews. No supplier credentials were required for this licensed subset.

Final validation: production build, lint, TypeScript and local asset checks pass. All **39 Playwright tests** pass, including the 200-row workload and existing calendar, favorites, language and admin functionality. The final measured 200-record index plus 100 queries took 18.3 ms locally; this is a test-environment measurement, not a public-site speed score. The local worker additionally rejected an untrusted origin with HTTP 403 and an unauthorized CSV with HTTP 422 without changing the catalog.
