# Repository Guidelines

## Project Structure & Module Organization
- `src/app`: React application shell, providers, layout, and global scene routing.
- `src/bus`: typed Event Bus used for all React <-> Phaser communication.
- `src/store`: Zustand-based `GameStore`, the only cross-module source of truth.
- `src/phaser`: Phaser runtime bootstrap and scene registration.
- `src/modules/map`, `src/modules/shrimp`, `src/modules/catan`, `src/modules/festival`: gameplay and narrative modules. Keep rules and rendering separated inside each module.
- `src/ui`: shared React UI components.
- `src/config`: content, location, and future gameplay configuration.
- `public`: static assets. `dist` is build output and should not be edited by hand.

## Build, Test, and Development Commands
- `npm install`: install dependencies.
- `npm run dev`: start the Vite dev server for local development.
- `npm run build`: run TypeScript checks and create a production build in `dist/`.
- `npm run preview`: serve the production build locally.

Example:
```bash
npm install
npm run dev
```

## Coding Style & Naming Conventions
- Use TypeScript with strict typing; avoid `any` unless there is no practical alternative.
- Indent with 2 spaces in Markdown and 2-space equivalent formatting in TypeScript/TSX already present in the repo.
- React components and Phaser scene classes use `PascalCase` file names, for example `AppShell.tsx`, `MapScene.ts`.
- Hooks, store helpers, and utility functions use `camelCase`.
- Keep module boundaries strict: Phaser must not write React state directly, and React must not manipulate Phaser scene internals directly.

## Testing Guidelines
- There is no automated test suite yet. For now, treat `npm run build` as the required verification step before submitting changes.
- When adding tests later, place them beside the module or under a top-level `tests/` directory and use `*.test.ts` or `*.test.tsx`.
- Manually verify the event-driven flow after gameplay changes: map entry, shrimp completion, state sync, and festival unlock.
- Prefer following the repository checklist in `docs/manual-qa-checklist.md` when verifying gameplay changes.

## Commit & Pull Request Guidelines
- This repository is newly initialized and does not yet have meaningful Git history, so use short imperative commit messages such as `Add typed event bus` or `Implement shrimp scene`.
- Keep commits focused on one batch of work.
- Pull requests should include: a short summary, affected modules, verification steps, and screenshots or short recordings for UI/gameplay changes.

## Architecture Notes
- Follow the current contract: React owns scenes, UI, story flow, and `GameStore`; Phaser owns rendering, movement, and gameplay interaction.
- All cross-layer communication must go through the typed Event Bus in `src/bus`.

## JavaScript REPL (Node)
- Use `js_repl` for Node-backed JavaScript with top-level await in a persistent kernel.
- `js_repl` is a freeform/custom tool. Direct `js_repl` calls must send raw JavaScript tool input (optionally with first-line `// codex-js-repl: timeout_ms=15000`). Do not wrap code in JSON (for example `{"code":"..."}`), quotes, or markdown code fences.
- Helpers: `codex.cwd`, `codex.homeDir`, `codex.tmpDir`, `codex.tool(name, args?)`, and `codex.emitImage(imageLike)`.
- `codex.tool` executes a normal tool call and resolves to the raw tool output object. Use it for shell and non-shell tools alike. Nested tool outputs stay inside JavaScript unless you emit them explicitly.
- `codex.emitImage(...)` adds one image to the outer `js_repl` function output each time you call it, so you can call it multiple times to emit multiple images. It accepts a data URL, a single `input_image` item, an object like `{ bytes, mimeType }`, or a raw tool response object with exactly one image and no text. It rejects mixed text-and-image content.
- `codex.tool(...)` and `codex.emitImage(...)` keep stable helper identities across cells. Saved references and persisted objects can reuse them in later cells, but async callbacks that fire after a cell finishes still fail because no exec is active.
- Request full-resolution image processing with `detail: "original"` only when the `view_image` tool schema includes a `detail` argument. The same availability applies to `codex.emitImage(...)`: if `view_image.detail` is present, you may also pass `detail: "original"` there. Use this when high-fidelity image perception or precise localization is needed, especially for CUA agents.
- Example of sharing an in-memory Playwright screenshot: `await codex.emitImage({ bytes: await page.screenshot({ type: "jpeg", quality: 85 }), mimeType: "image/jpeg", detail: "original" })`.
- Example of sharing a local image tool result: `await codex.emitImage(codex.tool("view_image", { path: "/absolute/path", detail: "original" }))`.
- When encoding an image to send with `codex.emitImage(...)` or `view_image`, prefer JPEG at about 85 quality when lossy compression is acceptable; use PNG when transparency or lossless detail matters. Smaller uploads are faster and less likely to hit size limits.
- Top-level bindings persist across cells. If a cell throws, prior bindings remain available and bindings that finished initializing before the throw often remain usable in later cells. For code you plan to reuse across cells, prefer declaring or assigning it in direct top-level statements before operations that might throw. If you hit `SyntaxError: Identifier 'x' has already been declared`, first reuse the existing binding, reassign a previously declared `let`, or pick a new descriptive name. Use `{ ... }` only for a short temporary block when you specifically need local scratch names; do not wrap an entire cell in block scope if you want those names reusable later. Reset the kernel with `js_repl_reset` only when you need a clean state.
- Top-level static import declarations (for example `import x from "./file.js"`) are currently unsupported in `js_repl`; use dynamic imports with `await import("pkg")`, `await import("./file.js")`, or `await import("/abs/path/file.mjs")` instead. Imported local files must be ESM `.js`/`.mjs` files and run in the same REPL VM context. Bare package imports always resolve from REPL-global search roots (`CODEX_JS_REPL_NODE_MODULE_DIRS`, then cwd), not relative to the imported file location. Local files may statically import only other local relative/absolute/`file://` `.js`/`.mjs` files; package and builtin imports from local files must stay dynamic. `import.meta.resolve()` returns importable strings such as `file://...`, bare package names, and `node:...` specifiers. Local file modules reload between execs, while top-level bindings persist until `js_repl_reset`.
- Avoid direct access to `process.stdout` / `process.stderr` / `process.stdin`; it can corrupt the JSON line protocol. Use `console.log`, `codex.tool(...)`, and `codex.emitImage(...)`.
