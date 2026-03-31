# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Meaning Weaver is an AI-powered mobile journaling app (React Native + Expo, TypeScript). Users record brief life fragments (text, photos) throughout the week, and an AI system generates weekly insight reports. Philosophy: "Not a diary app, but a mirror helping you see yourself."

## Commands

```bash
npm start              # Start Metro bundler
npm run android        # Build + run on Android
npm run ios            # Build + run on iOS
npm run web            # Web dev server (localhost:19006)
npm test               # Jest tests (--passWithNoTests)
npm run lint           # ESLint TypeScript files
node proxy-server.js   # CORS proxy (needed for web dev)
```

Run a single test file:
```bash
npx jest path/to/file.test.ts
```

Build release APK manually:
```bash
npx expo prebuild --platform android --no-install
cd android && ./gradlew assembleRelease
```

Release via CI: push a git tag `v*` to trigger `.github/workflows/release-apk.yml`.

## Architecture

### Data Flow
UI Screens (expo-router tabs) → React Query hooks → Repository pattern → expo-sqlite (native) / localStorage (web) → Tencent Hunyuan API (text/vision)

### Key Layers

- **`app/(tabs)/`** — Expo Router file-system routing. Three tabs: fragments input, reports, settings.
- **`src/db/schema.ts`** — Zod schemas defining all data models (Fragment, Report, ReportContent). Start here to understand the domain.
- **`src/db/repository.ts`** — Repository interface with `NativeRepository` (expo-sqlite) and `WebRepository` (localStorage) implementations. SQLite migrations are versioned (currently v5).
- **`src/hooks/`** — React Query hooks wrapping repository calls (`useFragments`, `useSettings`, `usePhotoDescription`, `useDatabase`).
- **`src/services/ai/`** — Tencent Hunyuan integration: `client.ts` (OpenAI-compatible API), `prompts.ts` (system/user prompts), `reportGenerator.ts` (weekly report generation with fallback), `photoDescriber.ts` (vision model pipeline).
- **`src/lib/result.ts`** — `Result<T, E>` type with `Ok`/`Err` constructors. Used throughout AI services for type-safe error handling.
- **`src/components/`** — `FragmentInput` (multi-modal: text/photo) and `FragmentList`.
- **`proxy-server.js`** — Node server that handles CORS for web dev.

### Key Patterns

- **Result<T, E>** for all AI service errors — never throw, always return Ok/Err
- **Repository pattern** with abstract interface for multi-platform data access
- **React Query** for caching/invalidation (`useQuery`/`useMutation` with `queryKey` invalidation)
- **Zod validation** on all DB entities and AI response parsing (`ReportContentSchema.safeParse()`)
- **Two-stage photo pipeline**: vision model describes photo at upload time → text model weaves descriptions into weekly reports
- **Multi-platform API routing**: web uses CORS proxy (port 3001), native connects directly to Hunyuan API

### Database

SQLite with three tables: `fragments` (life moments with optional photo), `reports` (AI-generated weekly insights as JSON), `settings` (API keys). Week-keyed with ISO format (`2026-W13`).

## Conventions

- Chinese UI text, English code and comments
- `StyleSheet.create()` for all styling (React Native standard)
- Tests colocated in `__tests__/` directories next to source; integration tests in root `__tests__/`
- Jest mocks for native modules live in `__mocks__/` (expo-sqlite uses in-memory implementation)
- ESLint v9 flat config with TypeScript strict mode
- Unescaped Chinese curly quotes in JSX cause Metro bundler errors — use JSX expressions instead (see `docs/solutions/jsx-metro-bundler-unicode-quotes.md`)
