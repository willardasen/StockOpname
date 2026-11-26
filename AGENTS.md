# Repository Guidelines

## Project Structure & Module Organization

Stock Opname is a Tauri desktop inventory app with a React and TypeScript frontend. Routes live in `src/App.tsx`, screens in `src/views/`, and reusable UI in `src/components/`. Keep reusable behavior in `src/hooks/`, Zustand state in `src/stores/`, and SQLite access in `src/repositories/`. Rust commands and startup code live in `src-tauri/src/`. Frontend assets belong in `src/assets/` or `public/`, and desktop icons live in `src-tauri/icons/`.

## Build, Test, and Development Commands

Run these commands from the repository root.

- `npm ci` installs dependencies from the lockfile.
- `npm run tauri:dev` launches the desktop app with its development configuration.
- `npm run dev` starts Vite for browser-based frontend work.
- `npm run lint` runs ESLint, including TypeScript and React Hooks rules.
- `npm run build` type-checks TypeScript and bundles the frontend into `dist/`.
- `npm run tauri -- build` builds and packages the desktop app.

## Coding Style & Naming Conventions

Use two-space indentation in application TypeScript and TSX. Use PascalCase for views and components, such as `StockOpname.tsx`, and prefix hooks with `use`, such as `useProductForm.ts`. Use `@/` for imports rooted at `src/`. Match nearby formatting when editing shared UI primitives. Run `cargo fmt --manifest-path src-tauri/Cargo.toml` for Rust changes.

## Testing Guidelines

There is no configured automated test suite, coverage threshold, or test naming convention. Run `npm run lint` and `npm run build`, then use sample data to exercise the affected workflows in the Tauri development app. For inventory changes, verify that quantities and transaction history are correct before and after restarting the app.

## Commit & Pull Request Guidelines

Use short, action-oriented commit subjects, following examples from the history such as `add excel export and product filter`. In each pull request, describe the change and record how you verified it. Link the related issue when available and include screenshots for visible UI changes.
