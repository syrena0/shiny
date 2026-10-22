# SHINY real product photo catalog — 22 October 2026

Historical integration record. The current studio-only review, coverage and importer are described in [AUTOMATED-IMPORT.md](AUTOMATED-IMPORT.md); unsuitable primary images described below have since been quarantined.

The default catalog now contains **70 real product lines**, all with authentic source photographs: 10 foundations, 10 lipsticks, and 5 each of blush, concealer, mascara, powder, highlighter, eyeliner, primer, moisturizer, and makeup remover. Five pre-existing IDs retain their identity; 65 new product lines were added. Unillustrated demonstration records were removed from the default catalog, rather than assigning them another product's photograph.

**81 independently identified photographed SKUs** include 11 additional shade variants. Five lines support multiple photographed shades: Maybelline Fit Me Matte + Poreless, Catrice HD Liquid Coverage, e.l.f. Halo Glow Highlight Beauty Wand, Maybelline Lifter Gloss, and Maybelline SuperStay Matte Ink. Shade names and GTINs come from the source records; no hex colors or undertones were inferred from photographs. Not every manufacturer's shade is available in this source. Further variants require exact-shade licensed photographs and matching product identifiers.

## Sources and rights

- Product information: Open Beauty Facts community database, ODbL 1.0; individual contents DbCL 1.0.
- Photographs: CC BY-SA 3.0, per https://world.openbeautyfacts.org/data and https://world.openbeautyfacts.org/terms-of-use, checked 22 October 2026.
- `data/photo-attribution.json` lists every selected SKU, original community product name, source page, credited image uploader (when available), source-selected front image URL, license, dimensions where declared, and SHA-256 for every mirrored file. Where uploader metadata is absent, the original source page provides the contributor history.
- JPEGs in `public/products/authentic/` are unmodified copies of source-selected front images. Resolution and quality vary by contributor; they are not represented as brand-supplied studio assets. Ambiguous multi-shade group photos and several back-label-only photos were excluded.
- Credit and license links appear in each product dialog and below the footer. The adapted database and attribution manifest are downloadable from `/data/products.json` and `/data/photo-attribution.json`; notices are at `/data/LICENSE.txt`.

## Behavior and migration

Cards use locally mirrored 400px source photos with lazy loading; dialogs use source-declared larger versions where available. No CSS recoloring or generated product imagery is used. Exact shade selection changes the selected SKU photograph and continues to scope verified offers to the selected shade/size. Unknown colors use the real photograph in the shade selector.

Existing full browser-saved catalogs are reconciled with the bundled catalog so deployment does not leave users stuck on the previous 15 placeholders. Known unchanged placeholder records receive matched authentic photographs; user-entered prices and uploaded photos are preserved. Older unmatched records and custom products remain available to their owner. Standalone imported catalogs are preserved. Storage is not overwritten during this read-time migration.

The Candy Calendar retains its design and three slots per month, with all current editorial selections referencing photographed products. Future months remain coming soon.

## Data still required

No verified Azerbaijani retailer feed was supplied. New source records therefore have no claimed price, stock, retailer link, review rating, skin suitability, or similarity score. They explicitly report unverified prices and availability. Community records are traceable, not manufacturer-verified. The catalog remains below the earlier 200-product goal; this change implements the user's revised 70-product request.

Bulk additions use `npm run import:catalog -- path/to/catalog.json` (dry run) and `--write` after review. Follow `DATA-CONTRACT.md`; retain exact SKU source/rights metadata and mirror only images covered by the stated license. Do not add stock photos or fabricated products to meet quotas.

## Validation

`npm run lint`, `npm run typecheck`, `npm run audit:assets`, and `npm run build` pass. The asset audit reports 70 sourced products, zero placeholder-only products, zero missing local assets, and a valid schema. All 26 production browser tests pass, including all four catalog pages loading their real images, exact photographed shade switching, source/license links, migration preserving admin edits, calendar navigation, mobile layouts, favorites, imports, and the separate 200-record test workload. The 200-record index plus 100 queries measured 18.7 ms in the final local test run (environment-specific, not a public-site speed score).
