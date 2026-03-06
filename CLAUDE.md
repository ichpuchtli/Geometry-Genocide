# CLAUDE.md — Geometry Genocide

> Context document for AI assistants working on this codebase.
> Read this file, `PRD.md`, `ENEMY_DESIGNS.md`, and `TASKS.md` before making changes.

**Workflow rule:** After each change, commit and push to master.

---

## What This Is

Geometry Genocide is a browser-based twin-stick arcade shooter inspired by Geometry Wars. Originally a Python 2/Pygame desktop game by Sam Macpherson (2013), it was rebuilt from scratch as a TypeScript + raw WebGL game deployed to GitHub Pages.

**Play it:** https://ichpuchtli.github.io/Geometry-Genocide/

The game runs entirely client-side. No backend. No external dependencies at runtime. WebGL renders everything — bloom, grid distortion, particle trails. Audio is Web Audio API with procedural synthwave music. Mobile uses twin-stick virtual joysticks.

---

## Project Vision & Design Intent

The core experience is **neon chaos** — dozens to hundreds of geometric enemies swarming the player in a scrolling arena, with Geometry Wars-level visual spectacle (bloom, reactive grid, particle trails, screen shake). The difficulty curve should feel like:

- **0-45s (Tutorial):** Gentle. Learn to move and shoot. Just rhombus + pinwheel.
- **45-150s (Ramp Up):** Swarms start. FibSpiral and Mobius appear. 20-40 enemies on screen.
- **150-300s (Mid Game):** Formations (surround, pincer, wall). Koch, Penrose, Sierpinski. 30-60 enemies.
- **300-480s (Intense):** Ambush spawns. Tesseract, Klein, HyperbolicDisc. 40-80 enemies.
- **480s+ (Chaos):** Maximum spawn rates. Mandelbrot and MengerDust. Screen constantly full.

The cadence system alternates between **burst windows** (double spawn rates for 5-10s) and **breathers** (only trickle spawns for 3-5s) to create tension/release rhythm. This is critical to the feel.

Player has 5 lives. Weapon auto-upgrades at score milestones (single → faster → dual → faster dual → triple shot). Score drives progression — not time alone.

---

## Tech Stack

| Component | Technology |
|---|---|
| Language | TypeScript (strict mode) |
| Build | Vite + vite-plugin-glsl |
| Rendering | Raw WebGL 2 (no framework) |
| Audio | Web Audio API (SFX from WAV files + procedural music) |
| Deploy | GitHub Actions → GitHub Pages |
| Package Manager | npm |

---

## Directory Structure

```
web/src/
├── index.ts                    # Entry point, creates Engine + Game
├── game.ts                     # Main game loop, state machine, orchestrator (~900 lines)
├── config.ts                   # ALL tunable constants (speeds, colors, HP, spawn rates, etc.)
├── glsl.d.ts                   # TypeScript declarations for GLSL imports
│
├── core/
│   ├── vector.ts               # Vec2 class (immutable-style math)
│   ├── camera.ts               # Camera follow + screen shake
│   ├── input.ts                # Keyboard/mouse/touch unified input
│   ├── collision.ts            # Bullet↔enemy, player↔enemy, deathstar interactions
│   ├── audio.ts                # AudioManager (SFX + ProceduralMusic)
│   └── haptics.ts              # Vibration API wrapper
│
├── renderer/
│   ├── sprite-batch.ts         # Batched WebGL line/triangle renderer (Renderer class)
│   ├── bloom.ts                # Multi-pass bloom: brightness extract → Gaussian blur → composite
│   ├── grid.ts                 # Reactive background grid with displacement forces + gravity wells
│   ├── trails.ts               # Per-entity trail system (ring buffers of positions)
│   ├── starfield.ts            # Background star dots
│   └── webgl-context.ts        # Shader compilation helpers
│
├── entities/
│   ├── entity.ts               # Base Entity class (position, velocity, rotation, active)
│   ├── player.ts               # Player ship (movement, shooting, lives, weapon progression)
│   ├── bullet.ts               # BulletPool with object pooling
│   ├── explosion.ts            # ExplosionPool with line particles
│   ├── crosshair.ts            # Mouse reticle (desktop only)
│   └── enemies/
│       ├── enemy.ts            # Base Enemy (follow, bounce, attack, spawnAtEdge, onBulletHit)
│       │                       #   onBulletHit returns 'damage' | 'absorb' | 'reflect'
│       ├── rhombus.ts          # Tier 1 — basic tracker
│       ├── pinwheel.ts         # Tier 1 — bouncer
│       ├── square.ts           # Tier 2 — splits into Square2 children
│       ├── circle.ts           # Tier 2 — fast, spawned by Triangle/Octagon/DeathStar
│       ├── triangle.ts         # Tier 2 — bounces, spawns Circles on death
│       ├── octagon.ts          # Tier 3 — predictive aim, 3 HP, spawns Circles on death
│       ├── blackhole.ts        # Tier 3 — absorbs nearby enemies, grows stronger
│       ├── deathstar.ts        # Boss — 20 HP, attracts enemies, spawns Circles
│       ├── fibspiral.ts        # Tier 2 — logarithmic spiral toward player, fast
│       ├── mobius.ts           # Tier 2 — orbits player, periodic immunity phase
│       ├── koch.ts             # Tier 3 — ice trails that slow player, periodic dash
│       ├── penrose.ts          # Tier 3 — teleports every 4-5s with ghost afterimage
│       ├── sierpinski.ts       # Tier 3 — fractal breakup on hit, spawns Shards on death
│       ├── shard.ts            # Child — tiny fast triangle from Sierpinski death
│       ├── mengerdust.ts       # Tier 5 — absorbs first 3 bullets, overload window
│       ├── hyperbolicdisc.ts   # Tier 4 — warps nearby bullet trajectories
│       ├── tesseract.ts        # Tier 4 — dimensional phase (halved hitbox + 2x speed)
│       ├── mandelbrot.ts       # Tier 5 — boss-tier, spawns MiniMandel minions
│       ├── minimandel.ts       # Child — fast tracker spawned by Mandelbrot
│       └── klein.ts            # Tier 4 — reflects bullets from wrong angles
│
├── spawner/
│   ├── spawn-patterns.ts       # Enemy pools, formation generators (swarm/surround/wall/etc.)
│   └── wave-manager.ts         # Event-based spawn scheduler with cadence (burst/breather)
│
└── ui/
    ├── hud.ts                  # Score + lives overlay (2D canvas)
    ├── virtual-joystick.ts     # Mobile twin-stick joysticks
    └── offscreen-indicators.ts # Edge arrows for off-screen enemies
```

