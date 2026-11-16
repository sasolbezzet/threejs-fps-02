// Operation Vortex: Main Game Loop & Round Lifecycle Engine
// Features fixed 60 Hz simulation, deterministic screenshot captures, round economy, and combat raycasting.

import * as THREE from 'three';
import { PALETTE, TEAMS } from './palette.js';
import { createMap } from './map.js';
import { PlayerController } from './player.js';
import { BotSquad } from './bots.js';
import { BombSystem } from './bomb.js';
import { TacticalHUD } from './hud.js';
import { audio } from './audio.js';
import { WEAPON_REGISTRY, WeaponInstance } from './weapons.js';

const FIXED_STEP = 1 / 60;
const urlParams = new URLSearchParams(window.location.search);
const shotMode = urlParams.get('shot');
const seed = Number.parseInt(urlParams.get('seed') ?? '1', 10) || 1;

// Three.js Core Setup
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const gameContainer = document.getElementById('game');
if (gameContainer) gameContainer.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(PALETTE.canvas);
scene.fog = new THREE.Fog(new THREE.Color(PALETTE.canvas), 22, 65);

const camera = new THREE.PerspectiveCamera(74, window.innerWidth / window.innerHeight, 0.05, 160);

// Initialize Systems
const mapData = createMap(scene);
const player = new PlayerController(camera, scene, mapData);
const botSquad = new BotSquad(scene, mapData);
const bomb = new BombSystem(scene, mapData);
const hud = new TacticalHUD();

// Round State
const roundState = {
  currentRound: 1,
  maxRounds: 5,
  attScore: 0,
  defScore: 0,
  timeLeft: 105.0, // 1m 45s round time
  isRoundOver: false,
  roundWinner: null,
  buyPhaseActive: true,
  buyPhaseTimer: 15.0,
};

// Input Handling
const keys = {
  forward: false,
  backward: false,
  left: false,
  right: false,
  jump: false,
  crouch: false,
  sprint: false,
  plant: false,
  defuse: false,
};

let isPointerLocked = false;
let isMouseDown = false;

window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyW') keys.forward = true;
  if (e.code === 'KeyS') keys.backward = true;
  if (e.code === 'KeyA') keys.left = true;
  if (e.code === 'KeyD') keys.right = true;
  if (e.code === 'Space') keys.jump = true;
  if (e.code === 'ControlLeft' || e.code === 'KeyC') keys.crouch = true;
  if (e.code === 'ShiftLeft') keys.sprint = true;
  if (e.code === 'KeyE') {
    keys.plant = true;
    keys.defuse = true;
  }
  if (e.code === 'KeyR') {
    if (player.activeWeapon.startReload(performance.now() / 1000)) {
      audio.reload();
    }
  }
  if (e.code === 'KeyB') {
    roundState.buyPhaseActive = !roundState.buyPhaseActive;
    hud.toggleBuyMenu(roundState.buyPhaseActive);
  }
  if (e.code === 'Digit1') player.activeSlot = 'primary';
  if (e.code === 'Digit2') player.activeSlot = 'secondary';
});

window.addEventListener('keyup', (e) => {
  if (e.code === 'KeyW') keys.forward = false;
  if (e.code === 'KeyS') keys.backward = false;
  if (e.code === 'KeyA') keys.left = false;
  if (e.code === 'KeyD') keys.right = false;
  if (e.code === 'Space') keys.jump = false;
  if (e.code === 'ControlLeft' || e.code === 'KeyC') keys.crouch = false;
  if (e.code === 'ShiftLeft') keys.sprint = false;
  if (e.code === 'KeyE') {
    keys.plant = false;
    keys.defuse = false;
    bomb.cancelPlant();
    bomb.cancelDefuse();
  }
});

window.addEventListener('mousemove', (e) => {
  if (isPointerLocked) {
    player.onMouseMove(e.movementX, e.movementY);
  }
});

window.addEventListener('mousedown', (e) => {
  if (e.button === 0) {
    if (!isPointerLocked && !shotMode) {
      document.body.requestPointerLock();
    }
    isMouseDown = true;
    shootActiveWeapon();
  }
});

