• The enemy pool in active play is narrower than the file tree suggests, and progression is almost entirely score-to-fire-rate/

• Explored
  anticipation or payoff. I’m running a quick build/check next so I can separate design gaps from unfinished implementation.

• Ran npm run build
  └
    > geometry-genocide-web@1.0.0 build
    … +8 lines

  - The game already has solid moment-to-moment spectacle: bloom, trails, grid distortion, camera shake, adaptive music
    intensity, haptics, and dramatic death slow-mo.
  - The main weakness is meta-reward density. Progression is mostly just score thresholds for weapon fire rate and spread, so
    long runs risk feeling samey even when the screen gets busier.
  - The spawn system has good cadence tools, but the playable roster in current wave pools is mainly rhombus, pinwheel, square,
    sierpinski, and blackhole. Many enemy files exist but do not appear in active phase pools, so variety may be under-realized.
  - Feedback is strongest on death and large explosions, weaker on positive mastery moments like streaks, close calls, weapon
    upgrades, phase transitions, and elite enemy kills.
  - The HUD tells you score/lives/FPS, but not “why this run is getting more exciting” or “what power spike is coming next,” so
    progression is less legible than it should be.

  Your answers to the next few choices will materially change the recommendations.

• Questions 3/3 answered
  • Which direction should the recommendations prioritize?
    answer: Arcade purity (Recommended)
  • Which play context matters most for these recommendations?
    answer: Equal desktop/mobile
  • What size of change do you want me to aim for?
    answer: Bold redesigns

• Those answers narrow it well: keep the identity arcade-first, preserve parity across desktop/mobile, but don’t avoid larger
  structural changes. One more choice will help me rank the ideas correctly, because the current game has several weak spots and
  they lead to very different recommendations.

• Questions 1/1 answered
  • What currently feels most lacking when you play it?
    answer: Juice and feedback

