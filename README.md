# GHOST RIDERS: HIGHWAY BRAWL

A 3D retro arcade brawler-racing prototype inspired by the 16-bit gameplay feel of classic combat racers like *Road Rash*. Drive down a long winding highway, battle rival AI bikers, avoid civilian traffic, dodge construction zones, and speed toward the finish line!

Built using **React (v19)**, **TypeScript**, **Vite**, and raw **Three.js** to guarantee optimal performance, custom spline physics stability, and zero React reconciliation overhead during high-frequency game ticks.

---

## 🕹️ Controls

| Key | Action |
|---|---|
| **W** / **Up Arrow** | Accelerate |
| **S** / **Down Arrow** | Brake / Decelerate |
| **A** / **D** / **Left** / **Right** | Steer Left & Right |
| **SPACEBAR** | Melee Attack (Swings punch left/right depending on target side) |
| **LEFT SHIFT** | Nitro Boost (Uses boost meter, increases max speed, shakes camera) |
| **P** / **Escape** | Pause Level |
| **R** | Restart Level |

---

## 🏎️ Features & Implementation Details

1. **Custom Spline Road Movement**:
   - The winding 3D highway is mathematically defined by a Catmull-Rom spline.
   - Bikes and cars travel on a 2D coordinate space of `(distance, offset)`, keeping entities strictly aligned with curves, hills, and dips.
   - Turning steer inputs lean the motorcycle chassis (rolling rotation.z) and apply camera roll.

2. **Web Audio API Synthesizer**:
   - Synthesizes 100% custom 16-bit arcade audio. No external assets required!
   - Continuous engine hum is pitch-modulated based on speed.
   - Combines pitch sweeps, bandpass filters, and noise envelopes for swings, impacts, explosion-like crashes, rocket booster sirens, and custom arpeggios for victory and game-over screens.

3. **Active AI Opponents**:
   - Spawns 5 rival bikers ("Viper", "Road Dog", "Skull", "Outlaw", and "Bane") with distinct speeds, colors, and behavior.
   - Enemies race normally, stalk the player when close, and swing punches when they align beside the player.
   - Rival bikers tumble, spin, and crash off the road when their health reaches zero.

4. **Civilians & Hazard Obstacles**:
   - Boxy 90s-styled civilian sedans and cargo trucks cruise slowly in lanes, causing massive speed penalties and crash screen-shakes on impact.
   - Roadside warning cones and yellow barrels can be struck, flying away in parabolic paths with simulated 3D physics.
   - Large boulders block lanes in winding segments.

5. **Visual Styling**:
   - Low-poly primitive models (exhaust pipes, spinning tires, helmeted riders).
   - Dusty orange sunset haze, dark asphalt, long shadows, and custom vertex-colored rumble strips.
   - CRT overlay effect mimicking cathode-ray monitors.
   - Glitched neon typography and animated metallic menus.

---

## 🛠️ Setup Instructions

To run the game locally:

1. Open your terminal in the `ghost-riders` directory.
2. Install the dependencies:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```
4. Click the local server link in the terminal (usually `http://localhost:5173`) to launch it in your browser.
