# MMM — Memy Małej Moni: Requirements

## 1. Overview

MMM is a small self-hosted web app that shows **the 10 top memes from 9gag's Hot feed for the day**. Every viewer sees the same set. The set changes once a day.

The point is to **limit meme exposure** while keeping a bit of the fun of scrolling: 10 memes, one under another, then "Come back tomorrow".

- **Users:** a household (2 people), mainly on phones.
- **Access:** home LAN and the owner's Tailscale tailnet. Never exposed to the public internet.
- **Priorities:** speed of delivery and low maintenance. Choose the boring, simple option whenever in doubt.

## 2. How to work on this project

- Work in phases. **Phase 0 (spike) comes first. Stop after Phase 0, report the results, and wait for approval before building the app.**
- Do not add features that are not in this document. If something is ambiguous, ask instead of guessing.
- Keep dependencies few and well known.
- Never commit to `main`. Work on a feature branch and open a pull request; see 8.3.

## 3. Phase 0 — Fetch spike (do this first)

9gag has **no official public API**. The app has to rely on the JSON that 9gag's own web app uses, or on data embedded in its pages. This can break or be blocked by bot protection, so feasibility must be proven before anything else is built.

> **Outcome (2026-09-23, approved by the owner):** the web JSON is blocked by a Cloudflare challenge, so the app uses **9gag's mobile app API** (`api.9gag.com`, signed requests with a guest token, no account), which is not challenged. See `docs/9gag-api.md` for the request details.

### Rules

