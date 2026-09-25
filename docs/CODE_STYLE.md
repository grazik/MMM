# Code Style

## General TypeScript

- Keep `strict: true`; never use `any` — accept `unknown` at boundaries and narrow it.
- Export named arrow consts (`export const doThing = async (…) => …`); no default exports.
- Prefer `type` aliases over `interface`; use `interface` only to extend an external type.
- Derive types from the source of truth (`Pick`, `Parameters`, mapped types) instead of retyping shapes.
- Name things camelCase, types PascalCase, module-level constants SCREAMING_SNAKE_CASE.
- Prefix booleans with `is`/`has`/`are` (`isStaff`, `isPending`).
- Suffix constants with their unit (`RECONNECT_MAX_DELAY_MS`) and use `1_000` separators.
- Validate every external input with a Zod `safeParse` at the boundary, before any work.
- Return `type Result = { ok: true } | { ok: false; message: string }` from operations that fail expectedly; throw only for bugs.
- Use guard clauses and early returns; never `else` after `return`.
- Use `catch {` without a binding when the error is unused.
- Keep user-facing strings in one `as const` map per domain (`ORDER_ERRORS`); never inline a message.
- Use an exhaustive `Record<SomeEnum, T>` for enum-keyed tables so a new variant fails to compile.
- End every `switch` on a union with `default:` and `value satisfies never`.
- Log as `console.error("[module] what failed", err)`; never log and continue silently.
- Put shared types in `types/*.types.ts`; never import a type from a module that also does work.
- Keep types used by more than one module, server or web, in `src/types/`; keep feature-only types in `src/<feature>/types/`. Anything web imports from `src/types/` must not depend on Node or the DOM.
- Hoist anything a second module needs into `types/` or `constants/` the moment it is reused.
- Import through the path alias (`@/…`); use relative paths only for co-located siblings.
- Use `import type` for type-only imports. (unconfirmed — mixed in this repo)
- Write comments only for *why*: state the constraint that breaks if the code changes. Never narrate structure.
- Test pure logic with Vitest — validators, state machines, mappers; skip tests for glue and I/O wiring. (unconfirmed — no test suite exists here)

## CSS

- Use BEM in kebab-case: `.block__element--modifier`.
- Keep one stylesheet per component, co-located, named after the component in kebab-case.
- Define all colors and design tokens as CSS custom properties on `:root`; never hardcode a hex outside the token file.
- Declare component-local custom properties on the block root and change only those in modifiers.
- Build tints and transparencies with `color-mix(in srgb, var(--token) N%, transparent)`, not new hex values.
- Write mobile-first with `min-width` media queries only.
- Keep breakpoints in one map and query them through a named helper, never a raw pixel value in a component.

## Git, tooling and CI

- Write commit subjects in lowercase imperative; no Conventional Commits prefixes.
- Comma-separate multiple changes in one subject (`add spinner, disable button on form submit`).
- Add a body only to explain why, or the bug a change fixes.
- Branch per change and merge via PR; keep the `(#N)` suffix that squash-merge adds.
- Git-ignore `node_modules`, build output, `.env*`, IDE folders and `*.tsbuildinfo`; mirror that in `.dockerignore` plus docs and static builds.
- Keep one CI workflow triggered on push to `main` plus `workflow_dispatch`.
- Add `paths-ignore` for `**/*.md` and CI-only files so docs pushes don't deploy.
- Guard deploys with a named `concurrency` group and `cancel-in-progress: false`.
- Pin GitHub Actions to a major tag (`@v4`) and the Docker base image to an exact patch (`node:24.13.0-slim`).
- Build a multi-stage Dockerfile: `base` → `deps` → `builder` → `runner`; install with `npm ci`.
- Run the container as the non-root `node` user and `COPY --chown=node:node` into it.
- Publish to `ghcr.io/<owner>/<app>` tagged `type=sha,format=long` plus `latest` on the default branch; cache with `type=gha`.
- Keep scripts minimal in `package.json`: `dev`, `build`, `start`, `lint`.
- Format with the tool's defaults — double quotes, 2-space indent, trailing commas — and don't hand-tune a config. 
