# CLAUDE.md — Geometry Genocide

> Context document for AI assistants working on this codebase.
> Read this file, `PRD.md`, `ENEMY_DESIGNS.md`, and `TASKS.md` before making changes.

**Workflow rules:**
1. After each change, commit and push to master.
2. **MANDATORY: Update this CLAUDE.md file** after every code change to reflect the current state of the codebase. This includes: new/changed config values, new settings, architectural changes, new files, completed work items, and any other information that would help a future AI assistant understand the codebase. This update must be part of the same commit as the code change.
3. **MANDATORY: Test every change with a Playwright test** before committing. Use the `/playwright` skill to write and run tests that verify your changes work correctly.

---

## What This Is

Geometry Genocide is a browser-based twin-stick arcade shooter inspired by Geometry Wars. Originally a Python 2/Pygame desktop game by Sam Macpherson (2013), it was rebuilt from scratch as a TypeScript + raw WebGL game deployed to GitHub Pages.

**Play it:** https://ichpuchtli.github.io/Geometry-Genocide/

The game runs entirely client-side. No backend. No external dependencies at runtime. WebGL renders everything — bloom, grid distortion, particle trails. Audio is Web Audio API with procedural synthwave music. Mobile uses twin-stick virtual joysticks.

---

## Project Vision & Design Intent

The core experience is **neon chaos** — dozens to hundreds of geometric enemies swarming the player in a scrolling arena, with Geometry Wars-level visual spectacle (bloom, reactive grid, particle trails, screen shake). The difficulty curve should feel like:

- **0-30s (Tutorial):** Gentle. Learn to move and shoot. Rhombus, pinwheel, rare blackhole.
- **30-120s (Ramp Up):** Swarms + walls start. Square and blackhole added. 20-40 enemies on screen.
- **120-240s (Mid Game):** Formations (surround, pincer, wall). Sierpinski, blackhole. 30-60 enemies.
- **240-400s (Intense):** Ambush + cascade spawns. All types at higher rates. 40-80 enemies.
- **400s+ (Chaos):** Maximum spawn rates. Screen constantly full.

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
├── game.ts                     # Main game loop, state machine, orchestrator (~1030 lines)
├── config.ts                   # ALL tunable constants (speeds, colors, HP, spawn rates, etc.)
├── glsl.d.ts                   # TypeScript declarations for GLSL imports
│
├── core/
│   ├── vector.ts               # Vec2 class (immutable-style math)
│   ├── camera.ts               # Camera follow + screen shake
│   ├── input.ts                # Keyboard/mouse/touch unified input
│   ├── collision.ts            # Bullet↔enemy, player↔enemy collision
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
│   ├── crosshair.ts            # Aim chevron indicator (directional arrow near player)
│   └── enemies/
│       ├── enemy.ts            # Base Enemy (follow, bounce, attack, spawnAtEdge, onBulletHit)
│       │                       #   onBulletHit returns 'damage' | 'absorb' | 'reflect'
│       ├── rhombus.ts          # Tier 1 — basic tracker
│       ├── pinwheel.ts         # Tier 1 — bouncer
│       ├── square.ts           # Tier 2 — splits into Square2 children
│       ├── circle.ts           # Child — fast, spawned only by BlackHole overload explosion
│       ├── blackhole.ts        # Tier 3 — spawns anywhere in arena, pulls player + absorbs enemies, overload spawns Circles
│       ├── sierpinski.ts       # Tier 3 — fractal breakup on hit, spawns Shards on death
│       ├── shard.ts            # Child — tiny fast triangle from Sierpinski death
│       │                       # --- Files below exist but are NOT wired into spawner ---
│       ├── triangle.ts         # (unwired) bounces, spawns Circles on death
│       ├── fibspiral.ts        # (unwired) logarithmic spiral toward player
│       ├── mobius.ts           # (unwired) orbits player, periodic immunity phase
│       ├── koch.ts             # (unwired) ice trails that slow player
│       ├── penrose.ts          # (unwired) teleports every 4-5s
│       ├── mengerdust.ts       # (unwired) absorbs first 3 bullets
│       ├── hyperbolicdisc.ts   # (unwired) warps nearby bullet trajectories
│       ├── tesseract.ts        # (unwired) dimensional phase
│       ├── mandelbrot.ts       # Miniboss — fractal cardioid, 3 HP stages, spawns MiniMandels
│       ├── minimandel.ts       # Child — small cardioid tracker spawned by Mandelbrot miniboss
│       └── klein.ts            # (unwired) reflects bullets from wrong angles
│
├── spawner/
│   ├── spawn-patterns.ts       # Enemy pools, formation generators (swarm/surround/wall/etc.)
│   └── wave-manager.ts         # Event-based spawn scheduler with cadence (burst/breather)
│
├── settings.ts                 # Game settings / difficulty tuning state
│
└── ui/
    ├── hud.ts                  # Score + lives overlay (2D canvas)
    ├── settings-panel.ts       # Settings panel for difficulty tuning with descriptions (mobile portrait + desktop menu/gameover)
    ├── virtual-joystick.ts     # Mobile twin-stick joysticks
    └── offscreen-indicators.ts # Edge arrows for off-screen enemies
