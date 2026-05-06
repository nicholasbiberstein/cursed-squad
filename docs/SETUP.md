# CURSED SQUAD — Setup Guide

## Requirements
- Node.js 18+ (recommended: 20 LTS)
- npm 9+

## Install

```bash
# Clone / extract the project
cd cursed-squad

# Install all dependencies
npm install
```

## Run (development)

```bash
npm run dev
```

Opens at `http://localhost:3000` with hot reload.

## Build (production)

```bash
npm run build
# Output in /dist — deploy anywhere (Vercel, Netlify, etc.)
```

## Preview production build

```bash
npm run preview
```

---

## Key files to start working in

| What you want to do | File |
|---|---|
| Add/edit powers | `src/data/powers.ts` |
| Add/edit curses | `src/data/curses.ts` |
| Change balance numbers | `src/data/difficulty.ts` |
| Fix combat logic | `src/systems/CombatEngine.ts` |
| Change AI behaviour | `src/ai/PersonalityAI.ts` |
| Build a screen | `src/ui/screens/*.tsx` |
| Add global state | `src/store.ts` |

---

## Save data

Saves are stored in `localStorage` under keys prefixed with `cs_1.0_`.
The SaveManager automatically migrates saves from the HTML prototype
versions (v0.5 through v0.65).

---

## Project structure overview

See `docs/ARCHITECTURE.md` for the full layer breakdown and
migration checklist.
