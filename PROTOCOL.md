# PROTOCOL.md — Urja Meter Ops Portal: How It Actually Works

*Discovered by: reading the SvelteKit JS bundles, intercepting fetch calls, and manual probing.*

---

## 1. What the Portal Is

Urja Meter Ops (`https://urja-ops.flockenergy.tech`) is a **SvelteKit** single-page app backed by a Node.js server. It uses the **better-auth** library for session management. The frontend is statically compiled; the server exposes both SvelteKit form actions and a set of internal JSON API routes under `/portal/*` that the frontend calls via `fetch()`.

There is no public API or API documentation. Everything below was reverse-engineered from the compiled JS bundles.

---

## 2. Authentication

### Mechanism
better-auth cookie sessions. The session cookie is named `__Secure-better-auth.session_token` and is set as `HttpOnly; Secure; SameSite=Lax`.

### Login flow
POST to `/login` (the SvelteKit page route, **not** `/login?/login`) with:
- `Content-Type: application/x-www-form-urlencoded`
- Header `x-sveltekit-action: true` — this header tells SvelteKit to return JSON instead of redirecting
- Header `Origin: https://urja-ops.flockenergy.tech` — SvelteKit's CSRF guard checks that Origin matches Host; omitting it returns 403 "Cross-site POST form submissions are forbidden"
- Body: `email=operator%40urja.local&password=urja-ops-2026`

Success response (HTTP 200):
```json
{"type": "redirect", "status": 303, "location": "/meters"}
```
The `Set-Cookie` header in the response carries the session token. All subsequent requests need this cookie.

### Quirks found
- POSTing to `/?/login` (the named action syntax) returns 404 — the login action is at `/login` with no named action suffix.
- POSTing without the `x-sveltekit-action` header (or with a mismatched Origin) returns a CSRF 403 error.
- Session expiry appears to be 1 hour based on `expiresAt` in the session response.

### Session inspection
```
GET /api/auth/get-session
```
Returns the current session and user object (useful for checking whether a session is still live):
```json
{
  "session": {"id": "...", "token": "...", "expiresAt": "...", "userId": "..."},
  "user": {"name": "Ops Desk", "email": "operator@urja.local", ...}
}
```

### Sign-out
```
POST /api/auth/sign-out
```
Invalidates the server-side session.

---

## 3. Data Available

The portal manages **distribution metering** data for what appears to be a utility in Jaipur, India. Based on exploration:

| Entity | Count |
|---|---|
| Meters | 403 |
| Distribution Transformers (DTs) | 40 |

### 3.1 Meters

Fields per meter (from export):
| Field | Type | Notes |
|---|---|---|
| `meterId` | string | e.g. `J100000` — appears to be sequential with a `J1` prefix |
| `serialNo` | string | Manufacturer serial number |
| `make` | string | Manufacturer: HPL, L&T, Genus, Secure, etc. |
| `phaseType` | string | `"single"` or `"three"` |
| `installStatus` | string | `"Installed"`, `"Decommissioned"`, `"Faulty"` |
| `installType` | string | `"Whole Current"` or `"CT Operated"` |
| `build` | string | `"legacy"` or `"v2"` — important, drives how detail is structured |
| `dtCode` | string | The DT this meter belongs to (e.g. `DT-001`) |
| `hierarchy` | object | Full 7-level network hierarchy (see §3.3) |
| `geo` | object | `{lat, lng}` floats |

**Two meter generations:** 238 are `legacy`, 165 are `v2`. The difference surfaces in the `/meters/{id}/__data.json` endpoint — legacy meters carry a `detail.data` array of `{parameterName, parameterValue}` pairs, while v2 meters carry a `detail.classData` string which is a JSON blob of the raw meter class record (e.g. `{"installed_meter": {...}}`). The frontend normalises both into the same display format.

### 3.2 Distribution Transformers (DTs)

Fields per DT:
| Field | Type | Notes |
|---|---|---|
| `code` | string | e.g. `DT-001` |
| `name` | string | e.g. `Malviya Nagar DT 1` |
| `feederCode` | string | Parent feeder, e.g. `F-001` |
| `capacityKva` | number | Transformer capacity in kVA |

No geo data or energy readings are available for DTs through any discovered endpoint.

### 3.3 Network Hierarchy

Meters (and DTs) sit in a 7-level hierarchy:

```
Zone → Circle → Division → Subdivision → Sub Station → Feeder → DT → Meter
```

Example values (from export):
```json
{
  "zone":        {"name": "Jaipur Zone 1",    "code": "Z-01"},
  "circle":      {"name": "Circle 1",          "code": "C-01"},
  "division":    {"name": "Division 1",         "code": "D-01"},
  "subdivision": {"name": "Subdivision 1",      "code": "SD-01"},
  "substation":  {"name": "Substation 1",       "code": "SS-01"},
  "feeder":      {"name": "Feeder 1",           "code": "F-001"},
  "dt":          {"name": "Malviya Nagar DT 1", "code": "DT-001"}
}
```