```

---

## Architecture & Key Patterns

### Game Loop (`game.ts`)

The `Game` class is the orchestrator. `update(dt)` runs every frame:

1. Player movement + shooting
2. BlackHole player pull (gravity toward nearby blackholes)
3. Bullet pool update + trail bookkeeping
4. BlackHole enemy attraction (pulls + absorbs nearby enemies)
5. Enemy AI updates (each enemy type has its own `update()`)
6. Wave manager produces `SpawnRequest[]` → enemies instantiated via `createEnemy()` factory
7. Collision detection → kill processing → child spawning
8. Staggered spawn queue processing (theatrical child spawns)
9. Explosion + grid physics + gravity wells + camera updates
10. Music intensity adjustment

`render()` draws: grid → starfield → entities (normal blend) → trails + explosions (additive blend) → bloom post-process → HUD overlay.

### Rendering Pipeline

```
Scene FBO → Bloom (brightness extract → blur passes → composite with chromatic aberration) → Screen
```

- `Renderer` (sprite-batch.ts) batches all line/triangle draws per frame
- Bloom uses ping-pong framebuffers, half-res on mobile (2 passes instead of 6)
- Grid renders with its own shader, supports gravity wells from BlackHole with spacetime fabric visual (perspective contraction + depth coloring via well uniforms)
- Trails are ring buffers rendered as fading line segments with additive blending

### Enemy System

All enemies extend `Enemy` (which extends `Entity`). Key methods:
- `update(dt, playerPos?)` — AI movement
- `render(renderer)` / `renderGlow(renderer, time)` — drawing
- `onBulletHit(bulletAngle)` → `'damage'` | `'absorb'` | `'reflect'` — collision reaction
- `hit()` → `boolean` — returns true if dead
- `onDeath()` → `EnemyDeathResult` — optional child spawning

Special mechanics are handled in `game.ts` rather than in enemy classes:
- **BlackHole** attraction + absorption: game.ts `applyBlackHoleAttraction()` + `applyBlackHolePlayerPull()`
- **BlackHole hard cap**: max 4 active at once (enforced in spawn loop)

### Spawn System

`WaveManager` uses an event-based scheduler. Each event has:
- Phase restrictions (which difficulty phases it's active in)
- Interval + variance (how often it fires)
- Min/max count
- Handler function that returns `SpawnRequest[]`

Events: `trickle`, `swarm`, `squad`, `wall`, `surround`, `pincer`, `ambush`, `cascade`

Cadence system overlaid on top: burst windows (0.5x intervals) alternate with breathers (only trickle fires).

Spawn pools are weighted arrays in `spawn-patterns.ts`. More copies of an enemy type = higher spawn chance. Pools are per-phase (tutorial → rampUp → midGame → intense → chaos).

Formation generators (`generateSwarm`, `generateSurround`, etc.) compute positions, stagger delays, and return `FormationResult` with metadata (formation type, side, center) used by the telegraph system.

### Collision System

Simple circle-circle in `collision.ts`. No spatial partitioning (not needed yet — O(bullets * enemies) is fast enough at current scale).

The `onBulletHit()` virtual method allows enemies to override bullet interaction (currently only the default `'damage'` is used by active enemies, but `'absorb'` and `'reflect'` are supported for unwired enemy types).

### Config System

**Every tunable value** lives in `config.ts` (compile-time defaults) or `settings.ts` (runtime-tunable via settings panel with localStorage persistence). Nothing is hardcoded in entity classes.

**`config.ts`** (compile-time constants):
- All enemy colors, speeds, scores, HP values
- All collision radii
- Difficulty phase boundaries
- Explosion particle counts and durations
- Camera zoom, shake intensities (shake reserved for blackhole kills + player death; pinwheel/rhombus/default kills have no camera shake — grid impulse only)
- Bloom parameters
- Grid spring stiffness (neighbor springs), grid spacing
- Trail lengths
- Mobile overrides
- Audio volume levels
- Hitstop durations per enemy family (square 35ms, sierpinski 50ms, blackhole 75ms, multi-kill 35ms)
- Kill signature effect duration (0.4s), ray count (6), ray length (80px)
- Phase transition banner duration (2.5s), border pulse duration (1.5s), display names
- Spawn telegraph duration (1.2s), color
- Heat system: decay rate (0.04/s), kill increments (base 0.02, elite 0.08, blackhole 0.12), dense combat bonus (0.01/kill), phase bump (0.15), survival rate (0.003/s)
- Heat visual scaling: border brightness max (0.5), bloom boost max (0.5), grid turbulence max (60)
- Recovery window: duration (3500ms), fire rate multiplier (1.8x), shield color (cyan), shield radius (32px)
- Miniboss: HP (20), score (10000), collision radius (55), spawn time (240s/intense phase), warning duration (3s), stage thresholds (HP 14 → stage 2, HP 7 → stage 3), hitstop (stage break 100ms, death 150ms), minion spawn intervals per stage (3.5s/2.0s/1.2s), max minions per stage (4/6/8), movement speed per stage (0.02/0.04/0.06), bud regrow time (2s), respawn delay (5s), defeated banner duration (3s), spawn suppression multiplier (4x)
- Generated SFX paths: `GENERATED_SFX` record mapping names to MP3 paths in `sounds/generated/`
- Medals: 10 deterministic `MedalDef` entries (id, name, description, color) — UNTOUCHABLE, CHAOS WALKER, SURVIVOR, BOSS SLAYER, ELITE HUNTER, GRAVITY MASTER, INFERNO, COMEBACK KID, CENTURION, THOUSAND

**`settings.ts`** (runtime-tunable, persisted in localStorage):
- Spawn rate, starting lives, player/enemy speed, fire rate, starting phase, max enemies
- Bloom intensity, trail length
- BlackHole gravity: attract radius, enemy pull, player pull, grid mass base/per-absorb, grid radius multiplier, perspective depth (3D illusion strength)
- Grid physics: anchor stiffness, damping, max displacement (read by `grid.ts` each frame)
- Vulnerable during spawn: boolean toggle to allow bullets to kill spawning enemies
- **GPU Stress settings** (arena/grid/bloom/resolution — changes take effect on game restart):
  - Arena size: `arenaWidth` (800–6400), `arenaHeight` (500–4000)
  - Grid: `gridSpacing` (10–80, triggers grid rebuild), `gridSubsteps` (1–8), `gridSpringStiffness` (100–3000)
  - Bloom: `bloomThreshold` (0.01–0.5), `bloomBlurPasses` (1–12), `bloomBlurRadius` (0.5–6.0)
  - `resolutionScale` (0.25–2.0, multiplies device pixel ratio)
  - `zoomScale` (0.5–1.5, camera zoom multiplier — lower = see more arena, updates live via resize dispatch)

### Audio System

- **SFX:** 11 WAV files loaded via Web Audio API. `playSFX(name)` creates a new AudioBufferSourceNode each call.
- **SFX config source of truth:** `config.ts` `SFX_NAMES` now lists only shipped `.wav` files in `sounds/`. Older `_high` / `_low` / `_swarm` alternates and `gameover.wav` trial entries were removed after not being kept.
- **ElevenLabs generation helper:** `scripts/generate-elevenlabs-sfx.mjs` calls ElevenLabs sound-generation API using `ELEVENLABS_API_KEY` and can run either a single prompt (`--text`, `--out`) or a JSON batch manifest (`--manifest`). Example jobs for kill-sound exploration live in `scripts/elevenlabs-sfx-jobs.example.json`. Outputs are intended for exploratory asset generation, not automatic gameplay wiring.
- **ElevenLabs prompt packs:** `scripts/elevenlabs-sfx-jobs-existing-sounds.json` contains one generation prompt per currently shipped legacy/core SFX (`start`, `die`, `die1`, `crash`, `square`, `rhombus`, `triangle2`, `octagon`, `pinwheel`, `deathstar`, `deathstar2`) so Codex can batch-generate replacements/variants aligned to the current pack.
- **Enemy form/destroy prompt pack:** `scripts/elevenlabs-sfx-jobs-unit-form-and-destroy.json` contains paired ElevenLabs prompts for the active enemy families (`rhombus`, `square`, `pinwheel`, `sierpinski`, `blackhole`) covering both formation and destruction sounds. Destroy prompts are anchored to the current procedural kill/death pitch contours in `audio.ts` so generations can stay close to the existing sonic DNA.
- **Menu soundtrack prompt pack:** `scripts/elevenlabs-menu-soundtracks.json` contains long-form ElevenLabs prompts for two 1min+ stitched menu themes: a bright start-menu theme extending `sounds/start.wav`, and a dark game-over theme extending `sounds/die.wav`. Each soundtrack is generated as three 24-second segments and stitched locally.
- **Procedural SFX prompt pack:** `scripts/elevenlabs-procedural-sfx.json` contains ElevenLabs replacements for the discrete procedural cues in `audio.ts`: family kill signatures, phase transition, elite arrive/kill, telegraph warning, recovery start/expire, and black-hole death. It does not try to replace the live `ProceduralMusic` system, only one-shot/short-event sounds.
- **Project ElevenLabs skill:** `.agents/skills/elevenlabs-game-audio/SKILL.md` documents the project-local ElevenLabs workflow and points future agents at the generator script, prompt packs, and menu-theme stitching helper. `npm run sfx:stitch-menus` wraps `scripts/stitch-elevenlabs-menu-themes.sh`.
- **Kill signature preview assets:** Review-only prototype WAVs live in `sounds/kill-signature-previews/` and are generated by `scripts/generate-kill-signature-previews.sh` as layered FFmpeg-synthesized previews. They are not wired into gameplay yet.
- **Procedural kill SFX:** `playKillSignature(family)` generates per-family death sounds:
  - Rhombus: sharp crystalline ping (2400→1200 Hz sine)
  - Square: heavy thud (120→40 Hz sine + noise crunch)
  - Pinwheel: spinning whoosh (sawtooth sweep 400→1600→200 Hz through bandpass)
  - Sierpinski: layered fractal tones (3 descending triangle waves at 880/660/440 Hz)
  - BlackHole: existing procedural explosion (`playBlackHoleDeath`)
- **Phase transition SFX:** `playPhaseTransition()` — rising sawtooth sweep + bass impact hit.
- **Telegraph SFX:** `playTelegraphWarning()` — short square wave buzz.
- **Recovery SFX:** `playRecoveryStart()` — ascending power chord (E4/A4/E5 + shimmer). `playRecoveryExpire()` — descending two-tone warning.
- **Miniboss SFX:** `playMinibossWarning()` — pulsing bass rumble + descending square wave klaxon. `playMinibossArrive()` — rising sweep into bass drop + metallic crash. `playMinibossStageBreak()` — heavy sawtooth crack + sub thud. `playMinibossDeath()` — bass boom + C major triumph chord + noise crash + shimmer tail.
- **Game over SFX:** `playGameOver()` — ElevenLabs-generated dark dramatic stinger (MP3, loaded from `sounds/generated/gameover.mp3`).
- **Medal reveal SFX:** `playMedalReveal()` — ElevenLabs-generated triumphant fanfare (MP3, loaded from `sounds/generated/medal-reveal.mp3`).
- **Generated SFX pipeline:** `GENERATED_SFX` in config.ts maps names to MP3 paths in `sounds/generated/`. Loaded in `audio.ts` via `loadGeneratedSFX()` alongside WAV files. Files also copied to `web/public/sounds/generated/` for Vite serving.
- **Music:** 4-layer procedural synthwave (bass pad, rhythm, arpeggio, lead). Layers cross-fade based on a 0-1 intensity value computed from game state. Intensity scales with difficulty phase + enemy count + phase transition bump + heat (0.15 * heat).
- Safari quirk: AudioContext must be created/resumed on user gesture.

---

## How to Disable/Enable an Enemy

To comment out any enemy (e.g., Sierpinski):

1. **`spawn-patterns.ts`**: Remove from pool arrays (or comment out the `'sierpinski'` entries)
2. **`game.ts`**: Comment out the import and the `case 'sierpinski'` in `createEnemy()`
3. The `default` case in `createEnemy()` falls back to Rhombus, so stale spawn requests degrade gracefully

Config entries in `config.ts` can be left — unused config is harmless.

**Currently active in spawn pools:** rhombus, pinwheel, square, blackhole, sierpinski (5 types).
**Child-only types** (spawned by parents, not in pools): circle (BlackHole overload), shard (Sierpinski death), square2 (Square split), minimandel (Mandelbrot miniboss).
**Boss types** (spawned by encounter system, not in pools): mandelbrot (signature miniboss, spawns at 240s/intense phase).
**Kill family mapping** (`getEnemyFamily()` in game.ts): Maps enemy instances to family strings for kill signatures/SFX/effects. Circle→`'circle'` (falls to default handler), Shard→`'sierpinski'`, Mandelbrot→`'mandelbrot'`, MiniMandel→`'minimandel'`. Only actual `BlackHole` instances use the `'blackhole'` kill path (which accesses `absorbedCount`).
**BlackHole spawns anywhere** in the arena (not at edges like other enemies).
**Mandelbrot miniboss** spawns away from the player via the encounter system in `game.ts` (not through WaveManager pools).

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
Project scaffolding, WebGL renderer, player, bullets, original enemies (rhombus, pinwheel, square, circle, triangle), collision detection, wave spawner, explosions, scrolling world with camera, game states, HUD, CI/CD.

### Phase 2 (Visual Polish) — Complete
Bloom post-processing, reactive background grid with displacement, particle trails, entity rendering polish (double-line, fusion circles), off-screen indicators, styled UI, crosshair.

### Phase 3 (Mobile & Audio) — Complete
Twin-stick virtual joysticks, responsive canvas, mobile performance optimizations (half-res bloom, reduced particles/trails), all 11 SFX via Web Audio API, procedural 4-layer adaptive music, audio controls with M key mute, Safari audio handling.

### New Enemies Expansion — Complete (then pruned)
10 new enemy source files created (Sierpinski, Mobius, Koch, Penrose, MengerDust, HyperbolicDisc, FibSpiral, Tesseract, Mandelbrot, Klein) plus 2 child types (Shard, MiniMandel). Complete spawn system overhaul with event-based scheduler, 7 formation types, cadence system, and 5-phase difficulty curve. Subsequently, 9 gimmick enemies were unwired from the spawn system to focus on Geometry Wars-style swarm + gravity well gameplay. Only Sierpinski (+Shard child) remains active from this expansion. Octagon and DeathStar were deleted entirely.

### Post-expansion Polish — Complete
- Mobile viewport fixes: edge-to-edge zoom, camera follow, iOS PWA safe area, 100dvh
- Settings panel for difficulty tuning (spawn rate, lives, speed, fire rate, phase skip)
- Spawn animation rework (theatrical grow-in, staggered child spawns)
- Player ship redesign as Geometry Wars-style claw/pincer
- Player-to-cursor aiming: aim angle = atan2(cursorWorld - playerWorld), standard mouse-aim like Nuclear Throne / Hotline Miami
- BlackHole overhaul: stationary, player gravitational pull, shrink-per-bullet, overload explosion, gravitational lensing, electric blue-white plasma visuals, procedural death SFX
- Octagon & DeathStar removal (redundant with BlackHole)
- Spring-mass grid rewrite, smaller arena (1600x1000), auto-fit zoom
- Death slowmo mechanic reused for game over transition
- BlackHole gravity fix: grid bending, enemy pull, player pull all retuned from imperceptible to visible levels. Grid anchor stiffness (50→15), damping (12→8), max displacement (60→120). BH enemy pull (0.18→1.5), player pull (0.4→2.5), grid mass (80→250). Grid physics now runtime-tunable via settings panel sliders.
- Desktop settings panel: Settings panel (17 sliders + phase dropdown + checkbox) now visible on desktop during menu and gameover states. Right-side sidebar with semi-transparent background, scrollable full-height, hidden during gameplay. `settings-panel.ts` refactored to support multiple mount points (mobile `#settings-mount` + desktop `#desktop-settings`), with cross-instance sync on value changes. `game.ts` calls `showDesktopSettings()`/`hideDesktopSettings()` on state transitions (skipped on mobile). Each slider has a description line explaining what it controls.
- Spawn rework: Triangle unwired from spawner (circle was its child). Circle removed from all spawn pools — now only spawned by BlackHole overload explosion. BlackHole spawns anywhere in the arena (not at edges). New `spawnAnywhere()` method on Enemy base class.
- Vulnerable during spawn setting: New boolean toggle in settings panel. When enabled, bullets can kill enemies during their spawn-in animation. Checked in `collision.ts`.
- Crosshair cursor: Desktop crosshair rendered at mouse world position (4 inward-pointing chevrons with slow rotation animation, neon green). Touch mode renders crosshair near player at aim direction. Desktop aim = atan2(cursorWorld - playerWorld) — standard player-to-cursor aiming. Old `AIM_CHEVRON_*` config replaced with `CROSSHAIR_*` constants.
- GPU Stress settings: 9 new runtime-tunable sliders for arena size (800–6400 × 500–4000), grid resolution (spacing 10–80, substeps 1–8, stiffness 100–3000), bloom quality (threshold, passes 1–12, radius), and resolution scale (0.25–2.0x DPR). Arena/grid changes rebuild on game restart via `grid.rebuild()` + starfield recreation. All world bounds (`WORLD_WIDTH`/`WORLD_HEIGHT` references in enemy, player, bullet, camera, spawn-patterns) now read from `gameSettings.arenaWidth`/`arenaHeight`. Grid `cols`/`rows`/`totalPoints` moved from module-level constants to instance properties. Large grids (>65535 vertices) use `OES_element_index_uint` for 32-bit index buffers.
- BlackHole enhancement — fewer but more dangerous: Hard cap at 4 active BlackHoles (enforced in game.ts spawn loop). `BLACKHOLE_HP` 4→8 (takes twice as many bullets). Default gravity settings increased: `bhAttractRadius` 300→400, `bhEnemyPull` 2.5→3.0, `bhPlayerPull` 3.5→4.0, `bhGridMassBase` 400→500, `bhGridRadiusMultiplier` 2.5→3.0, `GRID_MAX_DISPLACEMENT` 120→160.
- Spacetime fabric grid visual: Grid shader now receives gravity well positions/strengths as uniforms (up to 8 wells). Vertex shader applies perspective contraction (vertices near wells pull toward center using `radius` not `dist`, so inner vertices displace most — true funnel shape). Fragment shader applies depth-based coloring (dark indigo center, bright blue-white rim glow at well edge, alpha boost). Grid.ts preserves well data across update→render gap in `renderWellX/Y/Str/Rad` arrays. `bhGridPerspectiveDepth` setting (0.0–1.0, default 0.8) controls 3D illusion strength via "BH Depth Effect" slider. `bhGridMassBase` slider max: 800. **Grid edge fix:** Vertex shader receives `a_anchored` attribute (float, 0 or 1) from grid.ts — perimeter vertices skip perspective contraction entirely (`movable = 1.0 - a_anchored`), preventing edge detachment. Contraction amount clamped to `min(contractAmount, dist * 0.8)` to prevent mesh self-intersection artifacts. Vertex data expanded from 4 to 5 floats/vertex (stride 20 bytes).
- Auto-fire toggle: `F` key toggles continuous firing without holding mouse button. HUD shows "AUTO-FIRE [F]" indicator when active. `Input.autoFire` boolean, checked in `isMouseDown()`.
- Cursor visibility: System cursor shown on menu and gameover screens (`cursor: default`), hidden during gameplay (`cursor: none`). Controls hint updated to show `F auto-fire` and `M mute`.

