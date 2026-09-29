# Reflection

## What assumptions did you make?

The biggest one was **timezone**. The portal returns timestamps as `DD/MM/YYYY HH:mm` with no UTC offset. I assumed IST (UTC+5:30) based on geography — the meters are clearly in Jaipur — and converted to UTC ISO 8601 in the API response. This assumption is documented in both the response description and PROTOCOL.md. If I were productionising this I'd verify against a known event (e.g., a meter reading timed at midnight local time).

The second assumption was that the portal's `/portal/export` endpoint intentionally (or incidentally) returns all records on every page. I verified this by calling page 1 and page 2 and getting identical 403-record responses. I treat page 1 as canonical and don't paginate.

I also assumed the service runs as a single process. Session state is therefore fine in memory. Horizontal scaling would need a shared session store, but that's not the right scope for this take-home.

## Which part was most difficult, and how did you get unstuck?

The **login flow** took the most time. The portal is a SvelteKit app and its CSRF protection is easy to trip over silently — posting without the `Origin` header returns a 403 with body `{"message":"Cross-site POST form submissions are forbidden"}`, which looks like an auth failure but is actually a request-shape problem. Posting to `/?/login` (SvelteKit named-action syntax) returns 404, not 405. The working combination — POST to `/login`, with both `x-sveltekit-action: true` and `Origin` matching the host — only became clear after reading the compiled JS bundle directly.

The approach was: download the JS chunks referenced in the HTML, search for `fetch(` calls and URL strings. The bundle for the transformers page (`node 4`) contained the clearest example — a self-contained function showing the full HMAC signing process for the export endpoint. That was the single most useful piece of code to find.

## If you had another day, what would you improve?

A **short-TTL in-memory cache on `getExport()`**. Right now `GET /meters/:id` fetches all 403 meters on every call because the portal has no single-meter detail endpoint. A 30-second cache keyed on the export result would make individual meter lookups fast without adding a database. I'd use a simple `Map` with a timestamp rather than a dependency — it's genuinely a 20-line change.

After that: a consumption delta endpoint (`/meters/:id/consumption/delta`) that computes half-hourly kWh intervals from the cumulative register values. The raw cumulative numbers the portal returns are technically correct but almost nobody wants them — they want "how much energy did this meter use between 2pm and 3pm".

## What mistake did you make while solving this?

The first time I tried to intercept the portal's login I wrote a test that mocked `axios` using `jest.mock('axios', ...)` and tried to reach the mock instance through a `_mockInstance` property attached to the factory. This matched the way I'd scaffolded the mock but not the way the service actually calls `axios.create()` at construction time — the mock instance was being retrieved before the service had a chance to call `create()`, so every test failed with "cannot read properties of undefined". 

The fix was simpler and more honest: build the service through the test module normally, then cast `(service as any).http` to replace the private axios instance after construction. This is slightly unconventional but directly testable and doesn't require matching any module-load-order details.

## If you were reviewing your own submission, what would you criticise?

The **`findOne()` method in MetersService fetches all 403 meters to find one**. I noted this in the README and in the code comment, but it's still a real problem: at a larger dataset it becomes a 50 MB HTTP fetch on every single-meter request. The correct fix requires either a local cache or a portal-side change. I chose simplicity and honesty (document the trade-off) over hiding it with a caching layer that would have its own freshness problems at this scope.

I'd also criticise the **timestamp normalisation being silent about bad input**. The `parsePortalTimestamp` function returns the raw string if the regex doesn't match, which is resilient but means a malformed timestamp silently passes through in an inconsistent format. A proper solution would log a warning with the meter ID and raw value so operators can spot data quality problems in the portal.
