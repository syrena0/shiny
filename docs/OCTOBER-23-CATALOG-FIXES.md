# Owner catalog publication and functional fixes — 23 October 2026

The existing React/Vite design, typography, palette, layout and calendar have been retained.

## Actual causes

- Homepage artwork used fixed file paths, independently of the product edited in admin. It now resolves the same product/default variant as the catalog.
- Editing a main photo could leave `shade.images` or explicit variant galleries pointing to the previous photo. Those arrays had higher display priority. Main uploads now update the default variant and its shade; editing another size does not overwrite every size.
- Admin changes are stored in browser LocalStorage. They were never shared with other devices. The supplied owner JSON is now published in the repository, with embedded uploads externalized to content-addressed WebP files. Unchanged fields in older saved catalogs are upgraded using previous-field fingerprints; custom local values are preserved. This is a publication migration, not a shared database.
- Prior published product prices were null and no verified retailer offers existed. Missing prices were a data gap, not hidden CSS. The owner's 70 prices are restored as reference prices. Six source-checked Olivia offers override reference prices only for their exact shade and size.
- Premium classification used a short, case-sensitive brand list. Shared normalized classification now includes MAC, Clarins, Lancôme and other premium brands, with an editable per-product override.
- Admin had no category, skin type, finish, coverage or real verified-offer editing. These controls are now functional and used by storefront filters.

## Published data

- 70 product records; all 12 existing categories retain at least five products each.
- 70 products show a default-variant AZN amount: three use verified Olivia prices, 67 use explicitly labelled owner reference prices. No retailer price was invented.
- Six Olivia offers, checked 2026-10-23: Fit Me Matte + Poreless 110/105/115, 30 ml, 16.49 AZN; Lifter Gloss 004/002, 5.4 ml, 16.79 AZN; Sky High Black, 7.2 ml, 20.29 AZN. Current visible prices were cross-checked against structured data. Physical-store stock remains unknown. Purchase URLs and evidence hashes are in `data/retailer-evidence.json`.
- 69 primary product photographs and one clean placeholder. 35 accepted owner-uploaded image files were optimized and published. These are owner-supplied assets, not newly obtained third-party image licenses. Manufacturer shade codes or reuse rights that cannot be established remain pending in the verification dashboard.
- 36 primary images have existing approved studio-review metadata; the remaining 34 records require attention (33 owner-photo records, one missing photo). Presence is not represented as independent exact-shade or license verification.
- Manufacturer-backed skin/finish/coverage information added to five product lines: Maybelline Fit Me foundation/concealer/powder, Instant Age Rewind concealer and e.l.f. Power Grip Primer. Supporting claims and source hashes are in `data/trait-evidence.json`. Unknown traits stay unselected; no broad dry-skin foundation claims were fabricated.
- No new product lines were invented or added; this update restores and improves the supplied 70-record catalog.

## Photo and identity exceptions

`data/owner-import-report.json` lists all exceptions. In particular:

- The Sky High upload showed original Lash Sensational. The existing exact licensed Sky High image was retained.
- The Lavera powder upload showed L.A. COLORS. A placeholder is shown until a correct photo is available.
- A promotional Maybelline photo labelled 120 was excluded from product 125; the owner's bottle photo labelled 125 is used.
- Dior generic shade names are retained as owner entries and flagged for actual manufacturer codes. No code was inferred from a photograph's color.
- The owner changed an Essence primer to SHEGLAM. Unrelated Essence barcode, source attribution and volume were removed; exact SHEGLAM model still needs a source.
- The CeraVe owner image shows a tub, so the earlier tube volume was removed rather than transferred to that photo.

## Admin workflow

Edit category, brand tier, size, skin types, finish and coverage in Product attributes. Enter a supporting manufacturer/product URL when adding attributes. Main image edits affect the default variant, including homepage artwork. Separate shade images and explicit size variants remain separate.

Use Add retailer offer to enter a source-checked AZN quote: exact shade, volume, current amount, exact product URL, checked date and known online/physical stock. Tick the verification declaration only after checking the source. Invalid verified offers cannot be saved. Product cards and dialogs use only matching offers and show the lowest available verified price. Blank or unknown values are never converted to zero.

The existing CSV feed import, licensed-source registry, image optimizer and verification dashboard remain available. Owner-photo review candidates now show the actual supplied images; superseded historical assets cannot accidentally replace them through an old review button.

## Remaining integrations

Future admin edits still persist only in the editing browser. A shared authenticated backend with persistent image/object storage is required for live, cross-device admin publishing. Do not place database or storage service-role keys in browser code. Until that is configured, export/import and a repository publication remain the supported path; this supplied catalog has been published for all visitors.

BirMarket, Rossmann, Fenty and NYX official sources were inaccessible from this execution environment. Adore's accessible site exposed corporate/brand information, not verifiable exact-product online prices. An older Dior foundation URL redirected to a different current product, so its price was not assigned to the old formula. No quotes, availability or foreign-to-AZN conversions were invented. Remaining 67 products need source-checked AZN retailer offers; the existing admin form or supplier CSV can populate them. Provide an accessible exact-product feed/API or product URLs for these retailers, and reuse authorization for images to be imported. Complete additional shade collections require exact shade identifiers and permitted studio photos from such a source.

## Validation

Production build, lint, TypeScript, catalog validation and local asset-reference audit are required. The regression suite checks image edits, variant/size isolation, browser migrations, offer editing, filters, languages, calendar, desktop/mobile/tablet layout and a 200-record test-only workload. No test products are published.

Final local results: `npm run lint`, `npm run typecheck`, `npm run audit:assets` and `npm run build` all passed. All **45 Playwright tests passed against the production build**. Asset audit found **zero missing local assets and zero remote primary image dependencies**. The 200-record search workload completed 100 queries in approximately 13 ms in this environment. New owner WebP files total approximately 216 KB; the production catalog JSON is approximately 359 KB uncompressed / 29 KB gzip.
