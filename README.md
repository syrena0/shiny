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
- `public/products/`: original local SVG product illustrations, not official product photography.

Search includes product names, brands, all localized category names, and descriptions. Skin and tier selections use OR within a group and AND between groups. Favorites and language preference persist in LocalStorage; the application still works if storage is unavailable. Dialogs support Escape, keyboard focus containment, and backdrop dismissal.

All prices, store availability, and similarity percentages are demonstration data, not verified commercial offers. Store URLs are placeholders and intentionally have no purchase action. Dupe matches are editorial samples, not ingredient or clinical comparisons. No credentials or backend services are required.

## Validation

Production build and Chromium functional checks cover catalog rendering, search, three languages, favorites surviving reload, price and skin filters, sorting, product dialogs, expanded store listings, dupe navigation, mobile layout, and runtime errors.