• Current Read
  The game already delivers a strong base fantasy: neon arena, readable geometry silhouettes, bloom, trails, grid warping,
  adaptive music intensity, haptics, and excellent death slow-mo. The build is healthy and the current loop is stable.

  The main design issues are:

  - Progression is too hidden and too sparse. The run mostly changes via score-based fire-rate/spread thresholds in config.ts,
    but the player is not strongly told when a power spike is coming or why the run now feels different.
  - Positive feedback is weaker than danger feedback. Deaths, black hole events, and explosions have spectacle in game.ts, but
    normal kills, streaks, near-misses, phase changes, and weapon upgrades are comparatively quiet.
  - Enemy variety is under-realized. Many enemy files exist, but active wave pools in spawn-patterns.ts use a much smaller
    subset, so long runs likely feel more homogeneous than the codebase suggests.
  - The HUD in hud.ts reports state, not excitement. It does not forecast the next upgrade, celebrate streaks, or frame phase
    transitions.
  - Audio appears functional, but the SFX taxonomy is limited in audio.ts. There is no obvious layered sound language for combo,
    pickup, close-call, upgrade, elite kill, or wave climax moments.

  Given your answers, I’d optimize for arcade purity with stronger juice/feedback, while still allowing larger redesigns that
  work on both desktop and mobile.

  Best Ideas

  1. Add a visible kill-chain multiplier.
     A short decay timer on kills would create immediate tension and reward precision without changing the core controls. Show
     x2, x3, etc. near the player and in HUD, with rising pitch and stronger glow as the chain grows.
  2. Turn score thresholds into announced “weapon evolutions.”
     Right now upgrades are mostly invisible rule changes. Add a progress meter to the next weapon tier, a brief freeze-frame
     flash on unlock, a named banner like TWIN SHOT, and a distinct sound sting.
  3. Add temporary dropped powerups instead of only passive score upgrades.
     Keep them clean and arcade-friendly: Pierce, Spread Burst, Rapid Fire, Shield, Magnet, Nova. Timed pickups create route
     choices and short power fantasies without becoming a roguelite inventory system.
  4. Add a bomb/smart-burst meter earned through risky play.
     Not a consumable spam tool. Charge it through chain kills, near-misses, or destroying elite enemies. This gives the player
     an “oh shit / big moment” button and creates more clutch stories.
  5. Introduce elite variants of existing enemies before adding more totally new types.
     Examples: glowing fast rhombus, armored square, unstable pinwheel, gravity-fed black hole. Elites are cheap variety and
     give you better payoff moments because they can drop powerups, boost combo, or trigger special FX.
  6. Make phase transitions theatrical.
     When the wave manager changes phase, announce it with arena-wide color shifts, music layer changes, border pulse, and a
     one-line warning like SWARM PATTERNS ESCALATING. The pacing system already exists; it just needs staging.
  7. Reward danger proximity with near-miss energy.
     If bullets or enemies graze the player, feed a small meter that boosts score multiplier or special charge. This preserves
     arcade purity and makes high-skill movement feel intentionally rewarded.
  8. Add miniboss encounters on a timer or score gate.
     Not full boss fights that break the pace. Use a single oversized elite geometry with one signature pattern and a dramatic
     entrance. This gives runs memorable chapters and punctuates survival pacing.
  9. Create more distinct kill signatures per enemy family.
     Rhombus kills should feel sharp and crystalline. Squares should fragment. Pinwheels should spark and tumble. Black holes
     already have special treatment; the rest need more identity in VFX, SFX, and hitstop.
  10. Add hitstop and impact accent on stronger kills.
     A tiny sub-100ms pause on elite kills, weapon upgrades, bomb detonation, and black hole overload would massively improve
     perceived punch. Use sparingly so it remains special.
  11. Improve spawn readability with stronger telegraph language.
     Current spawns are functional, but ambush/surround/pincer events should be easier to parse instantly. Use formation-
     specific spawn glyphs, warning arcs on the arena border, and distinct audio motifs per formation type.
  12. Add a “heat” system that visually escalates the arena as you perform well.
     Not gameplay complexity, just spectacle and readability. Higher chain or longer survival could intensify grid turbulence,
     border brightness, starfield speed, and music density so the run feels like it is climbing somewhere.
  13. Give the HUD one forward-looking goal at all times.
     Examples: NEXT EVOLUTION IN 2,300, CHAIN ABOUT TO DROP, BOMB READY, ELITE WAVE INCOMING. Arcade games feel better when the
     player always knows what exciting event is one step away.
  14. Add short-lived recovery power after losing a life.
     You already have dramatic respawn slow-mo. Follow it with a 3-5 second revenge window: stronger fire, shield pulse, or
     score boost. That turns death from pure setback into a comeback moment.
  15. Use the unused enemy roster selectively, with curation.
     Do not dump everything into the pool. Add 2-3 of the most readable, mechanically distinct enemy types and tie each to a
     specific phase purpose. More content only helps if it creates new decisions, not noise.
  16. Add “destructible set-piece” events instead of just more enemies.
     Examples: roaming energy crystals, temporary generators, or unstable anomalies that alter bullets/enemies until destroyed.
     These create objectives without breaking the survival shooter identity.
  17. Layer your audio language around player success, not just threat.
     You need dedicated sounds for chain growth, chain break, pickup acquisition, pickup expiration, upgrade unlock, phase
     change, elite arrival, elite kill, bomb ready, and near-miss. Right now the soundscape likely under-celebrates mastery.
  18. Add end-of-run medals and stat callouts that highlight playstyle.
     Not meta progression, just reflection: Highest Chain, Most Dangerous 10 Seconds, Black Holes Neutralized, Near-Misses,
     Bombs Used. This makes runs feel more authored and encourages replay goals.

  Highest-Impact Shortlist
  If you want the strongest gains without diluting the game, I’d prioritize these first:

  3. Temporary dropped powerups
  4. Theatrical phase transition presentation
  5. Stronger enemy-specific kill signatures
  6. Forward-looking HUD goals
  7. Distinct success-oriented SFX pass

  What I’d Avoid

  - Permanent progression trees that weaken arcade identity
  - Too many simultaneous powerup types
  - Adding all dormant enemy classes at once
  - Excess screen shake/hitstop on every kill
  - Mobile-hostile clutter that hurts readability

  Concrete Design Direction
  If this were my game, I’d define the target loop as:

  - Survive cleanly
  - Build chain
  - Hit visible milestone
  - Evolve weapon
  - Trigger short power fantasy
  - Survive escalating spectacle
  - Chase one more chapter / one more chain

  That preserves the Geometry Wars feel while making the run more expressive, more legible, and more exciting.

  If useful, I can turn this into either:

  1. a prioritized implementation roadmap for this codebase, or
  2. a tighter list of 10 recommendations only, ranked by effort vs impact.