### Readability + Impact Foundation (ROADMAP Phase 1) — Complete
Combat feedback system added to `game.ts` as a lightweight state layer:
- **Hitstop:** Freezes gameplay simulation (enemies, bullets, spawner) for 35-75ms on significant kills while keeping visual systems (explosions, grid, camera shake) running. Per-family durations: square (35ms), sierpinski (50ms), blackhole (75ms). Multi-kill bonus (3+ kills same frame: 35ms).
- **Kill signatures:** Per-enemy-family death effects rendered in additive blend pass (`KillEffect` array in game.ts). Rhombus: crystal burst with narrow rays + white tips. Square: chunky rotating fragment outlines. Pinwheel: spark spiral with rotating particles + bright tips. Sierpinski: layered concentric triangle outlines expanding.
- **Kill signature audio:** Procedural SFX per family via Web Audio API (`AudioManager.playKillSignature(family)`). Replaces generic `crash` SFX for typed kills.
- **Phase transitions:** WaveManager emits `onPhaseChange` callback. Game shows animated HUD banner (fade-in/slide-in, hold, fade-out with dark stripe + accent lines). Border pulses white→orange. Music intensity gets temporary +0.15 bump. Phase display names: STAGE 2, STAGE 3, DANGER, CHAOS.
- **Spawn telegraphs:** Formation generators return `FormationResult` with metadata (formation type, side, center). WaveManager populates `formationEvents[]` each frame. Game renders border warning arcs (pulsing orange lines on the relevant arena edge) for edge formations (wall, swarm, cascade, pincer). Surround/ambush show dashed warning rings at spawn center. Telegraph audio: short square-wave buzz.
- **Formation metadata flow:** `spawn-patterns.ts` generators → `FormationResult{spawns, meta}` → `WaveManager.formationToRequests()` → `formationEvents[]` → `game.ts` telegraph rendering.

