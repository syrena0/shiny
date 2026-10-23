# Supabase catalog integration

The production frontend reads `products` from Supabase REST. The existing design, search, filters, shade selection, price comparisons, dupes, calendar and favorites remain in place.

## Configuration

- `.env` contains the provided URL and **publishable** key for local development and is ignored by Git.
- `.env.production` intentionally contains the same **public browser configuration** so GitHub-triggered Vercel builds work without a separate manual Vercel variable step. These values are visible in the browser bundle by design. Platform environment variables can override them.
- `.env.example` documents the variables. Never place a service-role/secret key in a `VITE_` variable or committed file. The client configuration rejects new secret keys and legacy service-role JWTs.
- The seeding CLI optionally reads `SUPABASE_SERVICE_ROLE_KEY` from the local process/environment, never from browser code. Such a key is not needed if the SQL editor route below is used.

## Complete the initial import

Run **all of `supabase/seed-products.sql`** in the project's Supabase SQL Editor as project owner. This file is generated from the current 70 records and contains one transaction:

1. Add the required product columns if missing, retaining existing rows and existing primary key types.
2. Add a unique `catalog_id` and a JSONB `catalog_data` column. Existing text or UUID database primary keys are supported; original catalog IDs remain unchanged in the app.
3. Enable RLS and create a public SELECT policy for product discovery. No anonymous INSERT, UPDATE or DELETE policies are created.
4. Upsert all 70 catalog records with their original typed JSON arrays/objects. Repeated execution updates matching catalog IDs; it does not delete other products.

`catalog_data` retains the complete original product record, including images/rights metadata, offers, default variants, provenance, owner metadata and future fields. Existing dedicated columns remain separately populated. Local product images remain in `public/products`; the database stores their URLs, not fabricated remote storage paths.

The schema script uses `ADD COLUMN IF NOT EXISTS` and does not silently convert existing incompatible column types. Review existing nested columns if they are text/SQL arrays instead of JSONB. Other pre-existing NOT NULL columns or database triggers may require project-specific adjustments. Any seed SQL failure rolls back the transaction.

Regenerate the SQL after catalog changes:

```sh
npm run seed:supabase -- --export-sql supabase/seed-products.sql
```

## CLI seeding

```sh
npm run seed:supabase -- --dry-run
npm run seed:supabase
```

The CLI validates local data, inspects only the product schema, preserves JSONB objects/arrays, sends one atomic `on_conflict=catalog_id` upsert, and verifies every returned field against the source. It does not stringify nested JSON into text, invent data, delete products, or alter database permissions. It supports environment HTTP proxies. New Supabase publishable keys cannot read the root OpenAPI endpoint; the CLI falls back to read-only zero-row column/type probes against `products` rather than requiring a secret for schema discovery.

A publishable key generally cannot write through secure RLS. If the schema is missing or write permission is denied, use the SQL editor route above. Alternatively use a CLI-only elevated key through a secure local environment. Do not grant all website visitors anonymous write access just to make seeding work. No elevated credential was supplied or added in this change.

A successful CLI run writes an ignored `supabase-seed-report.json` containing counts and verification status, without keys. A failed run never claims that seeding succeeded.

## Frontend behavior

The app fetches pages until the database result is complete, including when the server enforces a smaller row cap. It reconstructs original product IDs, validates the whole catalog and treats remote data as authoritative. Old LocalStorage snapshots cannot silently override database prices or images. Favorites and language remain local and favorites survive asynchronous startup.

Initial loading is explicit. Failed, empty, RLS-filtered or invalid database responses show a translated backup notice and a retry button; the published local catalog is used only as a clearly labelled fallback. Empty responses cannot be distinguished from rows hidden by RLS without privileged access, so the interface explains both possibilities.

Admin edits retain the existing local save/preview behavior. They do **not** write to Supabase using an anonymous visitor key. The admin provides a download of the existing browser catalog backup; the integration does not overwrite it during a remote fetch. Reloading the public site reads Supabase again. Shared admin publishing requires authenticated admin users and appropriate write policies, which are outside this data-read migration.

## Actual migration status

The supplied publishable key successfully returned HTTP 200 from the `products` endpoint with an empty result. Root OpenAPI returned “Secret API key required”, which is expected for the newer publishable-key format. A direct column probe confirmed `catalog_id` is missing. The CLI therefore refused to write rather than discarding extended metadata. **No remote products have been inserted by this migration yet.** Running the prepared SQL as project owner is the remaining database step; the public key cannot perform ALTER TABLE.

A Codex environment draft was saved adding the project domain and suggesting the two public environment variables. Saving a draft is not publication. Actual REST reads subsequently became reachable and were verified, so a live network block is no longer assumed. Browser access is independent of this execution environment's egress policy.

Tests mock REST responses and never write test records to the production database. Coverage includes JSONB round trips, UUID identity, atomic upsert, RLS failures, capped pagination, malformed/empty responses, remote data overriding stale browser data, favorites, retry, SQL transaction export and private-key rejection.

## Validation and rollout

Lint, TypeScript, asset validation and the production build passed. All **57 Playwright tests passed against the production build**. Database writes in these tests are mocked; they do not represent a completed production migration. The upsert also preserves existing database primary keys when a catalog ID is already present. The SQL export is ready at `supabase/seed-products.sql`; the real CLI dry run stopped before writing because the required schema columns are missing.
