# Development History & Completed Phases

> Archival record of all completed work. Referenced from CLAUDE.md.

---

## Phase 1 (MVP) — Complete
Project scaffolding, WebGL renderer, player, bullets, original enemies (rhombus, pinwheel, square, circle, triangle), collision detection, wave spawner, explosions, scrolling world with camera, game states, HUD, CI/CD.

## Phase 2 (Visual Polish) — Complete
Bloom post-processing, reactive background grid with displacement, particle trails, entity rendering polish (double-line, fusion circles), off-screen indicators, styled UI, crosshair.

## Phase 3 (Mobile & Audio) — Complete
Twin-stick virtual joysticks, responsive canvas, mobile performance optimizations (half-res bloom, reduced particles/trails), all 11 SFX via Web Audio API, procedural 4-layer adaptive music, audio controls with M key mute, Safari audio handling.

## New Enemies Expansion — Complete (then pruned)
10 new enemy source files created (Sierpinski, Mobius, Koch, Penrose, MengerDust, HyperbolicDisc, FibSpiral, Tesseract, Mandelbrot, Klein) plus 2 child types (Shard, MiniMandel). Complete spawn system overhaul with event-based scheduler, 7 formation types, cadence system, and 5-phase difficulty curve. Subsequently, 9 gimmick enemies were unwired from the spawn system to focus on Geometry Wars-style swarm + gravity well gameplay. Only Sierpinski (+Shard child) remains active from this expansion. Octagon and DeathStar were deleted entirely.

## Post-expansion Polish — Complete
- Mobile viewport fixes: edge-to-edge zoom, camera follow, iOS PWA safe area, 100dvh
- Settings panel for difficulty tuning (spawn rate, lives, speed, fire rate, phase skip)
- Spawn animation rework (theatrical grow-in, staggered child spawns)
- Player ship redesign as Geometry Wars-style claw/pincer
- Player-to-cursor aiming: aim angle = atan2(cursorWorld - playerWorld)
- BlackHole overhaul: stationary, player gravitational pull, shrink-per-bullet, overload explosion, gravitational lensing, electric blue-white plasma visuals, procedural death SFX
- Octagon & DeathStar removal (redundant with BlackHole)
- Spring-mass grid rewrite, smaller arena (1600x1000), auto-fit zoom
- Death slowmo mechanic reused for game over transition
- BlackHole gravity fix: grid bending, enemy pull, player pull all retuned. Grid physics now runtime-tunable via settings panel sliders.
- Desktop settings panel: Right-side sidebar with semi-transparent background, scrollable full-height, hidden during gameplay. `settings-panel.ts` supports multiple mount points with cross-instance sync.
- Spawn rework: Triangle unwired, Circle removed from pools (only from BlackHole overload). BlackHole spawns anywhere. `spawnAnywhere()` on Enemy base class.
- Vulnerable during spawn setting: boolean toggle, checked in `collision.ts`.
- Crosshair cursor: Desktop = mouse world position (4 chevrons), Touch = near player at aim direction. `CROSSHAIR_*` constants.
- GPU Stress settings: 9 sliders for arena size, grid resolution, bloom quality, resolution scale. Grid `rebuild()` + 32-bit indices via `OES_element_index_uint`.
- BlackHole enhancement: Hard cap 4, HP 4→8, increased gravity defaults.
- Spacetime fabric grid: Gravity well uniforms (up to 8), perspective contraction, depth coloring, `a_anchored` attribute for edge fix, 5 floats/vertex.
- Auto-fire toggle (`F` key), cursor visibility management.

## ROADMAP Phase 1 — Readability + Impact Foundation — Complete
See `.claude/skills/combat-feedback/SKILL.md` for full details on hitstop, kill signatures, phase transitions, and spawn telegraphs.

## ROADMAP Phase 2 — Elite Layer — Complete
See `.claude/skills/enemy-reference/SKILL.md` for full elite system details.

## ROADMAP Phase 3 — Heat System + Recovery Window — Complete
See `.claude/skills/combat-feedback/SKILL.md` for full heat system and recovery window details.

## ROADMAP Phase 4 — One Signature Miniboss — Complete
See `.claude/skills/enemy-reference/SKILL.md` for full Mandelbrot miniboss details.

## ROADMAP Phase 6 — Audio Success Language + End-of-Run Story — Complete
See `.claude/skills/combat-feedback/SKILL.md` for medals, game over summary card, and run stats details.

## BlackHole Design Lab — Visual Sandbox — Complete
See `.claude/skills/enemy-reference/SKILL.md` for design lab details.

## Phase 4 (Scores, Polish & Tuning) — Not Started
localStorage leaderboard, debug overlay, difficulty curve tuning, performance profiling, cross-browser testing. See `TASKS.md` for full checklist.