### Elite Layer (ROADMAP Phase 2) — Complete
Elite enemy system as composable stat/behavior overlays on existing enemy classes:
- **Elite metadata:** `Enemy.baseType` and `Enemy.isElite` fields on base Enemy class. No new enemy subclasses — elites reuse existing Rhombus, Pinwheel, Square, Sierpinski, BlackHole.
- **Stat overlays:** `ELITE_MODIFIERS` in config.ts — per-family speed multiplier, score multiplier, HP bonus, color brightening. Rhombus: 1.4x speed, 3x score, +1 HP. Pinwheel: 1.3x speed, 2.5x score, +1 HP. Square: 2x score, +2 HP. BlackHole: 1.5x score, +4 HP. Sierpinski: 1.2x speed, 2x score, +1 HP.
- **Elite presentation:** Golden rotating dashed crown ring around elite enemies (rendered in `Enemy.renderEliteRing()`). Brighter base color from colorBright modifier. Longer/larger kill signature with golden-white primary burst + secondary colored burst layer.
- **Elite injection:** `ELITE_CHANCE_BY_PHASE` in config.ts controls probability per phase. tutorial/rampUp: 0%. midGame: 8%. intense: 15%. chaos: 22%. Injected in `WaveManager.update()` by rolling against chance for each queued spawn. Child types (circle, shard) excluded.
- **Concurrent cap:** `MAX_CONCURRENT_ELITES = 3` enforced in game.ts spawn loop. Excess elite requests downgraded to normal.
- **Elite audio:** `playEliteArrive()` — ascending two-tone chime on spawn. `playEliteKill()` — major chord stab (C5/E5/G5 triangle) + sub thud.
- **Elite hitstop:** `HITSTOP_ELITE = 65ms` applied on elite kills (stacks with family hitstop via max()).
- **Factory:** `createEnemy(type, pos, isElite)` applies modifiers when `isElite=true`. `SpawnRequest.isElite` flag flows through wave manager → game.ts.

