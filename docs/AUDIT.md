# Shiny feature audit — 22 October 2026

Scope: inspected and incrementally updated the existing React/Vite checkout; did not rebuild the site. The supplied 21st.dev flip-card reference is used for the twelve month chocolates. No candy-box image or product-detail reference screenshots were attached, so the written visual specification informed the illustration. This report concerns the local source/build, not a deployment to the supplied Vercel site.

| Area | Before | Result / remaining dependency |
| --- | --- | --- |
| Product imagery | Generated SVG packaging carried brand names; no authentic photography | Removed generated branded packaging. Localized placeholders, image loading/error handling, and uploaded/authorized asset support. Exact licensed product and shade photography still required. No random stock images were substituted. |
| Shade selection | Functional color, name, image and optional price overrides from local admin | Retained; added per-variant galleries, gallery reset on shade change, size context, and exact-variant offer filtering. Generic sample shades remain labelled sample data, not asserted official shade ranges. |
| Product detail design | Modal with image on left, details on right; no gallery | Details on left, image and vertical thumbnails on right; mobile stacking, compare button, size state, local language selector, and shareable product fragment URLs. |
| AZ price comparison | Sample stores/prices, stock flags and placeholder purchase URLs | Verified-offer adapter requires AZ/AZN, explicit verification, source/purchase URLs, date, exact shade and size. Prices sorted ascending, lowest highlighted; online/physical availability and optional location. With no feed, shows unavailable state; legacy sample rows are separately collapsed. |
| Homepage | Existing cream/pink identity, catalog, search, dupe section | Preserved. Added one lavender/cream chocolate calendar section with navigation entry. Removed fake branded illustrations without manufacturing replacement photos. |
| Discovery | Search, category/price/skin/tier filters and price/rating sorting | Added shade-name search, brand filter, product-type filter, verified availability and store filters. No fabricated store choices when verified data is absent. |
| Languages | AZ default, EN and Cyrillic RU | New calendar, gallery, comparison and filter labels translated. Month, shade and gallery selections persist across language changes. |
| Categories / brands | Existing 12 categories / 15 sample products | Preserved working catalog. Schema accepts additional catalog brands; accurate additional brand/product/shade records require sourced data. No invented products added to satisfy brand coverage. |
| Interactions | Favorites, local editor, dialogs and shade controls | Retained and regression-tested. Added accessible keyboard/touch flips, wrapped-candy transitions, editorial product reveal, deep links, gallery handling and comparison focus. Fixed same-document product-link synchronization and flip-card face stacking. |
| Responsive | Existing mobile app | Calendar verified at 360, 390, 768 and 1440 pixels; desktop cards in three columns and mobile cards stacked. Fixed narrow-screen overflow. Motion respects reduced-motion preferences. |

## Calendar data and truthfulness

`src/data/calendar.ts` defines twelve entries with exactly three product slots each. January–October currently contain explicitly labelled sample editorial picks from the existing catalog. November–December are coming soon. Runtime market time is Asia/Baku. Future months are gated, even if someone adds product IDs prematurely.

Verified best-seller entries require a defined market, full reporting period, units/revenue metric, source URL, verification date and three distinct product IDs. The application only displays the supplied metadata after validating its shape and completed period. This is **not independent sales-data verification**: an integration must supply genuinely checked evidence. No production entries claim sales rankings.

## External data still required

- Authorized official images and exact shade galleries, with source/license provenance.
- Correct official shade ranges, sizes, SKUs and localized product descriptions; current records are samples.
- Verified Azerbaijan retailer feeds/APIs or maintained offers, including exact variant mapping, purchase URLs, availability, locations and update dates.
- Real historical monthly sales reports with market/period/metric metadata before best-seller claims.
- Authenticated shared backend/image storage for a production admin. The preserved local editor only affects its browser until its exported JSON is committed and redeployed.

## Validation

Playwright covers all twelve months, three-slot editorial/empty states, keyboard and return focus, reduced motion, responsive widths, all three calendar languages, product deep links, favorites, price comparisons, variant/gallery state, failed-image placeholders, evidence guards, verified-offer test fixtures and existing local-admin regressions. TypeScript checks and a Vite production build are also run. Test fixtures are not shipped as real retailer offers or rankings.
