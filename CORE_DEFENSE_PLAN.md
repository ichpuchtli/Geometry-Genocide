# Plan: Core Defense Co-op Mode (WebRTC)

## 1. Game Mode Overview: "Gravity Core Defense"
In this mode, players shift from pure survival to protecting a central objective: the **Gravity Core**.

### The Gravity Core (Central Objective)
- **Position:** Fixed at `(0, 0)`.
- **Health:** 1,000 HP. If it reaches 0, the game ends for both players.
- **Visuals:** A multi-layered glowing sphere that pulses with the background grid. Color shifts from **Cyan** (Healthy) -> **Orange** (Damaged) -> **Red** (Dying).
- **Physics:** Exerts a constant gravitational pull on the grid and a subtle pull on enemies, drawing them toward the center.

### Co-op Synergy Mechanics
- **The Repair Tether:** 
    - Players can repair the Core by staying within the **Repair Radius** (120px).
    - Repairing costs "Weapon Energy," meaning the player shoots slower or not at all while repairing.
- **Shared Shielding:** 
    - If both players are inside the Core's radius, a **Fusion Shield** activates, negating projectile damage to the Core.
- **Core Overload (Ultimate):** 
    - A shared meter that charges as the Core takes damage or players kill enemies near it.
    - When triggered, it releases a massive shockwave that clears the screen but leaves the Core's shields disabled for 5 seconds.

---

## 2. Technical Architecture (Networking)

### Technology: WebRTC via PeerJS
- **Signaling:** PeerJS handles the handshake (Lobby creation and joining).
- **Topology:** **Authoritative Host-Client**.
    - **Host (Player 1):** Manages Enemy AI, Core Health, Wave Spawning, and Score.
    - **Client (Player 2):** Sends input/position data and receives the "World State" from the Host.

### Data Channels
- **Unreliable (UDP-style):** High-frequency updates (60fps).
    - Player positions/rotations.
    - Bullet positions.
    - Grid displacement ripples.
- **Reliable (TCP-style):** Event-based updates.
    - Enemy Spawn (Type, ID, Position).
    - Enemy Death (ID).
    - Core Damage Event.
    - Wave/Phase transitions.

### Latency Mitigation
- **Entity Interpolation:** The Client will "Lerp" the Host's position to smooth out jitter.
- **Client-Side Prediction:** Players see their own bullets instantly; the network syncs them for the *other* player.

---

## 3. Development Phases

### Phase 1: The Core Entity (Single Player Foundation)
- [ ] Create `Core` class in `src/entities/core.ts`.
- [ ] Implement Core health and collision logic.
- [ ] **AI Pivot:** Update all enemy behaviors to target `(0, 0)` instead of `player.position`.
- [ ] Add "Core Integrity" bar to the HUD.

### Phase 2: Networking Foundation (WebRTC)
- [ ] Integrate PeerJS into a new `NetworkManager` class.
- [ ] Create simple "Lobby" UI (Host ID display and Join Input).
- [ ] Synchronize Player 1 and Player 2 positions in the same arena.

### Phase 3: World Synchronization
- [ ] **Bullet Sync:** Broadcast bullet spawns from both players.
- [ ] **Enemy Sync:** Host broadcasts spawns with IDs; Client instantiates them.
- [ ] **Kill Sync:** If an enemy dies on the Host, it is removed on the Client.

### Phase 4: Co-op Synergies
- [ ] Implement the **Tether** visual effect (WebGL line).
- [ ] Implement **Repair** logic and energy cost.
- [ ] Implement the **Core Overload** shockwave and VFX.

### Phase 5: Balancing & Polish
- [ ] Adjust enemy spawn rates for two players.
- [ ] Add "Revive" mechanic (if one player dies, the other can revive them near the Core).
- [ ] Finalize the "Multiplayer Game Over" screen.