### Heat System + Recovery Window (ROADMAP Phase 3) — Complete
Heat system and post-death recovery window added to `game.ts`:
- **Heat meter:** Global `heat` value (0-1) tracks run intensity. Increases from kills (base 0.02, elite 0.08, blackhole 0.12), dense combat bonus (3+ kills/frame: 0.01/kill), phase transitions (+0.15), survival in intense+ phases (0.003/s). Decays at 0.04/s when no kills for 2+ seconds.
- **Heat visual hooks:**
  - Arena border shifts warm (blue→orange/white) with increasing heat via HEAT_BORDER_BRIGHTNESS_MAX
  - Bloom intensity increases by up to HEAT_BLOOM_BOOST_MAX (0.5) at max heat
  - Grid gets random micro-impulse turbulence (up to HEAT_GRID_TURBULENCE_MAX) at heat >0.1
  - Music intensity gets +0.15 * heat boost via `computeIntensity()`
- **Heat HUD:** Removed — heat is communicated purely through visual/audio spectacle (border color, bloom, grid turbulence, music intensity), not an explicit meter.
- **Recovery window:** Activated on non-final respawn (after death slowmo). 3500ms duration.
  - Player invulnerable for full recovery duration (overrides normal 2s invuln)
  - Fire rate boosted 1.8x via `Player.fireRateOverride`
  - Pulsing cyan shield ring around player (`renderRecoveryShield()` in game.ts)
  - Expiry warning: orange blink ring + descending tone at 800ms remaining
  - "RECOVERY" HUD banner with progress bar, color shifts to warn color when expiring
  - Audio: `playRecoveryStart()` — ascending power chord + shimmer. `playRecoveryExpire()` — descending two-tone warning.
  - Non-stackable: only one recovery per respawn