The portal UI renders a breadcrumb from this data. The hierarchy is **per-meter** — there is no separate hierarchy endpoint; it comes bundled with every meter record.

### 3.4 Energy / Consumption Readings

```
GET /portal/meters/{meterId}/energy
```
Returns an array of metering readings, up to 337 entries per meter (roughly a half-hourly dataset covering ~7 days):
```json
{
  "data": [
    {"timestamp": "23/06/2026 23:30", "kwh": "48438.74", "kvah": "52313.84", "voltR": "226"},
    ...
  ]
}
```
Timestamps are in `DD/MM/YYYY HH:mm` format (no timezone, presumed IST/Asia/Kolkata). `kwh` and `kvah` are **cumulative register values** (not delta/interval), represented as strings. `voltR` is the R-phase voltage in volts.

No date-range filtering is available — the endpoint always returns the same window of data.

### 3.5 Geo / Location

```
GET /portal/meters/{meterId}/geo
```
Returns:
```json
{
  "data": {"latitude": "26.938961002479868", "longitude": "75.83095696146852"}
}
```
Coordinates are strings (not floats) in this endpoint; the export endpoint returns them as floats. All meters appear to be in the Jaipur metropolitan area (~26.8–27.0°N, 75.7–75.9°E).

---

## 4. Internal API Endpoints

All endpoints under `/portal/*` require the session cookie. They return JSON.

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/portal/meters/search` | Session cookie | Paginated meter list + search. Query params: `q` (free text, searches meter ID and serial), `page` (1-based). Returns `{data: [...], total: N}`, 20 per page. |
| `GET` | `/portal/dts` | Session cookie | Paginated DT list. Query param: `page`. 20 per page. |
| `GET` | `/portal/meters/{id}/geo` | Session cookie | Single meter GPS location. |
| `GET` | `/portal/meters/{id}/energy` | Session cookie | Meter consumption readings (fixed window). |
| `GET` | `/portal/keys` | Session cookie | Returns HMAC signing secret for the export endpoint. |
| `GET` | `/portal/export` | Session cookie + HMAC | Bulk export of all meters. Query param: `page`. Returns all 403 meters on page 1 (pagination exists but server returns everything). |

### HMAC Signing (for `/portal/export`)

The export endpoint requires two extra request headers:
- `x-timestamp`: Unix timestamp (seconds) as a string, generated at signing time
- `x-signature`: HMAC-SHA-256 hex digest

The message signed is:
```
{METHOD}\n{PATH}\n{QUERY_STRING}\n{TIMESTAMP}
```
e.g. for `GET /portal/export?page=1`:
```
GET\n/portal/export\npage=1\n1790677997
```

The signing key is retrieved from `GET /portal/keys` → `data.signingSecret`. The secret is stable across sessions (same value every time). The timestamp must be recent (appears to have a tolerance window, likely ±60 s based on common practice — not precisely tested).

---

## 5. SvelteKit Data Endpoint

SvelteKit exposes SSR-rendered page data at:
```
GET /meters/{id}/__data.json
```
This returns the server `load()` result in a compact deduplication format (object references by integer index). It contains meter nameplate detail and hierarchy. The `/portal/meters/{id}/geo` and `/portal/meters/{id}/energy` endpoints are called client-side after the page loads, so they are not included here.

This endpoint is useful as an alternative to `/portal/meters/{id}/geo` + `/portal/keys` + export — it delivers nameplate detail in one call but requires decoding the SvelteKit deduplication format.

---

## 6. Surprises and Quirks

1. **The export endpoint ignores pagination.** It returns all 403 meters regardless of the `page` parameter — page 1 and page 2 return the exact same 403 records. Presumably the server was designed for pagination but the dataset is small enough that nobody noticed.

2. **HMAC secret is user-visible.** `GET /portal/keys` returns the signing secret in plain text to any logged-in user. This is unusual — HMAC here likely serves as a mild rate-limit/intent signal rather than true security, since any authenticated user can retrieve the key and self-sign.

3. **Meter timestamps have no timezone.** The `DD/MM/YYYY HH:mm` format has no UTC offset. Based on geography (Jaipur, India) these are almost certainly IST (UTC+5:30), but the API does not say so.

4. **Cumulative vs. interval readings.** The `kwh` values are large cumulative register reads (e.g. 48438.74 kWh), not interval deltas. Calculating actual consumption requires subtracting consecutive readings.

5. **Two meter formats with no discriminator field in search.** The `build` field (`"legacy"` vs `"v2"`) is only present in the bulk export response, not in the paginated search or the meter detail endpoints. This matters if you're trying to interpret nameplate data from the detail without a bulk load.

6. **CSRF protection is Origin-header-based.** SvelteKit checks that `Origin` matches the server host for form action POSTs. Standard CSRF mitigation but notable because it means the login endpoint cannot be called from a different origin without CORS headers (which are not present).

7. **Session tokens are 1 hour.** The `expiresAt` on the session object is `createdAt + 1h`. The portal does not appear to slide the expiry on activity.
