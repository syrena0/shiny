# Shiny

A responsive beauty and dupe comparison prototype for Azerbaijan, built with React, Vite, Tailwind CSS, and Lucide.

## Develop

```sh
npm ci --cache /tmp/shiny-npm-cache
npm run dev -- --port 5173
```

```sh
npm run build
npm run preview -- --port 4173
```

## Project structure

- `data/products.json`: all product, shade, store, price, and dupe sample data. Covers all 12 categories.
- `src/i18n.js`: Azerbaijani, English, and Cyrillic Russian UI dictionaries and AZN formatting.
- `src/components/`: Navbar, ProductCard, FilterSidebar, ProductModal, DupeSection.
- `public/products/`: neutral local image placeholders. Previously generated branded packaging has been removed.

Search includes product names, brands, all localized category names, and descriptions. Skin and tier selections use OR within a group and AND between groups. Favorites and language preference persist in LocalStorage; the application still works if storage is unavailable. Dialogs support Escape, keyboard focus containment, and backdrop dismissal.

All prices, store availability, and similarity percentages are demonstration data, not verified commercial offers. Store URLs are placeholders and intentionally have no purchase action. Dupe matches are editorial samples, not ingredient or clinical comparisons. No credentials or backend services are required.

## Validation

Production build and Chromium functional checks cover catalog rendering, search, three languages, favorites surviving reload, price and skin filters, sorting, product dialogs, expanded store listings, dupe navigation, mobile layout, and runtime errors.

## Product admin editor

Open the settings icon in the navigation or append `/#admin` to the site address. The editor supports product names/brands, base prices, main images, per-shade colors/names/undertones/images/optional prices, and store prices, dates, and availability. Choose a shade in the product dialog to see its image and optional price; variants without overrides inherit the main image and price.

Images can be HTTPS URLs or JPEG/PNG/WebP uploads up to 8 MB. Uploads are resized to a maximum of 1000 pixels and stored as WebP. Changes are saved explicitly in LocalStorage, with visible errors if storage is full or unavailable. Product switching, export, and navigation prompt before discarding unsaved work. Restoring the sample catalog requires confirmation.

This is a **local editor, not an authenticated backend**. Anyone can open it, and edits affect only their own browser. Export downloads the entire saved catalog, including uploaded image data. To publish edits to all visitors, replace `data/products.json` with the exported file, rebuild, and redeploy. Optional `image` and `price_azn` fields on a shade implement variant overrides. Never store passwords or credentials in this editor. Shared authenticated administration requires a backend and image storage.

Run automated browser checks with:

```sh
npx playwright install chromium
npm test
# Or use an existing Chromium installation:
CHROMIUM_PATH=/usr/bin/chromium npm test
```

## Beauty Candy Calendar (21st.dev flip-card integration)

The homepage now includes a lavender chocolate box with twelve interactive month tiles and a **Beauty Calendar** navigation link. Click/tap a chocolate or press Enter/Space to reveal three product slots. Future or unpublished months show coming-soon slots. Product links open the existing detail dialog, including favorites and price comparison. Shared product URLs use `/#product=prod-1`.

- `src/components/ui/flip-card.tsx`: the supplied 21st.dev pattern, adapted for controlled click/touch state, keyboard activation, disabled handling, correctly hidden 3D faces, and reduced motion. Hover mode remains available for other consumers.
- `src/components/ui/button.tsx`, `src/lib/utils.ts`: shadcn-style primitives and class merging.
- `src/components/BeautyCalendar.tsx`: illustrated box, chocolate shapes and reveal interactions.
- `src/data/calendar.ts`: typed monthly editorial selections and optional ranking evidence. Editorial selections are not sales rankings; future months are gated in Asia/Baku time.
- `src/calendarI18n.ts`: AZ/EN/RU calendar, gallery and comparison copy.
- `src/components/ProductImage.tsx`: localized pending/error placeholders; no fake branded imagery.
- `src/components/PriceComparison.tsx`, `src/lib/offers.ts`: same-variant verified-offer adapter and UI.

Tailwind was already installed. TypeScript, Motion, Radix Slot, class-variance-authority, clsx and tailwind-merge are now installed. Existing working JavaScript components are retained; new calendar/UI/data modules use TypeScript. `npm run typecheck` checks the typed modules. `components.json` supplies shadcn-compatible aliases and the existing stylesheet. UI primitives live at `src/components/ui` because this Vite application uses `src`; `@/components/ui` resolves there consistently in Vite and TypeScript. A second root-level components folder would split the import convention. No destructive shadcn reinitialization is needed.

### Product gallery and retailer feed contract

A product or shade may provide `images: [url, ...]` or objects containing `{url, alt?, sourceUrl?, license?}`. Each variant gallery overrides the base gallery. Admin's existing single-image override remains supported. Use only authorized exact-product assets; do not treat placeholders as authentic photography. Size is optional at product or shade level and is explicitly unknown until supplied.

A future feed can supply `product.offers` entries with `market: "AZ"`, `currency: "AZN"`, `id`, `name`, `shade`, `size`, `price_azn`, `verified: true`, HTTPS `url` and `sourceUrl`, `last_checked` (YYYY-MM-DD), nullable booleans `online_available` / `physical_available`, and optional `location`. Only offers for the selected exact shade and size are shown, sorted by price. The upstream importer is responsible for factual verification. Legacy `stores` remain sample-only and are not used to claim verified availability or purchase links.

See [the audit](docs/AUDIT.md) for existing features, completed work and outstanding real-data requirements.