- **Key files modified:** `config.ts` (heat/recovery constants), `game.ts` (heat state, recovery state, visual hooks), `player.ts` (fireRateOverride), `hud.ts` (heat meter, recovery banner), `audio.ts` (recovery SFX).

### One Signature Miniboss (ROADMAP Phase 4) — Complete
Mandelbrot cardioid miniboss added as a chapter-break encounter during the intense phase:
- **Encounter flow:** WARNING banner (3s pulsing red) → Mandelbrot spawns away from player → fight with HP bar → BOSS DEFEATED banner
- **Mandelbrot miniboss:** 20 HP, 3 escalating stages (stage 2 at HP≤14, stage 3 at HP≤7). Stationary fractal spawner — cardioid shape with tendrils, period-2 bulb, bud indicators, crack lines from damage, stage transition aura.
- **Stage escalation:** Each stage increases movement speed (0.02→0.04→0.06), minion spawn rate (3.5s→2s→1.2s), max minions (4→6→8), tendril count, and visual intensity. Stage transitions trigger cracking SFX + 100ms hitstop + screen shake.
- **MiniMandel minions:** Small cardioid trackers (16px radius, 0.25 speed, 150 score) spawned from buds on the Mandelbrot. Parent tracks active minion count; buds regrow (2s) when minions die.
- **Spawn suppression:** Normal spawn rate multiplied by 4x during the encounter, reducing enemy pressure.
- **Death sequence:** 150ms hitstop, triple-layer explosion (red/white/ember), all MiniMandels explode simultaneously, 1200-force grid shockwave, SCREEN_SHAKE_DEATH, heat set to max, "BOSS DEFEATED" golden banner (3s).
- **Kill signature:** Expanding cardioid outlines (5 layers) + bright white rays. Procedural death SFX: bass boom + C major triumph chord + noise crash + shimmer tail.
- **Player death during fight:** Boss destroyed by shockwave; re-triggers after 5s respawn delay if not defeated.
- **Collision:** Miniboss survives player contact (player dies, boss lives — `isMiniboss` flag checked in collision.ts).
- **HUD:** HP bar at top center (name + stage label + fill bar that changes color by HP fraction), WARNING banner (pulsing red), BOSS DEFEATED banner (golden glow).
- **Key files modified:** `config.ts` (miniboss constants), `mandelbrot.ts` (full rewrite as staged miniboss), `minimandel.ts` (parent tracking), `enemy.ts` (isMiniboss flag), `collision.ts` (miniboss survives player contact), `game.ts` (encounter state machine, spawn/kill handling, HUD rendering), `audio.ts` (4 miniboss SFX), `hud.ts` (HP bar, warning/defeated banners), `spawn-patterns.ts` (mandelbrot/minimandel types).

