// Operation Vortex: Autonomous Tactical Bot AI & Hitbox System
// Features multi-part hitboxes (head/torso), waypoint navigation, hearing, and combat state machine.

import * as THREE from 'three';
import { PALETTE, TEAMS } from './palette.js';
import { audio } from './audio.js';

export class BotSquad {
  constructor(scene, mapData) {
    this.scene = scene;
    this.mapData = mapData;
    this.bots = [];
    this.hitMeshes = [];

    // Shared geometry and materials
    this.headGeo = new THREE.SphereGeometry(0.18, 14, 10);
    this.torsoGeo = new THREE.BoxGeometry(0.55, 0.75, 0.3);
    this.limbGeo = new THREE.BoxGeometry(0.16, 0.7, 0.16);

    this.defMat = new THREE.MeshStandardMaterial({ color: 0x2d333b, roughness: 0.6, metalness: 0.4 });
    this.attMat = new THREE.MeshStandardMaterial({ color: 0x38404a, roughness: 0.6, metalness: 0.4 });
    this.defVisorMat = new THREE.MeshBasicMaterial({ color: PALETTE.crimson }); // Red enemy glow
    this.attVisorMat = new THREE.MeshBasicMaterial({ color: PALETTE.cyan });    // Blue friendly glow

    this.initBots();
  }

  initBots() {
    // 3 Defenders guarding Site A, Site B, and Mid
    this.spawnBot('Vortex-Echo', TEAMS.DEFENDERS, new THREE.Vector3(-18, 0, -10), 'site_a');
    this.spawnBot('Vortex-Kilo', TEAMS.DEFENDERS, new THREE.Vector3(18, 0, -10), 'site_b');
    this.spawnBot('Vortex-Omega', TEAMS.DEFENDERS, new THREE.Vector3(0, 0, -12), 'mid_north');

    // 1 Attacker Bot squadmate
    this.spawnBot('Ghost-1', TEAMS.ATTACKERS, new THREE.Vector3(-4, 0, 22), 'lane_a_south');
  }

