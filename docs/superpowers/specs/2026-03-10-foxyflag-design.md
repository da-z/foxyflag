# FoxyFlag — Firefox Country Flag Extension

## Purpose

Display a country flag in the Firefox address bar (right side) showing the country where the current site's server is hosted, based on GeoIP lookup of the resolved IP address.

## Architecture

Single background script WebExtension using Firefox's `pageAction` API.

### Flow

1. `webNavigation.onCompleted` fires on tab navigation
2. Extract hostname from URL
3. Check in-memory cache for hostname → skip to step 6 if cached
4. Resolve hostname to IP via `dns.resolve()` (Firefox WebExtension API)
5. Query `http://ip-api.com/json/{ip}?fields=countryCode,country` for country data
6. Render flag emoji onto 16x16 / 32x32 canvas
7. Set page action icon and tooltip (country name + IP)
8. Show page action for the tab

### Error Flow

- API failure / timeout / non-routable IP → show 🌐 globe icon, tooltip "Unknown country"
- Internal URLs (`about:`, `moz-extension:`, `file:`) → hide page action

## Components

| File | Role |
|------|------|
| `manifest.json` | Extension manifest (Manifest V2) |
| `background.js` | DNS resolve, GeoIP fetch, canvas rendering, page action management |
| `icons/icon-16.png` | Extension icon 16px |
| `icons/icon-32.png` | Extension icon 32px |
| `icons/icon-48.png` | Extension icon 48px |
| `icons/globe-16.png` | Fallback globe icon 16px |
| `icons/globe-32.png` | Fallback globe icon 32px |

## Caching

- In-memory `Map<hostname, {countryCode, country, ip}>`
- Clears on browser restart (no persistence)
- Prevents duplicate API calls for same domain across tabs

## Permissions

- `dns` — resolve hostnames to IPs
- `pageAction` — address bar icon
- `webNavigation` — detect page loads
- `<all_urls>` — trigger on any site

## Flag Rendering

Country code (e.g., "DE") → regional indicator emoji (🇩🇪) → render on OffscreenCanvas at 16x16 and 32x32 → `pageAction.setIcon()` with ImageData.

## GeoIP Provider

- **ip-api.com** free tier
- Endpoint: `http://ip-api.com/json/{ip}?fields=countryCode,country`
- Rate limit: 45 requests/minute (mitigated by caching)
- No API key required

## Decisions

- Manifest V2 chosen because Firefox `pageAction` (address bar icon) works best with V2
- Emoji-based flags avoid bundling 200+ image files
- `dns.resolve()` is Firefox-specific — this extension is Firefox-only by design
