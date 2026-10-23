#!/usr/bin/env python3
"""Read a public Sephora product page with async Playwright; keep raw data separate."""
from __future__ import annotations

import argparse
import asyncio
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from html import unescape
from html.parser import HTMLParser
import json
import logging
import os
from pathlib import Path
import re
import shutil
import sys
import tempfile
from urllib.parse import parse_qs, urljoin, urlsplit, urlunsplit

ROOT = Path(__file__).resolve().parents[1]
LOG = logging.getLogger("sephora")


class ScrapeError(Exception):
    """Expected access, navigation or extraction failure."""


class BlockedPage(ScrapeError):
    """An access challenge must not be treated as product data or retried."""


class ProductUnavailable(ScrapeError):
    """The requested product was removed or redirected to a not-carried page."""


class _Text(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts = []
        self.skip = 0

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style"):
            self.skip += 1
        if tag in ("br", "p", "li", "div"):
            self.parts.append("\n")

    def handle_endtag(self, tag):
        if tag in ("script", "style"):
            self.skip = max(0, self.skip - 1)
        if tag in ("p", "li", "div"):
            self.parts.append("\n")

    def handle_data(self, data):
        if not self.skip:
            self.parts.append(data)


def clean_text(value):
    if not isinstance(value, str):
        return None
    parser = _Text()
    parser.feed(value)
    lines = [re.sub(r"[ \t\r\f\v]+", " ", unescape(line)).strip()
             for line in "".join(parser.parts).split("\n")]
    return "\n".join(line for line in lines if line) or None


def validate_url(url):
    try:
        parsed = urlsplit(url)
        port = parsed.port
    except ValueError as error:
        raise ScrapeError("Invalid product URL") from error
    if (parsed.scheme != "https" or parsed.hostname not in ("sephora.com", "www.sephora.com")
            or parsed.username or parsed.password or port not in (None, 443)
            or not re.match(r"^/(?:ca/(?:en|fr)/)?product/[^/]+/?$", parsed.path)):
        raise ScrapeError("Use an HTTPS Sephora product URL, e.g. https://www.sephora.com/product/name-P12345")
    return urlunsplit((parsed.scheme, parsed.netloc, parsed.path, parsed.query, ""))


def walk(value):
    if isinstance(value, dict):
        yield value
        for child in value.values():
            yield from walk(child)
    elif isinstance(value, list):
        for child in value:
            yield from walk(child)


def product_id(url):
    match = re.search(r"\b(P\d+)\b", url, re.I)
    return match.group(1).upper() if match else None


def select_data(snapshot, url):
    """Only choose main-product structured state, never a recommendation's price."""
    ld, states = [], []
    target = product_id(url)
    h1 = (snapshot.get("name") or "").casefold()
    for raw in snapshot.get("scripts", []):
        try:
            document = json.loads(raw)
        except (ValueError, TypeError):
            continue
        for node in walk(document):
            types = node.get("@type", [])
            types = types if isinstance(types, list) else [types]
            if "Product" in types or "ProductGroup" in types:
                ld.append(node)
            details = node.get("productDetails", {})
            if ((isinstance(details, dict) and details.get("displayName"))
                    or node.get("productId") and (node.get("regularChildSkus") or node.get("currentSku"))):
                states.append(node)

    def choose(nodes, state=False):
        scored = []
        for node in nodes:
            identity = str(node.get("productId", "")) if state else product_id(str(node.get("url", "")))
            if target and identity and identity.upper() != target:
                continue
            details = node.get("productDetails") or {}
            name = str(details.get("displayName") or node.get("name") or node.get("displayName") or "")
            score = 100 if target and identity and identity.upper() == target else 0
            if name and h1 and (name.casefold() in h1 or h1 in name.casefold()):
                score += 20
            if score or len(nodes) == 1:
                scored.append((score, node))
        return max(scored, key=lambda item: item[0])[1] if scored else {}

    return choose(ld), choose(states, True)


def image_url(value, base):
    if isinstance(value, list):
        value = next((v for v in value if v), None)
    if isinstance(value, dict):
        value = value.get("url") or value.get("contentUrl")
    if not isinstance(value, str) or not value.strip():
        return None
    url = urljoin(base, value.strip())
    return url if urlsplit(url).scheme == "https" else None


def sku_image(sku, base):
    images = sku.get("skuImages") or {}
    images = images if isinstance(images, dict) else {}
    for key in ("image1500", "image1000", "image650", "image500", "image450", "imageUrl", "image250"):
        found = image_url(images.get(key), base)
        if found:
            return found
    return image_url(sku.get("image"), base)


def amount(value):
    if value is None or isinstance(value, bool):
        return None
    text = str(value).strip()
    # Never interpret a range, installment offer or multiple prices as one amount.
    if re.search(r"\d\s*[-–]\s*\D*\d", text):
        return None
    number = re.fullmatch(r"(?:[A-Za-z]{2,3}\s*)?[$€£₼]?\s*(\d[\d,]*(?:\.\d+)?)\s*(?:[A-Za-z]{3})?", text)
    if not number:
        return None
    try:
        result = Decimal(number.group(1).replace(",", ""))
        return format(result, ".2f") if result.is_finite() and result >= 0 else None
    except InvalidOperation:
        return None


def ingredient_list(raw):
    """Split INCI commas only outside parentheses/brackets; retain full raw text."""
    if not raw:
        return []
    marker = re.search(r"(?:^|\n)(?:full ingredients|ingredients|inci)\s*:\s*", raw, re.I)
    text = raw[marker.end():] if marker else raw
    # Sephora puts highlighted-ingredient claims before the actual INCI paragraph.
    text = "\n".join(line for line in text.splitlines()
                     if not re.match(r"^\s*[-•].*?:", line))
    result, token, depth = [], [], 0
    for char in text:
        if char in "([":
            depth += 1
        elif char in ")]":
            depth = max(0, depth - 1)
        if char in ",;" and depth == 0:
            item = " ".join("".join(token).split()).strip(" .")
            if item:
                result.append(item)
            token = []
        else:
            token.append(char)
    item = " ".join("".join(token).split()).strip(" .")
    if item:
        result.append(item)
    return result


CATEGORY_WORDS = {
    "foundation": ("foundation", "skin tint", "tinted moisturizer"),
    "concealer": ("concealer",), "mascara": ("mascara",),
    "blush": ("blush",), "highlighter": ("highlighter",),
    "eyeliner": ("eyeliner", "eye liner"), "primer": ("primer",),
    "makeup_remover": ("makeup remover", "cleansing balm", "micellar"),
    "lip_gloss": ("lip gloss", "lip oil"), "lipstick": ("lipstick", "lip color", "lip colour"),
    "powder": ("setting powder", "face powder", "powder"),
    "moisturizer": ("moisturizer", "moisturiser", "face cream"),
    "serum": ("serum",),
}


def category_for(category, name):
    # A narrow breadcrumb wins over a generic brand's marketing description.
    text = " ".join(category) if isinstance(category, list) else str(category or "")
    for haystack in (text, name or ""):
        for category_name, terms in CATEGORY_WORDS.items():
            if any(re.search(r"\b" + re.escape(term) + r"s?\b", haystack, re.I) for term in terms):
                return category_name
    return None


def parse_snapshot(snapshot, url):
    ld, state = select_data(snapshot, url)
    details = state.get("productDetails") or {}
    brand_data = ld.get("brand") or details.get("brand") or {}
    if not isinstance(brand_data, (str, dict)):
        brand_data = {}
    brand = clean_text(brand_data if isinstance(brand_data, str) else brand_data.get("name") or brand_data.get("displayName"))
    brand = brand or clean_text(details.get("brandName") or state.get("brandName") or snapshot.get("brand"))
    name = clean_text(details.get("displayName") or ld.get("name") or snapshot.get("name"))
    if not name or not brand:
        raise ScrapeError("Main product identity is missing. No raw file was written; page may be unavailable or not fully loaded.")
    warnings = []
    skus = []
    for key in ("regularChildSkus", "onSaleChildSkus", "skus"):
        if isinstance(state.get(key), list):
            skus.extend(s for s in state[key] if isinstance(s, dict))
    current = state.get("currentSku") or {}
    current = current if isinstance(current, dict) else {}
    requested = parse_qs(urlsplit(url).query).get("skuId", [None])[0]
    selected = next((s for s in skus + [current] if str(s.get("skuId")) == requested), {}) if requested else current
    if requested and not selected:
        warnings.append("Requested skuId was not found in structured state; verify the selected variant before import.")
    variant_id = requested or selected.get("skuId")
    variants = ld.get("hasVariant") or []
    if isinstance(variants, dict):
        variants = [variants]
    variant = next((v for v in variants if isinstance(v, dict) and variant_id
                    and str(v.get("sku")) == str(variant_id)), {})
    offers = variant.get("offers") or ld.get("offers") or {}
    if isinstance(offers, list):
        offers = next((o for o in offers if isinstance(o, dict) and str(o.get("sku")) == requested), {}) if requested else (offers[0] if len(offers) == 1 else {})
    if not isinstance(offers, dict):
        offers = {}
    listed = next((v for v in (selected.get("salePrice"), selected.get("listPrice"), offers.get("price"), snapshot.get("price"))
                   if v is not None and amount(v) is not None), None)
    currency = offers.get("priceCurrency") or selected.get("currency") or snapshot.get("currency")
    currency = currency if isinstance(currency, str) and re.fullmatch(r"[A-Z]{3}", currency) else None
    description = clean_text(details.get("longDescription") or details.get("description") or ld.get("description") or snapshot.get("description"))
    raw = clean_text(selected.get("ingredientDesc") or selected.get("ingredients") or details.get("ingredients") or snapshot.get("ingredients"))
    image = sku_image(selected, url) or image_url(variant.get("image") or ld.get("image"), url) or image_url(snapshot.get("image"), url)
    if requested and not selected and str(offers.get("sku")) != requested:
        # Never attach the default variant's facts to an unresolved requested SKU.
        listed, image, raw = None, None, None
        offers = {}
    availability = "unknown"
    stock = str(offers.get("availability", "")).rsplit("/", 1)[-1]
    if selected.get("isOutOfStock") is True or stock in ("OutOfStock", "SoldOut", "Discontinued") or snapshot.get("sold_out"):
        availability = "out_of_stock"
    elif selected.get("isOutOfStock") is False or stock in ("InStock", "LimitedAvailability") or snapshot.get("in_stock"):
        availability = "in_stock"
    shades, seen = [], set()
    for sku in skus:
        label = clean_text(sku.get("variationValue") or sku.get("shadeName"))
        variation_type = str(sku.get("variationType", "")).lower()
        if not label or variation_type and not any(x in variation_type for x in ("color", "colour", "shade")):
            continue
        key = str(sku.get("skuId") or label)
        if key in seen:
            continue
        seen.add(key)
        shades.append({"name": label, "sku_id": sku.get("skuId"), "image_url": sku_image(sku, url),
                       "available": not sku["isOutOfStock"] if isinstance(sku.get("isOutOfStock"), bool) else None})
    if requested and not selected and str(offers.get("sku")) != requested:
        availability = "unknown"
    variation_type = str(selected.get("variationType") or state.get("variationType") or "").lower()
    is_shade = any(t in variation_type for t in ("color", "colour", "shade"))
    if not shades and variation_type != "size":
        shades = [s for s in snapshot.get("shades") or []
                  if not re.search(r"\b(?:m[lL]|oz|grams?)\b", s.get("name") or "")]
    for field, value in (("category", category_for(ld.get("category") or details.get("category") or snapshot.get("breadcrumbs"), name)),
                         ("price", amount(listed)), ("currency", currency), ("image", image), ("description", description), ("ingredients", raw)):
        if value is None:
            warnings.append(f"{field} section unavailable; no value inferred.")
    return {
        "source_url": url, "scraped_at": datetime.now(timezone.utc).isoformat(),
        "brand": brand, "name": name,
        "category": category_for(ld.get("category") or details.get("category") or snapshot.get("breadcrumbs"), name),
        "price": {"amount": amount(listed), "currency": currency, "display": str(listed) if listed is not None else None,
                  "low": amount(offers.get("lowPrice")), "high": amount(offers.get("highPrice"))},
        "image_url": image, "description": description,
        "ingredients": {"raw": raw, "list": ingredient_list(raw)},
        "shades": shades, "selected_sku_id": selected.get("skuId") or offers.get("sku"),
        "selected_shade": clean_text(selected.get("variationValue") or selected.get("shadeName")) if is_shade else None,
        "selected_size": clean_text(selected.get("size") or (selected.get("variationValue") if variation_type == "size" else None)),
        "availability": availability, "warnings": warnings,
    }


SNAPSHOT_JS = r"""() => {
 const text=s=>document.querySelector(s)?.textContent?.trim()||null;
 const meta=s=>document.querySelector(s)?.getAttribute('content')||null;
 const section=label=>{
  const nodes=[...document.querySelectorAll('button,[role=tab],h2,h3')];
  for(const n of nodes){if(!new RegExp('^'+label+'\\s*$', 'i').test(n.textContent.trim()))continue;
   const target=n.getAttribute('aria-controls');if(target&&document.getElementById(target))return document.getElementById(target).innerText;
   const parent=n.closest('section,details,[data-comp*=Accordion]');if(parent)return parent.innerText;
  }return null;
 };
 const img=document.querySelector('[data-at="product_image"] img,img[data-at="product_image"],img[alt*="Product" i]');
 const srcset=img?.getAttribute('srcset')?.split(',').map(v=>v.trim().split(/\s+/)).sort((a,b)=>parseInt(b[1]||0)-parseInt(a[1]||0));
 const shades=[...document.querySelectorAll('[data-at="swatch"],[data-at="sku_swatch"]')].map(n=>({name:n.getAttribute('aria-label')||n.getAttribute('title'),sku_id:n.getAttribute('data-sku-id'),image_url:n.querySelector('img')?.src||null,available:n.getAttribute('aria-disabled')==='true'?false:null})).filter(s=>s.name);
 return {title:document.title,body_start:document.body?.innerText?.slice(0,2000)||'',
 scripts:[...document.querySelectorAll('script[type="application/ld+json"],script[type="application/json"],script[type="text/json"]')].map(n=>n.textContent),
 name:text('[data-at="product_name"]')||text('h1'),brand:text('[data-at="brand_name"]')||text('h1 a'),
 price:meta('[itemprop="price"]')||text('[data-at="price"]'),currency:meta('[itemprop="priceCurrency"]')||meta('meta[property="product:price:currency"]'),
 image:srcset?.[0]?.[0]||meta('meta[property="og:image"]')||img?.src,
 description:section('About the Product')||section('Details')||meta('meta[name="description"]'),ingredients:section('Ingredients'),
 breadcrumbs:[...document.querySelectorAll('nav[aria-label*="breadcrumb" i] a,[data-at="breadcrumb"]')].map(n=>n.textContent.trim()),shades,
 sold_out:[...document.querySelectorAll('button')].some(n=>/^(out of stock|sold out)$/i.test(n.textContent.trim())),
 in_stock:[...document.querySelectorAll('button')].some(n=>/^(add to basket|add to bag)$/i.test(n.textContent.trim())&&!n.disabled)};
}"""


def check_access(snapshot, status):
    visible = (snapshot.get("title", "") + "\n" + snapshot.get("body_start", "")).lower()
    if status in (401, 403, 429) or any(t in visible for t in (
            "access denied", "verify you are human", "unusual traffic", "pardon our interruption", "just a moment...")):
        raise BlockedPage(f"Sephora access restriction/challenge (HTTP {status or 'unknown'}). No bypass attempted and no product file written.")
    if status == 404:
        raise ProductUnavailable("Product page returned HTTP 404.")


async def collect_page(page, url, timeout):
    from playwright.async_api import TimeoutError as PlaywrightTimeout
    response = await page.goto(url, wait_until="domcontentloaded", timeout=timeout)
    status = response.status if response else None
    snapshot = await page.evaluate(SNAPSHOT_JS)
    check_access(snapshot, status)
    if "productnotcarried" in page.url.lower():
        raise ProductUnavailable("Sephora redirected this product to its product-not-carried page.")
    if status and status >= 500:
        raise ScrapeError(f"Temporary server response: HTTP {status}")
    if urlsplit(page.url).hostname not in ("sephora.com", "www.sephora.com"):
        raise BlockedPage("Page redirected away from Sephora; extraction stopped.")
    # Accept Sephora's public country-selection choice, without bypassing challenges.
    if "this site does not ship to your country" in (snapshot.get("body_start") or "").lower():
        choice = page.get_by_role("link", name=re.compile(r"^Continue to Sephora\.com\.?$", re.I))
        if not await choice.count():
            choice = page.get_by_role("button", name=re.compile(r"^Continue to Sephora\.com\.?$", re.I))
        if await choice.count():
            await choice.first.click(timeout=timeout)
            await page.wait_for_load_state("domcontentloaded", timeout=timeout)
        else:
            raise BlockedPage("Sephora country-selection page has no accessible Continue option.")
    # JSON state can be present before an h1, but an empty app shell is not data.
    try:
        await page.wait_for_function("document.querySelector('h1,[data-at=product_name]') || [...document.querySelectorAll('script[type=\"application/ld+json\"]')].some(n => /\"@type\"\\s*:\\s*\"Product/.test(n.textContent))", timeout=timeout)
    except PlaywrightTimeout as error:
        check_access(await page.evaluate(SNAPSHOT_JS), status)
        if "productnotcarried" in page.url.lower():
            raise ProductUnavailable("Sephora redirected this product to its product-not-carried page.") from error
        raise ScrapeError("Product content did not load before the timeout; the page may be unavailable, restricted, or incomplete.") from error
    ingredients = None
    for label in ("Ingredients", "About the Product", "Details"):
        try:
            controls = page.get_by_role("button", name=re.compile(r"^" + re.escape(label) + r"$", re.I))
            if not await controls.count():
                controls = page.get_by_role("tab", name=re.compile(r"^" + re.escape(label) + r"$", re.I))
            if await controls.count() and await controls.first.is_visible():
                if await controls.first.get_attribute("aria-expanded") != "true":
                    await controls.first.click(timeout=min(timeout, 2500))
                    await page.wait_for_timeout(250)
                if label == "Ingredients":
                    ingredients = (await page.evaluate(SNAPSHOT_JS)).get("ingredients")
        except PlaywrightTimeout:
            LOG.warning("Could not expand %s; structured data will still be checked", label)
    snapshot = await page.evaluate(SNAPSHOT_JS)
    snapshot["ingredients"] = ingredients or snapshot.get("ingredients")
    check_access(snapshot, status)
    return parse_snapshot(snapshot, url)


async def scrape(url, *, timeout=30000, retries=2, executable=None, headless=True):
    from playwright.async_api import async_playwright, Error as PlaywrightError
    url = validate_url(url)
    async with async_playwright() as pw:
        binary = executable or os.environ.get("PLAYWRIGHT_CHROMIUM_EXECUTABLE")
        if not binary and not Path(pw.chromium.executable_path).exists():
            binary = shutil.which("chromium") or shutil.which("chromium-browser")
            if binary:
                LOG.warning("Using installed system Chromium: %s", binary)
            else:
                raise ScrapeError("Browser missing. Run: python -m playwright install chromium")
        try:
            browser = await pw.chromium.launch(headless=headless, **({"executable_path": binary} if binary else {}))
        except PlaywrightError as error:
            raise ScrapeError(f"Browser launch failed. Run python -m playwright install chromium or pass --browser-executable. {error}") from error
        try:
            async with await browser.new_context(locale="en-US", viewport={"width": 1440, "height": 1000}) as context:
                for attempt in range(retries + 1):
                    page = await context.new_page()
                    try:
                        return await collect_page(page, url, timeout)
                    except (BlockedPage, ProductUnavailable):
                        raise
                    except (PlaywrightError, ScrapeError) as error:
                        if "HTTP 404" in str(error) or attempt == retries:
                            raise ScrapeError(f"Extraction failed after {attempt + 1} attempt(s): {error}") from error
                        LOG.warning("Attempt %s failed (%s); retrying", attempt + 1, type(error).__name__)
                        await asyncio.sleep(min(2 ** attempt, 8))
                    finally:
                        await page.close()
        finally:
            await browser.close()


def write_result(result, destination):
    destination = Path(destination)
    destination.parent.mkdir(parents=True, exist_ok=True)
    # Failed runs never overwrite a previous successful scrape with empty data.
    temp = None
    try:
        with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=destination.parent, delete=False) as handle:
            temp = Path(handle.name)
            json.dump(result, handle, ensure_ascii=False, indent=2)
            handle.write("\n")
        os.replace(temp, destination)
    finally:
        if temp and temp.exists():
            temp.unlink()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", required=True, help="Public HTTPS Sephora product URL")
    parser.add_argument("--output", type=Path, default=ROOT / "data/scraped_product_raw.json")
    parser.add_argument("--timeout", type=int, default=30000, help="Per-navigation timeout in milliseconds")
    parser.add_argument("--retries", type=int, default=2, help="Additional timeout/transient-error retries")
    parser.add_argument("--browser-executable", help="Optional system Chromium path")
    parser.add_argument("--headed", action="store_true", help="Show a normal browser (requires a display)")
    args = parser.parse_args()
    if args.timeout < 100 or not 0 <= args.retries <= 5:
        parser.error("--timeout must be >=100 ms and --retries between 0 and 5")
    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s", stream=sys.stderr)
    try:
        result = asyncio.run(scrape(args.url, timeout=args.timeout, retries=args.retries,
                                    executable=args.browser_executable, headless=not args.headed))
        write_result(result, args.output)
        print(json.dumps(result, ensure_ascii=False, indent=2))
        LOG.info("Saved raw product data to %s", args.output)
        return 0
    except ImportError:
        LOG.error("Install dependencies: python -m pip install -r scrapers/requirements.txt")
    except (ScrapeError, OSError) as error:
        LOG.error("%s", error)
    except KeyboardInterrupt:
        LOG.error("Scrape interrupted")
        return 130
    return 1


if __name__ == "__main__":
    sys.exit(main())