window.addEventListener('mouseup', (e) => {
  if (e.button === 0) isMouseDown = false;
});

document.addEventListener('pointerlockchange', () => {
  isPointerLocked = document.pointerLockElement === document.body;
  const overlay = document.getElementById('overlay');
  if (overlay) {
    if (isPointerLocked) overlay.setAttribute('hidden', '');
    else if (!shotMode) overlay.removeAttribute('hidden');
  }
});

const playBtn = document.getElementById('play');
if (playBtn) {
  playBtn.addEventListener('click', () => {
    document.body.requestPointerLock();
  });
}

// Buy Menu Actions
document.querySelectorAll('.buy-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    const item = btn.getAttribute('data-item');
    if (item === 'rifle' && player.cash >= 2700) {
      player.cash -= 2700;
      player.weapons.primary = new WeaponInstance(WEAPON_REGISTRY.rifle);
      player.activeSlot = 'primary';
    } else if (item === 'sniper' && player.cash >= 4500) {
      player.cash -= 4500;
      player.weapons.primary = new WeaponInstance(WEAPON_REGISTRY.sniper);
      player.activeSlot = 'primary';
    } else if (item === 'shotgun' && player.cash >= 1500) {
      player.cash -= 1500;
      player.weapons.primary = new WeaponInstance(WEAPON_REGISTRY.shotgun);
      player.activeSlot = 'primary';
    } else if (item === 'armor' && player.cash >= 650) {
      player.cash -= 650;
      player.armor = 100;
    }
  });
});

// Ballistic Raycasting
const raycaster = new THREE.Raycaster();

function shootActiveWeapon() {
  const now = performance.now() / 1000;
  const weapon = player.activeWeapon;
  if (!weapon.fire(now)) {
    if (weapon.ammoInMag === 0) audio.emptyClick();
    return;
  }

  // Audio & Recoil
  if (weapon.config.id === 'pistol') audio.firePistol();
  else if (weapon.config.id === 'rifle') audio.fireRifle();
  else if (weapon.config.id === 'sniper') audio.fireSniper();
  else if (weapon.config.id === 'shotgun') audio.fireShotgun();

  player.applyRecoil(weapon.config.recoilClimb);

  // Spread bloom calculation
  const isMoving = player.velocity.lengthSq() > 0.1;
  const spread = weapon.calculateSpread(isMoving, player.isCrouching);
  const spreadX = (Math.random() - 0.5) * spread;
  const spreadY = (Math.random() - 0.5) * spread;

  // Aim direction from camera center
  const aimDir = new THREE.Vector3(spreadX, spreadY, -1).normalize();
  aimDir.applyQuaternion(camera.quaternion);

  raycaster.set(camera.position, aimDir);
  const intersects = raycaster.intersectObjects(botSquad.hitMeshes, false);

  if (intersects.length > 0) {
    const hit = intersects[0];
    const hitMesh = hit.object;
    const isHeadshot = hitMesh.userData.part === 'head';
    const targetBot = hitMesh.userData.bot;

    if (targetBot && targetBot.team === TEAMS.DEFENDERS) {
      const res = botSquad.takeDamage(targetBot, weapon.config.damage, isHeadshot, 'Player');
      hud.showHitmarker(isHeadshot);

      if (res.killed) {
        player.cash += 300;
        hud.addKillfeed('Bezzet', targetBot.name, weapon.config.name, isHeadshot);
        checkRoundEndCondition();
      }
    }
  }
}

function checkRoundEndCondition() {
  if (roundState.isRoundOver) return;

  const defendersAlive = botSquad.getActiveDefendersCount();

  if (defendersAlive === 0) {
    endRound(TEAMS.ATTACKERS, 'DEFENDERS ELIMINATED');
  } else if (player.isDead) {
    endRound(TEAMS.DEFENDERS, 'ATTACKERS ELIMINATED');
  }
}

function endRound(winner, reason) {
  roundState.isRoundOver = true;
  roundState.roundWinner = winner;

  if (winner === TEAMS.ATTACKERS) {
    roundState.attScore += 1;
    player.cash += 3250;
  } else {
    roundState.defScore += 1;
    player.cash += 1400;
  }

  setTimeout(() => {
    startNewRound();
  }, 4000);
}

