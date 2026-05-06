# CURSED SQUAD — Project Architecture

## Overview

This is the React + Phaser rewrite of the HTML prototype (v0.65).
The architecture separates logic completely from rendering so battle
logic can be reused across the React HUD and the Phaser game scene.

---

## Directory Structure

```
cursed-squad/
├── public/
│   └── index.html          # Vite entry — mounts Phaser canvas + React root
│
├── src/
│   ├── main.tsx             # React entry point
│   ├── store.ts             # Zustand global state
│   │
│   ├── data/               # Pure data — no logic, no UI
│   │   ├── types.ts         # All shared TypeScript types
│   │   ├── rarity.ts        # Rarity configs + synergy tag metadata
│   │   ├── powers.ts        # ALL_POWERS data array
│   │   ├── curses.ts        # ALL_CURSES data array
│   │   ├── refinements.ts   # REFINEMENT_POOL + applyRefinements()
│   │   ├── starterLoadout.ts# STARTER_LOADOUT (5 pre-forged cards)
│   │   ├── difficulty.ts    # DIFF_CONFIG easy/standard/hard
│   │   ├── campaign.ts      # WAVE_DEFS + CAMP_BUFFS
│   │   └── index.ts         # Barrel export
│   │
│   ├── systems/            # Game logic — no UI dependencies
│   │   ├── SaveManager.ts   # Versioned localStorage, save migration
│   │   ├── StatusEngine.ts  # Status tick, DoT, regen, apply
│   │   ├── CombatEngine.ts  # Damage, heal, push, backfire resolution
│   │   ├── TurnManager.ts   # Turn order, advance, win/lose check
│   │   ├── VisibilityEngine.ts # Fog of war, LoS (Bresenham)
│   │   ├── MapBuilder.ts    # Procedural 15×15 map generation
│   │   ├── UnitFactory.ts   # Build player/enemy Unit objects
│   │   ├── ForgeSystem.ts   # Buy, forge, reroll, refine cards
│   │   └── index.ts         # Barrel export
│   │
│   ├── ai/
│   │   ├── PersonalityAI.ts # Aggressive/Defensive/Trickster strategies
│   │   └── index.ts
│   │
│   └── ui/                 # React components + Phaser scene
│       ├── App.tsx          # Screen router (React)
│       ├── styles.css       # Design tokens + global styles
│       ├── AudioEngine.ts   # Web Audio synthesis (no files needed)
│       ├── screens/
│       │   ├── TitleScreen.tsx
│       │   ├── BuildScreen.tsx
│       │   ├── ShopScreen.tsx
│       │   ├── CollectionScreen.tsx
│       │   ├── ForgeScreen.tsx
│       │   ├── RefineScreen.tsx
│       │   ├── CampaignScreen.tsx
│       │   ├── InterBattleScreen.tsx
│       │   ├── BattleHUD.tsx    # React overlay during battle
│       │   └── ResultScreen.tsx
│       └── components/      # Shared UI components (cards, badges, etc.)
│
└── docs/
    └── ARCHITECTURE.md      # This file
```

---

## Layer Boundaries

### `data/` — Pure data
- No imports from `systems/`, `ai/`, `ui/`
- Contains only TypeScript interfaces and constant arrays
- Safe to import anywhere

### `systems/` — Pure logic
- Imports from `data/` only
- No imports from `ui/`, React, or Phaser
- Every function is testable in isolation
- Returns mutations on objects or structured result objects

### `ai/` — Decision logic
- Imports from `data/` and `systems/`
- No imports from `ui/`, React, or Phaser
- Returns `AIAction` descriptor objects — never executes anything directly

### `ui/` — Rendering only
- Imports from all layers
- React components read from Zustand store
- Phaser scene reads visibleCells / fogReveal refs from store
- All animation triggers happen here (combat numbers, token flashes)
- AudioEngine lives here (it's output, not logic)

---

## State Flow

```
User input (click/tap)
  → React component or Phaser scene input handler
  → calls systems/ function (e.g. CombatEngine.applyDamage)
  → systems/ mutates Unit objects
  → React component writes result to Zustand store
  → Zustand triggers re-render
  → React HUD and Phaser scene update visuals
```

---

## Phaser Integration Plan

`BattleHUD.tsx` will:
1. Mount a Phaser `Game` instance on `#phaser-container`
2. Create a `BattleScene extends Phaser.Scene`
3. `BattleScene` reads `store.units`, `store.grid`, `store.visibleCells`
4. `BattleScene` renders token sprites, fog tiles, highlight overlays
5. On tile click → calls `onCellClick(r, c)` from the battle controller
6. React HUD renders on top: action bar, unit panels, log, turn order

---

## Migration Checklist (v0.65 → v1.0)

- [x] All data ported to typed TypeScript files
- [x] All systems ported as pure logic functions
- [x] AI ported as personality strategy pattern
- [x] Zustand store covering all game state
- [x] SaveManager with full migration from HTML prototype saves
- [x] React screen stubs for all 10 screens
- [x] Design tokens in CSS variables (shared with Phaser palette)
- [x] AudioEngine ported
- [ ] Full screen implementations (BuildScreen, ShopScreen, etc.)
- [ ] Phaser BattleScene (grid rendering, fog, token sprites)
- [ ] Battle controller (wires systems → store → Phaser)
- [ ] Phaser animations (hit flash, death, status pop)
- [ ] Mobile touch controls in Phaser
- [ ] Sprite assets (replace emoji tokens)
- [ ] Sound asset fallbacks (or keep synthesis)
