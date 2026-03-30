---
review_agents:
  - kieran-typescript-reviewer
  - security-sentinel
  - performance-oracle
  - architecture-strategist
---

# Meaning Weaver — Compound Engineering Settings

React Native (Expo) app for journaling with AI-powered weekly report generation.

## Tech Stack

- React Native + Expo (TypeScript)
- expo-sqlite for local storage with versioned migrations
- @tanstack/react-query v5 for data management
- Tencent Hunyuan API (OpenAI-compatible) — text and vision models
- Zod for schema validation
- expo-image-manipulator for photo compression

## Key Conventions

- Result<T, E> pattern using Ok/Err for AI calls
- SQLite migrations are versioned (currently v5)
- Fragment schema: content, photo_uri, photo_description, audio_uri
- Two-stage photo pipeline: vision model describes photo at upload time, text model weaves descriptions into weekly reports