---

## Architecture & Key Patterns

### Game Loop (`game.ts`)

The `Game` class is the orchestrator. `update(dt)` runs every frame:

1. Player movement + shooting
2. Bullet pool update
3. DeathStar attraction (redirects enemy movement)
4. BlackHole attraction (pulls + absorbs nearby enemies)
5. Enemy AI updates (each enemy type has its own `update()`)
6. Wave manager produces `SpawnRequest[]` → enemies instantiated via `createEnemy()` factory
7. HyperbolicDisc bullet warping (bends bullets toward disc centers)
8. Koch ice trail collision (slows player)
9. Mandelbrot minion spawning (drains `pendingMinions` queue)
10. Collision detection → kill processing → child spawning
11. Explosion + grid + camera updates
12. Music intensity adjustment

`render()` draws: grid → starfield → entities (normal blend) → trails + explosions (additive blend) → bloom post-process → HUD overlay.

### Rendering Pipeline

```
Scene FBO → Bloom (brightness extract → blur passes → composite with chromatic aberration) → Screen
```

- `Renderer` (sprite-batch.ts) batches all line/triangle draws per frame
- Bloom uses ping-pong framebuffers, half-res on mobile (2 passes instead of 6)
- Grid renders with its own shader, supports gravity wells from Octagon/BlackHole/DeathStar/HyperbolicDisc
- Trails are ring buffers rendered as fading line segments with additive blending

### Enemy System

All enemies extend `Enemy` (which extends `Entity`). Key methods:
- `update(dt, playerPos?)` — AI movement
- `render(renderer)` / `renderGlow(renderer, time)` — drawing
- `onBulletHit(bulletAngle)` → `'damage'` | `'absorb'` | `'reflect'` — collision reaction
- `hit()` → `boolean` — returns true if dead
- `onDeath()` → `EnemyDeathResult` — optional child spawning

Special mechanics are handled in `game.ts` rather than in enemy classes:
- **HyperbolicDisc** bullet warping: game.ts iterates bullets near discs
- **Koch** ice trails: game.ts checks player distance to trail segments
- **Mandelbrot** minion spawning: game.ts drains `pendingMinions` queue
- **BlackHole** absorption: game.ts `applyBlackHoleAttraction()`

### Spawn System