- Run the spike **from the home network** (the owner's machine is fine).
- Use **the same HTTP client the app will use** (Node's built-in `fetch`), ideally inside a Node Docker container. A page opening fine in a browser proves nothing: bot protection can tell a browser from a script by headers and TLS fingerprint.
- Do not use GitHub Actions runners for this. They exit from datacenter IPs, which are treated differently.
- Timebox: about 1 hour.

### Questions to answer

1. How can the Hot feed be fetched with a plain HTTP request? Which URL, which headers are needed? Is it stable across several runs?
2. What does one post contain? At minimum: post id, title, post type, media URLs (all image/video variants and formats), width and height, audio flag (if any), NSFW flag (if any), link to the post.
3. Which post types appear in Hot (single image, animated, video, multi-image article, promoted, embeds…)?
4. Can media files be downloaded directly from the CDN, without cookies or a referer?
5. How many posts does one request return, and how does pagination work?

### Deliverables

- A small throwaway script that fetches Hot and downloads the media of the first few posts. It is kept locally and never committed to `main`.
- `docs/9gag-api.md` — answers to the questions above, plus a trimmed sample JSON response saved as `test/fixtures/sample-hot.json` (reused as a test fixture).

### Go / no-go

- **Plain HTTP works:** proceed to Phase 1 after the owner approves.
- **Blocked:** stop and report. The owner decides whether a headless browser is worth it. Do not implement one without approval.

## 4. Functional requirements

### 4.1 Daily set

- **Source:** 9gag Hot feed, all sections: the mobile app API's default Hot list (`/v2/post-list/group/default/type/hot`, paginated with `/olderThan/<last post id>`). It differs from the personalised feed on the 9gag.com front page; that is expected. NSFW posts are **not** filtered in the MVP.
- **Day boundary:** all dates use the **Europe/Warsaw** timezone. The set for date D is fetched at 06:00 on D.
- **Selection:** walk the Hot feed in order and take the **first 10 eligible posts**. A post is eligible when:
  - its type is supported: a single image, an animated post, or a video;
  - its id contains only letters, digits, `_` and `-` (the id becomes the media file name, so anything else could escape the set directory);
  - it was **not in the previous stored set** (compare by 9gag post id; if there is no previous set, skip this check);
  - its media file downloads successfully.
- Unsupported types (multi-image posts, promoted posts, embeds, anything else) are **skipped** and the next post is taken. The set must always contain exactly 10 displayable items.
- Fetch further pages of Hot as needed, up to a configurable cap (default 5 pages). If the cap is reached with fewer than 10 eligible posts, the run counts as failed.
- **Media is stored locally.** The app never hotlinks 9gag.
- **Media format:** for animated posts and videos prefer the MP4 (H.264) variant, because it plays everywhere including iOS Safari. Use WebM only if no MP4 exists. An animated post that only exists as a GIF is shown as an image.
- **Atomic publish:** build the new set in a temporary directory and move it into place only when all 10 media files are downloaded and the manifest is written. A half-finished set must never be served. When a set for the same date is replaced, the old set is moved aside into `tmp/` first; if the process dies before the new one is in place, the next run restores the moved-aside set before cleaning `tmp/`.

Each stored item holds: 9gag id, title (HTML entities decoded), kind (`image` or `video`), media file name, width, height, poster image file name (for videos, if available), whether it has audio (if 9gag provides this), and the original post URL (for debugging; not displayed).

### 4.2 Scheduling and retries

- An in-process scheduler runs the fetch **daily at 06:00 Europe/Warsaw**. Pass the timezone explicitly to the scheduler and to date formatting; do not rely on the container's TZ.
- **On startup:** if the set for today does not exist and the current time is at or after 06:00, fetch immediately. This covers restarts, deploys and downtime.
- **On failure:** retry every 15 minutes (configurable) until success. When the next day's 06:00 run starts, it takes over.
- **Single-flight:** never run two fetches at the same time.
- Log every attempt: start, result, number of posts skipped and why, duration.
- Provide a manual trigger as a CLI command (e.g. `node dist/fetch.js`), usable via `docker exec`.

### 4.3 Which set is served

- The app serves the **most recent stored set**.
- The set is **stale** when the current time is at or after 06:00 today and the newest set is from an earlier date. Before 06:00, yesterday's set is simply the current one and is not stale.
- **No set at all** (fresh install, first fetch still failing): show an empty state.

### 4.4 Retention

- Keep sets for the **last 3 days** (configurable). After each successful fetch, delete older set directories.
- Never delete the set that is currently served.

### 4.5 HTTP API

- `GET /api/today` returns `{ date, stale, items: [...] }`, where each item has `id`, `title`, `kind`, `mediaUrl`, `posterUrl` (optional), `width`, `height`, `hasAudio` (optional). If there is no set, return `{ date: null, stale: false, items: [] }`. Send `Cache-Control: no-cache`.
- `GET /media/<date>/<file>` serves stored media with a long, immutable cache header. Support HTTP range requests (needed for video playback on iOS).
- `GET /healthz` returns 200 with the time of the last successful fetch.
- Everything else serves the built frontend.

## 5. UI

Mobile-first, single page. The UI text is in **English**, but the app name stays Polish.

### 5.1 Layout

- **Header:** "Memy Małej Moni", with the date of the served set below it, formatted like "Tuesday, 22 September" (English, Europe/Warsaw).
- **Feed:** the 10 items in order, one under another. Each item shows:
  - a counter "N / 10";
  - the title (rendered as text, never as HTML);
  - the media at **full screen width**, with its aspect ratio reserved from `width`/`height` so the page never jumps while loading.
- On screens wider than a phone, center the column with a max width of about 600px.
- **End of feed:** "Come back tomorrow" with "That was all N for today." below it (N is the number of items shown, so it follows `SET_SIZE`), and a circular **back-to-top** arrow button that smooth-scrolls to the top.
- **Stale notice** (when `stale` is true): a small notice under the header: "Today's memes aren't ready yet, so here's yesterday's set. Retrying in the background." The header date shows the set's date.
- **Empty state:** "No memes yet. The first set is on its way."

### 5.2 Media behavior

- **Images:** `<img>` with lazy loading, except the first item, which loads eagerly. `alt` is the title.
- **Videos and animated posts:** `<video muted loop playsinline preload="metadata">` with the poster image when available.
  - Autoplay only when **in view** (at least 50% visible); pause when out of view.
  - **Only one video plays at a time**: the most visible one.
  - A **mute toggle** button (at least 44×44px, bottom-right corner of the video, with an `aria-label` of "Unmute"/"Mute"). Every video starts muted, and unmuting applies only to that video. Show the button only on videos with audio if 9gag provides that information; otherwise on all videos.
  - No length limit and no skipping of long videos.

### 5.3 Visual design

Plain and simple. Follow the system light/dark setting (`prefers-color-scheme`).

| Token | Dark | Light |
|---|---|---|
| Background | `#141312` | `#FAF7F2` |
| Surface (media placeholder, notice) | `#221F1C` | `#EDE7DF` |
| Text | `#F3EFE9` | `#1C1916` |
| Muted text (date, captions) | `#A39B91` | `#655E55` |
| Accent (counter, back-to-top) | `#FF8A65` | `#B8431F` |

- **Fonts:** header "Memy Małej Moni" in **Fraunces**, italic, weight 600, about 34px. Everything else in **Instrument Sans**. Self-host both (e.g. via `@fontsource`); no runtime requests to Google Fonts. Both must include Polish characters (the "ł").
- **Sizes:** titles 18px semibold; counter 13px semibold, letter-spaced, tabular numbers, accent color; date 15px muted.
- Mute button: dark translucent circle (`rgba(12,11,10,0.72)`) with a white speaker icon.
- Stale notice: surface background, 12px rounded corners, a small refresh icon in the accent color.
- Respect safe-area insets (`viewport-fit=cover` plus `env(safe-area-inset-*)`).
- Use inline SVG icons; no icon font, no emoji.
- Favicon: cream (`#FAF7F2`) Fraunces italic "M" on a rounded accent (`#B8431F`) tile, served as `favicon.svg`, `favicon.ico` (16/32/48) and a 180px `apple-touch-icon.png` from `src/web/public/`.
- Installable (minimal PWA): `src/web/public/manifest.webmanifest` with name "Memy Małej Moni", short name "MMM", `start_url` and `scope` `/`, `display: standalone`, background and theme color `#141312` (dark by default; the per-scheme `theme-color` meta tags still switch the browser UI to light for light-scheme users). Icons: `icon-192.png`, `icon-512.png`, `icon-maskable-512.png` (glyph inside the 80% safe zone) and an opaque `apple-touch-icon.png`, all generated from `favicon.svg` by `npm run icons`. `<head>` sets `theme-color` per color scheme and `apple-mobile-web-app-title` "MMM".
- No service worker, offline cache, push notifications, badging or install prompts: the app stays unobtrusive.

A visual mockup exists (owner has the link) showing the feed, the end of the feed, and the stale state.

## 6. Non-functional requirements

- **No authentication.** The app is reachable only on the LAN and the tailnet.
- **Configuration via environment variables**, all with defaults:
  - `PORT` = `3000`
  - `DATA_DIR` = `/data`
  - `TIMEZONE` = `Europe/Warsaw`
  - `FETCH_CRON` = `0 6 * * *`
  - `RETRY_INTERVAL_MINUTES` = `15`
  - `RETENTION_DAYS` = `3`
  - `SET_SIZE` = `10`
  - `MAX_PAGES` = `5`
- **Download robustness:** timeout on every request, validate content type and non-zero size of downloaded media.
- **Logging:** plain structured logs to stdout.
- **Frontend weight:** keep the JavaScript minimal; no UI framework needed.

## 7. Tech stack

- **Runtime:** Node 24 LTS, TypeScript in strict mode.
- **Server:** Hono with `@hono/node-server`.
- **Scheduler:** `croner` (supports an explicit timezone).
- **HTML entity decoding (titles):** `entities`.
- **Fetch lock (single-flight across the server and the CLI):** `proper-lockfile`.
- **Frontend:** Vite with vanilla TypeScript and plain CSS.
- **Storage:** filesystem only, no database:
  - `DATA_DIR/sets/YYYY-MM-DD/manifest.json` plus that day's media files;
  - `DATA_DIR/tmp/` for sets being built;
  - on startup, the server and the fetch CLI check that `DATA_DIR`, `sets/` and `tmp/` are writable, and exit with an error naming the container uid and which host directory to `chown` if not (the host uid equals the container uid unless Docker runs rootless or with userns-remap). A bind-mounted directory created by Docker is owned by root, and without this check the problem only shows at the first fetch.
- **Lint and format:** Biome.
- **Tests:** Vitest, for the logic only:
  - eligibility and selection (including skipping unsupported types and yesterday's duplicates, using `test/fixtures/sample-hot.json` as a fixture);
  - stale determination around the 06:00 boundary;
  - retention.
    No end-to-end tests.

Suggested structure (adjust if there's a good reason):

```
src/
  server/     # Hono app, API, static serving
  fetcher/    # 9gag client, selection, download, atomic publish
  scheduler/  # cron, startup catch-up, retries
  web/        # Vite frontend
  types/      # types used by more than one module, server and web alike
test/
```

## 8. Docker and deployment

### 8.1 Image

- Multi-stage Dockerfile based on the official Node 24 slim image.
- Run as a non-root user.
- `EXPOSE 3000` and a `VOLUME` for `/data`.
- `HEALTHCHECK` calling `/healthz` (using Node itself, so no extra tools are needed in the image).
- Target platform: `linux/amd64`.

### 8.2 Hosting

The app runs on a Debian 13 VM ("apps") that already hosts other apps. There, each app is a separate `docker-compose.yml`, and Caddy (also run via compose) is the reverse proxy.

Provide an example `deploy/docker-compose.yml`:

- image `ghcr.io/grazik/mmm:latest`;
- `restart: unless-stopped`;
- a bind mount for `/data`;
- the environment variables above;
- joined to the external Docker network shared with Caddy (network name as a placeholder to fill in).

Also provide an example Caddy site block with a placeholder hostname, reverse-proxying to the container on port 3000.

### 8.3 Git workflow

- `main` is protected. All work happens on short-lived branches named `feat/…`, `fix/…` or `chore/…`, merged into `main` through pull requests.
- Claude Code creates a branch for each task, commits there, pushes the branch and opens a PR with `gh pr create`.
- **Claude Code never merges PRs and never pushes to `main`.** The owner reviews and merges.
- Merge method: squash merge. The PR title becomes the commit message on `main`, so it must describe the change.
- The protection rules on GitHub are configured by the owner, not by Claude Code:
  - require a pull request before merging (0 approvals, since there is a single developer);
  - require the `check` and `build` status checks to pass;
  - block force pushes and deletion of `main`;
  - automatically delete branches after merge.

### 8.4 CI/CD

`.github/workflows/build.yml`, based on the owner's existing MyDrinks workflow:

- **Triggers:** `pull_request` targeting `main`, push to `main`, and `workflow_dispatch`.
- **Concurrency:** group `ci-${{ github.ref }}`, with `cancel-in-progress` true only for pull requests. A new push to a PR cancels its outdated run, while runs on `main` (deploys) queue and never cancel each other.
- **`check` job** (all triggers): install, lint, typecheck, test.
- **`build` job** (needs `check`, all triggers):
  - `docker/setup-buildx-action@v3`;
  - `docker/login-action@v3` to `ghcr.io` with `GITHUB_TOKEN`, skipped on pull requests;
  - `docker/metadata-action@v5` for image `ghcr.io/grazik/mmm` with tags `type=sha,format=long` and `latest` on the default branch;
  - `docker/build-push-action@v6` with `platforms: linux/amd64` and GHA cache;
  - **on pull requests the image is built but not pushed** (`push: false`), so a broken Dockerfile fails the PR before it reaches `main`;
  - permissions: `contents: read`, `packages: write`.
- **`deploy` job** (needs `build`, `permissions: {}`, `environment: production`), **runs only on push to `main` and `workflow_dispatch` from `main`**, never on pull requests or other branches. The `if` lists the allowed events and ref instead of excluding pull requests:
  - the `production` GitHub Environment (configured by the owner) allows deployments from `main` only;
  - all deploy secrets (`TS_OAUTH_CLIENT_ID`, `TS_OAUTH_SECRET`, `DEPLOY_SSH_KEY`, `APPS_HOST`, `APPS_HOST_KEY`) are environment secrets of `production`, not repository secrets, so a job outside `main` never receives them;
  - join the tailnet with `tailscale/github-action@v3`, using secrets `TS_OAUTH_CLIENT_ID` and `TS_OAUTH_SECRET` and `tags: tag:ci`;
  - SSH to `deploy@${{ secrets.APPS_HOST }}` using secrets `DEPLOY_SSH_KEY` and `APPS_HOST_KEY`.

The server side of the deploy (the SSH forced command that pulls and restarts the compose stack) is configured by the owner and is out of scope.

## 9. Out of scope (post-MVP)

- Notifications and extra logging when fetching fails (e.g. the undocumented app API changes)
- PWA beyond installability: service worker, offline mode, push notifications, badging, install prompts
- NSFW filtering
- Archive of past days
- Per-user state (seen, favorites, reactions)
- Comments, upvotes, or other 9gag metadata in the UI
- Multi-arch images
- Headless-browser fetching, unless Phase 0 requires it and the owner approves

## 10. Acceptance criteria

- [ ] Phase 0 is done, `docs/9gag-api.md` exists, and the owner approved continuing.
- [ ] At 06:00 Europe/Warsaw a new set of exactly 10 displayable items is built and published atomically.
- [ ] Posts from the previous set never appear in the new set; unsupported post types are skipped.
- [ ] After a restart after 06:00 with no set for today, a fetch starts immediately.
- [ ] A failed fetch retries every 15 minutes; meanwhile yesterday's set is shown with the stale notice.
- [ ] With no set at all, the empty state is shown.
- [ ] Sets older than 3 days are deleted; the served set never is.
- [ ] On an iPhone and an Android phone:
  - [ ] images, animated posts and videos all display;
  - [ ] videos autoplay muted only when in view, loop, and only one plays at a time;
  - [ ] the mute toggle works per video.
- [ ] The page does not jump while media loads.
- [ ] The end of the feed shows "Come back tomorrow" and a working back-to-top button.
- [ ] Light and dark themes follow the system setting.
- [ ] A pull request runs `check` and builds the image without pushing or deploying.
- [ ] Merging a pull request into `main` runs checks, pushes the image to GHCR, and triggers the deploy.