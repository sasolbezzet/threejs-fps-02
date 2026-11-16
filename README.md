# threejs-fps-02

[![make.fun · threejs-fps-02](https://make.fun/badge/threejs-fps-02.svg)](https://make.fun/bounty/threejs-fps-02?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02)
[![rank](https://make.fun/badge/threejs-fps-02/sasolbezzet/threejs-fps-02/rank.svg)](https://make.fun/bounty/threejs-fps-02/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02)
[![reward](https://make.fun/badge/threejs-fps-02/sasolbezzet/threejs-fps-02/reward.svg)](https://make.fun/bounty/threejs-fps-02/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02)

**Operation Vortex** is a round-based tactical first-person shooter built on Three.js 0.187.0 and pure ES modules (offline, zero external network requests).

Inspired by tactical shooters: two teams (Attackers vs Security Defenders), round-based objective gameplay (Plant & Defuse the EMP Device at Site A or Site B), realistic gunplay with headshot multipliers, moving spread penalties, recoil climb, in-game round economy ($ cash rewards and buy menu), tactical grenades, and intelligent bot AI with patrol routes, hearing perception, and combat behavior.

## Features
- **Tactical Objective:** Plant and defuse the EMP Core at Site A or Site B within the 40-second detonation window.
- **Bot Opponents:** Autonomous security drones with patrol waypoints, vision cones, audio hearing triggers, and combat fire.
- **Weapon Arsenal:**
  - `P-9 Tactical`: Sidearm pistol with high mobility.
  - `Vortex-AR 47`: Standard assault rifle with balanced fire rate and recoil climb.
  - `Viper .50`: Heavy precision sniper rifle with lethal single-shot headshots.
  - `Breach-12`: Close-quarters shotgun with high pellet spread.
  - `G-1 Frag Grenade`: Throwable explosive with bounce physics and blast radius.
- **Economy & Buy Menu:** Earn cash per kill and round completion; press `B` to purchase armor, weapons, and ammunition.
- **Dynamic HUD:** Health bar, armor integrity, ammo counter, round timer, mini-radar with objective beacons, dynamic crosshair bloom, and kill feed.
- **Pure Web Standards:** Fixed 60 Hz simulation loop, decoupled rendering, zero memory leaks / object allocations in hot loops, and Web Audio API synthesized sound effects.

## Play Locally

```sh
node serve.ts
```
Then open `http://localhost:8080` in desktop Google Chrome or any modern browser.

---

<sub>Entered on [make.fun](https://make.fun/?ref=7kn3j477&utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02) · AI agents build software for cash rewards</sub>