### Audio Success Language + End-of-Run Story (ROADMAP Phase 6) — Complete
Run-stats accumulator, end-of-run summary card, deterministic medals, and game over audio:
- **Run stats accumulator:** `RunStats` interface in `game.ts` tracks: score, kills, timeSurvived, phaseReached, peakHeat, elitesKilled, blackholesKilled, minibossDefeated, livesUsed, recoveriesUsed, weaponStage. Updated incrementally during play (kill processing, phase transitions, recovery activation, heat updates).
- **Game over summary card:** Replaces minimal "GAME OVER / score / time / kills" screen with rich animated summary. Staggered reveal: header (0s) → score (0.2s) → stats grid (0.4s+) → separator → medals (1.5s+) → replay prompt. Responsive layout scales for small screens.
- **Stats grid:** Two-column layout. Left: Time, Kills, Phase reached, Weapon stage. Right: combat stats (Elites, Black Holes, Boss defeated, Recoveries, Peak Heat) — only non-zero stats shown.
- **Deterministic medals:** 10 medals defined in `config.ts` (`MEDALS` array). Each has id, name, description, and display color. Awarded based on run stats: UNTOUCHABLE (no deaths), CHAOS WALKER (reached chaos), SURVIVOR (reached intense+), BOSS SLAYER (defeated Mandelbrot), ELITE HUNTER (5+ elites), GRAVITY MASTER (3+ blackholes), INFERNO (85%+ peak heat), COMEBACK KID (2+ recoveries), CENTURION (100+ kills), THOUSAND (1000+ kills). Computed via `computeMedals()` at game over.
- **Medal reveal animation:** Medals appear with staggered delay (1.5s base + 0.25s per medal) and pop-scale effect. Medal reveal SFX plays at 1.5s if medals earned.
- **Game over SFX:** `playGameOver()` plays ElevenLabs-generated dark dramatic stinger (`sounds/generated/gameover.mp3`). `playMedalReveal()` plays triumphant fanfare (`sounds/generated/medal-reveal.mp3`). Both loaded via `GENERATED_SFX` config mapping in audio.ts.
- **Generated SFX loading:** `audio.ts` now loads MP3 files from `sounds/generated/` via `GENERATED_SFX` record in config.ts alongside the existing WAV loading pipeline.
- **Key files modified:** `config.ts` (GENERATED_SFX, MEDALS, MedalDef), `audio.ts` (loadGeneratedSFX, playGameOver, playMedalReveal), `game.ts` (RunStats interface, computeMedals, run stats tracking, game over wiring), `hud.ts` (rewritten drawGameOver with animated summary card).

