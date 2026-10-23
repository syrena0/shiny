# Dupe finder and retailer comparison — 23 October 2026

## Completed

- The existing “Find your dupe” entry now opens `/#dupes`, including on reload and shared links.
- Eight premium product lines have ten editorial alternatives displayed alongside them, with photos, variant names/sizes, AZN amounts, reference-price labels, product links and explicit differences.
- Data remains in `data/products.json`. `data/dupe-evidence.json` records the curation and source URLs. Product-category/format similarities are editorial suggestions, not measured formula equivalence. No numerical match percentages are invented; these relations use `match_percentage: null`.
- Exact missing alternative shades are excluded instead of silently falling back to another colour. Ruby Woo opens Maybelline SuperStay Matte Ink **20 Pioneer**, with a studio photograph from the attributed Open Beauty Facts CC BY-SA source. It does not open the previously default nude Seductress colour.
- Alternative-brand search and brand filters work in the dupe finder. Price range and price sorting there use the lowest recorded alternative-variant amount, not the premium product's amount. The normal catalog retains its original pricing/search behavior.
- The modal also shows these alternatives, and each alternative can open its exact variant or its store offers. AZ, EN and Cyrillic RU translations are included.
- Three additional Olivia quotations were checked against the exact product pages, visible current prices, structured data and shade/volume attributes: SuperStay Matte Ink **15 Lover** and **20 Pioneer**, **5 ml**, **20.49 AZN**; SuperStay Vinyl Ink **25 Red-Hot**, **4.2 ml**, **20.49 AZN**. Physical-store stock is unknown. Evidence and page hashes are in `data/retailer-evidence.json`.
- The catalog now contains **nine verified AZN offers across five product lines**. Four default variants have verified prices; other variants/prices are displayed according to their own evidence or explicitly labelled owner references.
- The comparison section represents Olivia, Rossmann and BirMarket. An exact source-checked quotation is shown as a price; absent quotations are marked as unavailable data, not as zero, out of stock or an invented retailer price. Generic retailer-site links are labelled as such, separately from exact-product purchase links.

## Remaining retailer access

Only Olivia can currently be researched successfully. Both `rossmann.az` and `birmarket.az` return proxy CONNECT 403 because they are missing from the active environment's domain allowlist. Sabina returns an upstream TLS-certificate failure. Adore's accessible site has corporate/brand information but no source-verifiable exact-product online prices. The Google research fallback returned an unusual-traffic challenge; no challenge was bypassed and no cached or unverified price was promoted to a verified quote.

A network configuration **draft was successfully saved** retaining the existing domains and adding `rossmann.az`, `www.rossmann.az`, `birmarket.az` and `www.birmarket.az`. The tool returned `requires_publish: true`. This does **not** activate or publish the configuration. The user must review/save the changes in Codex environment settings and Publish the environment before research of those stores can proceed. Three-store live price coverage is therefore **pending**, not complete. No API credentials have been requested or embedded.

Clarins' owner reference price is lower than the available candidate primers, and no sufficiently appropriate NARS tinted-moisturizer replacement is sourced in the current catalog. These two premium lines are not given misleading “cheaper dupes” merely to populate every slot.

The original appearance, homepage artwork, calendar, admin workflows, favorites and catalog remain in place. No automatic shared backend was added; the existing local-admin publication limitations remain unchanged.

## Validation results

`npm run lint`, `npm run typecheck`, `npm run audit:assets` and the production build passed. All **50 Playwright tests passed against the production build**. This includes new pair/variant navigation, alternative-price filtering, retailer data gaps, all languages and 360/390/768/1440 px layouts. A publication migration was also corrected to avoid adding alternative references to products absent from an intentionally smaller imported catalog. The asset audit reports no missing local assets; the 200-record test-only workload completed 100 searches in approximately 21 ms on this run.