`WaveManager` uses an event-based scheduler. Each event has:
- Phase restrictions (which difficulty phases it's active in)
- Interval + variance (how often it fires)
- Min/max count
- Handler function that returns `SpawnRequest[]`

Events: `trickle`, `swarm`, `squad`, `wall`, `surround`, `pincer`, `ambush`, `cascade`, `boss`

Cadence system overlaid on top: burst windows (0.5x intervals) alternate with breathers (only trickle fires).

Spawn pools are weighted arrays in `spawn-patterns.ts`. More copies of an enemy type = higher spawn chance. Pools are per-phase (tutorial → rampUp → midGame → intense → chaos).

Formation generators (`generateSwarm`, `generateSurround`, etc.) compute positions and stagger delays.

### Collision System

Simple circle-circle in `collision.ts`. No spatial partitioning (not needed yet — O(bullets * enemies) is fast enough at current scale).

The `onBulletHit()` virtual method allows enemies to override bullet interaction:
- `Klein` reflects bullets from outside its safe arc
- `MengerDust` absorbs bullets until overloaded
- `Mobius` is immune during phase shift (handled in its own update, makes itself untargetable)

### Config System

**Every tunable value** lives in `config.ts`. Nothing is hardcoded in entity classes. This includes:
- All enemy colors, speeds, scores, HP values
- All collision radii
- Difficulty phase boundaries
- Explosion particle counts and durations
- Camera zoom, shake intensities
- Bloom parameters
- Grid distortion strengths
- Trail lengths
- Mobile overrides
- Audio volume levels

### Audio System

- **SFX:** 11 WAV files loaded via Web Audio API. `playSFX(name)` creates a new AudioBufferSourceNode each call.
- **Music:** 4-layer procedural synthwave (bass pad, rhythm, arpeggio, lead). Layers cross-fade based on a 0-1 intensity value computed from game state. Intensity scales with difficulty phase + enemy count + boss presence.
- Safari quirk: AudioContext must be created/resumed on user gesture.

---

## How to Disable/Enable an Enemy

To comment out any enemy (e.g., Sierpinski):

1. **`spawn-patterns.ts`**: Remove from pool arrays (or comment out the `'sierpinski'` entries)
2. **`game.ts`**: Comment out the import and the `case 'sierpinski'` in `createEnemy()`
3. The `default` case in `createEnemy()` falls back to Rhombus, so stale spawn requests degrade gracefully

Config entries in `config.ts` can be left — unused config is harmless.

---

## Build & Run

```bash
cd web
npm install
npm run dev      # Dev server with hot reload
npm run build    # Production build to dist/
```

TypeScript check: `npx tsc --noEmit` from `web/`

Deployment: push to `main` → GitHub Actions builds and deploys to GitHub Pages.

---

## Development History & Completed Phases

### Phase 1 (MVP) — Complete
Project scaffolding, WebGL renderer, player, bullets, all 7 original enemies + DeathStar, collision detection, wave spawner, explosions, scrolling world with camera, game states, HUD, CI/CD.

### Phase 2 (Visual Polish) — Complete
Bloom post-processing, reactive background grid with displacement, particle trails, entity rendering polish (double-line, fusion circles), off-screen indicators, styled UI, crosshair.

### Phase 3 (Mobile & Audio) — Complete
Twin-stick virtual joysticks, responsive canvas, mobile performance optimizations (half-res bloom, reduced particles/trails), all 11 SFX via Web Audio API, procedural 4-layer adaptive music, audio controls with M key mute, Safari audio handling.

### New Enemies Expansion — Complete
10 new fractal/topology enemies (Sierpinski, Mobius, Koch, Penrose, MengerDust, HyperbolicDisc, FibSpiral, Tesseract, Mandelbrot, Klein) plus 2 child types (Shard, MiniMandel). Complete spawn system overhaul with event-based scheduler, 7 formation types, cadence system, and 5-phase difficulty curve.

### Phase 4 (Scores, Polish & Tuning) — Not Started
localStorage leaderboard, screenshot-friendly game over screen, debug overlay, difficulty curve tuning, performance profiling, cross-browser testing. See `TASKS.md` for full checklist.

---

## Known Technical Debt

- **WAV audio files** are large; could convert to OGG/MP3 for smaller bundle
- **Procedural music** uses setTimeout scheduling, not AudioContext scheduler — may drift slightly
- **No spatial partitioning** for collision — works fine now but could become a bottleneck at 100+ enemies with 200 bullets (16,000+ checks/frame). Add grid-based spatial hash if profiling shows issues
- **Reflected bullets (Klein)** reverse direction but don't become hostile to the player — they just bounce away. Full hostile-bullet-vs-player collision not implemented
- **No leaderboard** yet (Phase 4)
- **No debug overlay** yet (Phase 4)

---

## Design Documents

- **`PRD.md`** — Full product requirements document. Game design, visual design, audio design, controls, technical architecture, deployment, delivery phases.
- **`ENEMY_DESIGNS.md`** — Detailed designs for all 10 new enemy types. Shape descriptions, spawn/death animations, shader effects, novel mechanics. The definitive reference for enemy behavior intent.
- **`TASKS.md`** — Phase-by-phase task checklist with session handoff notes between phases.

---

## Important Conventions

- **All constants in config.ts.** If you add a new tunable value, put it there.
- **Enemy classes are self-contained.** Each enemy file defines its own shape, colors, AI, and rendering. Special cross-system mechanics (bullet warping, trail collision) are wired in `game.ts`.
- **Object pooling** for bullets and explosions. Enemies are not pooled (created/destroyed via array filter).
- **Additive blending** for trails and explosions. Normal blending for entities.
- **Mobile detection** via `'ontouchstart' in window`. Mobile gets: reduced bloom passes, smaller particle counts, shorter trails, different zoom level.
- **No external runtime dependencies.** Everything is vanilla TypeScript + WebGL + Web Audio API.
- **Commit working state.** Always verify `npm run build` succeeds before committing.