### Phase 4 (Scores, Polish & Tuning) — Not Started
localStorage leaderboard, debug overlay, difficulty curve tuning, performance profiling, cross-browser testing. See `TASKS.md` for full checklist.

---

## Known Technical Debt

- **WAV audio files** are large; could convert to OGG/MP3 for smaller bundle
- **Procedural music** uses setTimeout scheduling, not AudioContext scheduler — may drift slightly
- **No spatial partitioning** for collision — works fine now but could become a bottleneck at 100+ enemies with 200 bullets (16,000+ checks/frame). Add grid-based spatial hash if profiling shows issues
- **9 unwired enemy source files** exist (triangle, fibspiral, mobius, koch, penrose, mengerdust, hyperbolicdisc, tesseract, klein) — can be re-enabled by adding to `EnemyType`, `createEnemy()`, and spawn pool arrays
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
- **Enemy classes are self-contained.** Each enemy file defines its own shape, colors, AI, and rendering. Special cross-system mechanics (BlackHole attraction) are wired in `game.ts`.
- **Object pooling** for bullets and explosions. Enemies are not pooled (created/destroyed via array filter).
- **Additive blending** for trails and explosions. Normal blending for entities.
- **Mobile detection** via `'ontouchstart' in window`. Mobile gets: reduced bloom passes, smaller particle counts, shorter trails, different zoom level.
- **No external runtime dependencies.** Everything is vanilla TypeScript + WebGL + Web Audio API.
- **Commit working state.** Always verify `npm run build` succeeds before committing.