function startNewRound() {
  roundState.currentRound += 1;
  roundState.timeLeft = 105.0;
  roundState.isRoundOver = false;
  roundState.roundWinner = null;
  roundState.buyPhaseActive = true;
  roundState.buyPhaseTimer = 15.0;

  player.resetRound();
  botSquad.resetRound();
  bomb.reset();
}

// Bot shoot callback
function onBotShootPlayer(bot, damage) {
  player.takeDamage(damage);
  if (player.isDead) {
    hud.addKillfeed(bot.name, 'Bezzet', 'Vortex-AR', false);
    checkRoundEndCondition();
  }
}

// Window resize
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Setup Deterministic Shot Modes
if (shotMode) {
  setupDeterministicCapture(shotMode);
}

function setupDeterministicCapture(mode) {
  const overlay = document.getElementById('overlay');
  if (overlay) overlay.setAttribute('hidden', '');

  if (mode === 'title') {
    // Show tactical loadout & buy menu
    hud.toggleBuyMenu(true);
    roundState.timeLeft = 105.0;
    player.cash = 2400;
  } else if (mode === 'play') {
    // Looking down lane at Site A
    player.position.set(-18, 1.65, 8);
    player.yaw = Math.PI;
    roundState.timeLeft = 78.4;
  } else if (mode === 'combat') {
    // Mid combat encounter with critical hitmarker
    player.position.set(0, 1.65, 8);
    player.yaw = Math.PI;
    hud.showHitmarker(true);
    hud.addKillfeed('Bezzet', 'Vortex-Omega', 'Viper .50', true);
    bomb.state = 'ARMED';
    bomb.timer = 28.5;
  } else if (mode === 'victory') {
    // Round won scoreboard
    roundState.attScore = 3;
    roundState.defScore = 1;
    roundState.timeLeft = 0;
  }
}

// 60 Hz Fixed Simulation Loop
let lastTime = performance.now();
let accumulator = 0;

function tick(nowMs) {
  const now = nowMs / 1000;
  const delta = Math.min((nowMs - lastTime) / 1000, 0.1);
  lastTime = nowMs;

  accumulator += delta;
  while (accumulator >= FIXED_STEP) {
    if (!roundState.isRoundOver) {
      roundState.timeLeft = Math.max(0, roundState.timeLeft - FIXED_STEP);
      if (roundState.timeLeft <= 0 && bomb.state !== 'ARMED') {
        endRound(TEAMS.DEFENDERS, 'TIME EXPIRED');
      }

      // Bomb objective updates
      if (keys.plant && bomb.state === 'UNPLANTED') {
        const site = bomb.checkPlantZone(player.position);
        if (site) {
          bomb.startPlant(site, player.position);
        }
      }
      if (bomb.state === 'PLANTING') {
        if (bomb.updatePlant(FIXED_STEP)) {
          hud.addKillfeed('Bezzet', 'Site ' + bomb.plantedSite, 'EMP Core Planted', false);
        }
      }
      if (bomb.state === 'ARMED' || bomb.state === 'DEFUSING') {
        const bombResult = bomb.updateArmed(FIXED_STEP, now);
        if (bombResult === 'DETONATED') {
          endRound(TEAMS.ATTACKERS, 'TARGET FACILITY DESTROYED');
        }
      }

      // Continuous automatic fire
      if (isMouseDown && player.activeWeapon.config.automatic) {
        shootActiveWeapon();
      }

      player.activeWeapon.updateReload(now);
      player.update(FIXED_STEP, keys);
      botSquad.update(FIXED_STEP, now, player.position, onBotShootPlayer);
    }
    accumulator -= FIXED_STEP;
  }

  hud.update(player, bomb, botSquad, roundState);
  renderer.render(scene, camera);

  if (shotMode) {
    // Notify make.fun capture harness that deterministic frame is ready
    window.__shotReady = true;
  } else {
    requestAnimationFrame(tick);
  }
}

requestAnimationFrame(tick);
