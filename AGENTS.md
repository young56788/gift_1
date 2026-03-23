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
