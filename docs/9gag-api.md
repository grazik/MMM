# 9gag API — Phase 0 findings

Found on 2026-09-23 by a throwaway spike, run from the home network with Node 24's built-in `fetch` inside `node:24-slim`.

## Verdict: **go** with 9gag's mobile app API

The web JSON API is behind a Cloudflare challenge. The mobile app API (`api.9gag.com`) is not, and it answers plain signed requests with a guest token. No account, cookies or browser are needed. The owner approved using it on 2026-09-23 (see `docs/requirements.md` §3).

## 1. How can the Hot feed be fetched with a plain HTTP request?

### Web (blocked)

- `https://9gag.com/v1/feed-posts/type/{hot,home}` and every other 9gag.com page except `/` return **403** with a Cloudflare challenge (`cf-mitigated: challenge`). This held even when replaying a real Chrome request with all its headers (`x-api-version: 2`, `sec-ch-*`, `sec-fetch-*`, referer, UA). The browser gets through because of its `cf_clearance` cookie and its TLS fingerprint, which headers can't reproduce.
- `https://9gag.com/` returns 200 and embeds 5 posts of the web **home** feed in `window._config`. It cannot paginate: `?after=` is ignored.

### Mobile app API (works)

Every request carries these headers:

| Header | Value |
|---|---|
| `9GAG-APP_ID`, `X-Package-ID` | `com.ninegag.android.app` |
| `9GAG-DEVICE_UUID`, `X-Device-UUID` | random 32-hex id, generated once per process |
| `9GAG-DEVICE_TYPE` | `android` |
| `9GAG-BUCKET_NAME` | `MAIN_RELEASE` |
| `9GAG-TIMESTAMP` | `Date.now()` in ms |
| `9GAG-REQUEST-SIGNATURE` | `sha1("*" + timestamp + "_._" + appId + "._." + deviceUuid + "9GAG")` (hex) |
| `9GAG-9GAG_TOKEN` | empty for the token call, then the guest token |

The flow:

1. `GET https://api.9gag.com/v2/guest-token` returns `data.userToken`, valid for 3 days (`secondsTillExpiry: 259200`). Getting a fresh token per fetch run is simplest.
2. `GET https://api.9gag.com/v2/post-list/group/default/type/hot/count/10` returns the Hot list.

A missing or wrong signature, or a missing token on the post list, returns `401 UNAUTHORIZED`.

**Stable:** the list was identical across repeated calls and across different device ids and tokens, both on the host and in Docker. Everyone gets the same Hot list; the server labels it `groupRankedHot … zone22`, which looks like a regional ranking.

**Differs from the web front page:** 9gag.com shows the personalised `home` feed. Only 4 of its first 11 posts appeared in the app's Hot top 60. Per the owner, we use the app's default Hot list.

## 2. What does one post contain?

See `test/fixtures/sample-hot.json`, which holds 3 pages trimmed to the fields below.

- `id`, `url` (`http://9gag.com/gag/<id>`), `title` (can contain HTML entities), `type`, `nsfw` (0/1), `promoted` (0/1), `creationTs`, and `orderId` (sequential rank within the list).
- `images`: each variant has `width`, `height`, `url`, and optionally `webpUrl`.
  - `image700` is the full JPG (`_700b.jpg`, or `_460s.jpg` for animated posts). `image460` is 460 wide. `imageFbThumbnail` is 220×220.
  - Animated/video posts also have `image700ba`/`image460sa` (the poster JPG) and **`image460sv`**:
    - `url`: MP4 H.264 (`_460sv.mp4`);
    - `vp8Url`, `vp9Url`: WebM;
    - `h265Url`, `av1Url`: MP4;
    - `hasAudio` (0/1) and `duration` (s).
- There is no separate poster field. For videos, `image460`/`image700` is the poster JPG.
- There is no "GIF only" variant. Animated posts always had `image460sv`.

## 3. Which post types appear in Hot?

- In the app API, 60 posts (6 pages) were `Animated` ×32 and `Photo` ×28, with no promoted posts, articles or embeds. `Video` and `Article` exist in 9gag's data model: the web home feed showed `Article` posts, whose `image460sv` is only a cover.
- The app should still skip anything that isn't `Photo`/`Animated`/`Video`, plus `promoted: 1`.

## 4. Can media files be downloaded directly from the CDN?

**Yes.** `img-9gag-fun.9cache.com` serves JPG, WebP and MP4 with no cookies, referer or challenge. It sends correct `content-type` headers (`image/jpeg`, `image/webp`, `video/mp4`) and supports range requests (`206`).

## 5. How many posts per request, and how does pagination work?

- **10 posts per request.** Larger `count` values are capped at 10.
- **Next page:** append `/olderThan/<id of the last post>`, e.g. `…/type/hot/count/10/olderThan/aPAO8oP`. Six pages returned 60 unique posts with no duplicates. `data.didEndOfList` is 0 while more remain.
- `?after=`, `/after/…`, `offset` and `page` are silently ignored: they return page 1 again. A client that loops without checking for duplicates would spin.

## Risks

- **No official API.** This is an undocumented API with a reverse-engineered signature, and an app update can break it without warning. The retry loop and the stale notice cover outages. Notifications and extra logging are post-MVP.
- The Hot ranking shifts slowly within the day: the post at the end of page 6 differed between runs a few minutes apart. That doesn't matter, since the set is taken once a day.
