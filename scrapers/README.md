# Sephora raw-product scraper

This standalone Python tool uses an ordinary async Playwright Chromium browser.
It does not change the website, seed Supabase, or publish scraped data to the
catalog. It does not evade CAPTCHA, access controls, or rate limits.

## Setup

From the repository root:

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r scrapers/requirements.txt
.venv/bin/python -m playwright install chromium
```

On minimal Linux machines, install browser OS dependencies with
`python -m playwright install --with-deps chromium` using a suitably privileged
account. Activate the virtual environment (`source .venv/bin/activate`) to use the
short `python` commands below. Windows: use `.venv\Scripts\activate`.

The browser installer needs network access to Playwright's download domains
(including `cdn.playwright.dev`, `playwright.download.prss.microsoft.com`, and
`storage.googleapis.com`). This cloud workspace currently blocks the Chromium
archive with HTTP 403. A domain allowlist configuration draft has been prepared;
review/save and **Publish** that environment configuration before rerunning the
installer. An already installed `chromium` or `chromium-browser` is automatically
used when the managed browser is unavailable. You can select it explicitly:

```bash
python scrapers/sephora_scraper.py --url "https://www.sephora.com/product/PRODUCT-P12345" --browser-executable /usr/bin/chromium
```

System Chromium can differ from Playwright's tested browser version. The scraper
logs this fallback to stderr.

## Usage

```bash
python scrapers/sephora_scraper.py --url "<SEPHORA_PRODUCT_URL>"
python scrapers/sephora_scraper.py --url "<SEPHORA_PRODUCT_URL>?skuId=<SKU>" --timeout 45000 --retries 2
```

Use a current product URL copied from Sephora. The placeholder URLs above are not
real product fixtures. `--headed` opens a visible browser when a display exists.
`--output /path/to/result.json` changes the destination.

Successful runs print UTF-8 JSON to stdout and atomically save
`data/scraped_product_raw.json` (gitignored). Logs go to stderr. Failure exits 1
without creating or replacing a result file. An existing file belongs to the
previous successful run; check its `source_url` and `scraped_at`.

## Extraction and limitations

- Waits for dynamic product content, reads JSON-LD and embedded product/SKU state,
  then falls back to product-specific DOM fields. Opens public Ingredients and
  About the Product controls when available.
- Produces brand, title, normalized category, listed price/currency, primary image
  URL, description, raw and comma-parsed INCI text, shade/SKU options, stock state,
  selected SKU/shade/size, timestamp, and missing-field warnings.
- Preserves the retailer's currency; it does **not** convert USD/CAD to AZN or
  invent local prices. Ambiguous price ranges are recorded as low/high where
  supplied, rather than represented as a single variant price.
- Selects the requested `skuId` when embedded data identifies it. An unresolved
  requested SKU has no inferred image, ingredient list, price, or stock state.
  Missing sections are null/empty with warnings; missing product identity fails.
- Uses the largest explicitly supplied SKU image, otherwise structured primary
  photography/primary DOM image. No fabricated resolution suffixes or photo
  generation. Shade image fields are null if no source image is provided.
- Stops on HTTP 401/403/429 and visible challenge pages. Retries temporary
  navigation/server failures with bounded backoff, never access challenges or
  product-not-carried/404 pages. Sephora's normal country-selection Continue
  control is supported; no location spoofing is performed.
- A public page can still be unavailable by region, discontinued, or changed by
  Sephora. Live extraction cannot be guaranteed. The tested Fenty P470025 URL
  redirected to Sephora's product-not-carried search in this environment.
- Raw ingredient text is authoritative; parsed items may still contain section
  headings or footnotes and need editorial review before publication.
- Fetching an image URL is not permission to reuse the image. This tool only
  records URLs; confirm supplier/brand licensing before downstream downloading
  or publishing. No image downloads or live catalog imports are performed.

## Tests

```bash
python -m unittest discover -s scrapers/tests -v
python -m py_compile scrapers/sephora_scraper.py
```

Tests use clearly labeled synthetic products, including browser-intercepted HTML
with delayed product rendering and an ingredient accordion. They cover exact
shade images/prices, unknown variants, INCI commas in parentheses, unavailable
fields, sold-out states, malformed JSON, recommendations, access restrictions,
retry behavior, and JSON file output. Browser tests need Chromium installed and
permission to launch its subprocess. They do not prove that a particular live
Sephora product is accessible or grant image reuse rights.

Live verification in this workspace succeeded for The Ordinary product P427417:
USD 6.00, selected SKU 2031391 (30 mL), primary full-resolution image URL,
description, and 11 INCI ingredients. Prices are observations at scrape time.
All 15 parser/browser tests passed using installed system Chromium.