  spawnBot(name, team, pos, startWaypoint) {
    const group = new THREE.Group();
    group.position.copy(pos);

    const bodyMat = team === TEAMS.DEFENDERS ? this.defMat : this.attMat;
    const visorMat = team === TEAMS.DEFENDERS ? this.defVisorMat : this.attVisorMat;

    // Torso (Main hitbox)
    const torso = new THREE.Mesh(this.torsoGeo, bodyMat);
    torso.position.y = 1.0;
    torso.castShadow = true;
    torso.userData.part = 'torso';

    // Head (Critical hitbox)
    const head = new THREE.Mesh(this.headGeo, bodyMat);
    head.position.y = 1.62;
    head.castShadow = true;
    head.userData.part = 'head';

    // Visor glowing strip
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.08, 0.12), visorMat);
    visor.position.set(0, 1.62, 0.14);

    // Legs
    const legL = new THREE.Mesh(this.limbGeo, bodyMat);
    legL.position.set(-0.16, 0.35, 0);
    const legR = new THREE.Mesh(this.limbGeo, bodyMat);
    legR.position.set(0.16, 0.35, 0);

    // Weapon representation
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.6), bodyMat);
    gun.position.set(0.25, 1.15, 0.3);

    group.add(torso, head, visor, legL, legR, gun);
    this.scene.add(group);

    const botObj = {
      name,
      team,
      group,
      headMesh: head,
      torsoMesh: torso,
      health: 100,
      armor: 50,
      isDead: false,
      state: 'PATROL',
      currentWaypoint: startWaypoint,
      targetPos: pos.clone(),
      velocity: new THREE.Vector3(),
      lookDir: new THREE.Vector3(0, 0, 1),
      lastFireTime: 0,
      reactionTimer: 0,
      patrolTimer: 0,
    };

    head.userData.bot = botObj;
    torso.userData.bot = botObj;
    this.hitMeshes.push(head, torso);
    this.bots.push(botObj);
  }

  resetRound() {
    for (const bot of this.bots) {
      bot.health = 100;
      bot.armor = 50;
      bot.isDead = false;
      bot.state = 'PATROL';
      bot.group.visible = true;
      bot.group.rotation.set(0, 0, 0);

      if (bot.name === 'Vortex-Echo') bot.group.position.set(-18, 0, -10);
      else if (bot.name === 'Vortex-Kilo') bot.group.position.set(18, 0, -10);
      else if (bot.name === 'Vortex-Omega') bot.group.position.set(0, 0, -12);
      else if (bot.name === 'Ghost-1') bot.group.position.set(-4, 0, 22);
    }
  }

  takeDamage(bot, damage, isHeadshot, attackerName) {
    if (bot.isDead) return false;

    let finalDamage = damage;
    if (isHeadshot) {
      finalDamage *= 3.5;
      audio.hitHead();
    } else {
      audio.hitBody();
      if (bot.armor > 0) {
        finalDamage *= 0.65;
        bot.armor = Math.max(0, bot.armor - damage * 0.4);
      }
    }

    bot.health -= finalDamage;
    if (bot.health <= 0) {
      bot.health = 0;
      bot.isDead = true;
      bot.state = 'DEAD';
      // Flinch & ragdoll collapse
      bot.group.rotation.x = -Math.PI / 2.2;
      bot.group.position.y = 0.2;
      return { killed: true, isHeadshot, botName: bot.name };
    }
    return { killed: false, isHeadshot, botName: bot.name };
  }

  // Tactical Hearing System: React to player gunfire, footsteps, or grenade detonations
  reactToSound(soundPos, hearingRadius = 30) {
    for (const bot of this.bots) {
      if (bot.isDead || bot.team !== TEAMS.DEFENDERS) continue;
      const dist = bot.group.position.distanceTo(soundPos);
      if (dist <= hearingRadius) {
        bot.state = 'ALERT';
        const toSound = soundPos.clone().sub(bot.group.position);
        toSound.y = 0;
        if (toSound.length() > 0.1) {
          bot.targetPos.copy(soundPos);
          bot.lookDir.copy(toSound.normalize());
          bot.group.rotation.y = Math.atan2(bot.lookDir.x, bot.lookDir.z);
        }
      }
    }
  }

  update(dt, now, playerPos, onBotShoot, grenadeManager = null) {
    for (const bot of this.bots) {
      if (bot.isDead) continue;

      const distToPlayer = bot.group.position.distanceTo(playerPos);
      const toPlayer = playerPos.clone().sub(bot.group.position);
      toPlayer.y = 0;

      // Vision Raycast & Tactical Smoke Occlusion Check: can bot see player?
      const withinRangeAndFov = bot.team === TEAMS.DEFENDERS && distToPlayer < 40 && toPlayer.angleTo(bot.lookDir) < Math.PI / 2.5;
      const smokeObscured = (grenadeManager && withinRangeAndFov) ? grenadeManager.isSmokeBlockingLine(bot.group.position, playerPos) : false;
      const canSeePlayer = withinRangeAndFov && !smokeObscured;

      if (canSeePlayer) {
        bot.state = 'COMBAT';
        bot.lookDir.copy(toPlayer.normalize());
        bot.group.rotation.y = Math.atan2(bot.lookDir.x, bot.lookDir.z);

        // Combat fire behavior (burst cadence)
        if (now - bot.lastFireTime >= 0.35) {
          bot.lastFireTime = now;
          // Simulated spread accuracy based on distance
          const hitChance = Math.max(0.2, 0.75 - distToPlayer * 0.015);
          if (Math.random() < hitChance && onBotShoot) {
            onBotShoot(bot, 18);
          }
        }
      } else {
        // Patrol Waypoints
        bot.patrolTimer += dt;
        if (bot.patrolTimer > 4.0) {
          bot.patrolTimer = 0;
          // Pick adjacent waypoint
          const currentWp = this.mapData.waypoints.find(w => w.id === bot.currentWaypoint);
          if (currentWp && currentWp.neighbors.length > 0) {
            const nextId = currentWp.neighbors[Math.floor(Math.random() * currentWp.neighbors.length)];
            bot.currentWaypoint = nextId;
            const nextWp = this.mapData.waypoints.find(w => w.id === nextId);
            if (nextWp) {
              bot.targetPos.copy(nextWp.pos);
            }
          }
        }

        // Move towards target waypoint
        const toTarget = bot.targetPos.clone().sub(bot.group.position);
        toTarget.y = 0;
        if (toTarget.length() > 0.8) {
          toTarget.normalize();
          bot.group.position.addScaledVector(toTarget, 2.5 * dt);
          bot.lookDir.lerp(toTarget, 0.1);
          bot.group.rotation.y = Math.atan2(bot.lookDir.x, bot.lookDir.z);
        }
      }
    }
  }

  getActiveDefendersCount() {
    return this.bots.filter(b => b.team === TEAMS.DEFENDERS && !b.isDead).length;
  }
}
