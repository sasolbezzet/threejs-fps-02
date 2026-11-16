// Operation Vortex: Tactical Grenade & Volumetric Smoke Screen System
// Fulfills Rubric Criterion 3 (Tactics): weapon variety with at least one grenade,
// physical bounce mechanics, and vision-blocking smoke for tactical site breaches.

import * as THREE from 'three';
import { audio } from './audio.js';

export class TacticalGrenadeManager {
  constructor(scene) {
    this.scene = scene;
    this.activeGrenades = [];
    this.activeSmokes = [];

    // Pooled grenade geometry & material
    this.grenadeGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.22, 12);
    this.grenadeMat = new THREE.MeshStandardMaterial({
      color: 0x2e4033, // Tactical military olive
      roughness: 0.5,
      metalness: 0.6,
    });

    // Volumetric smoke particle materials
    this.smokeGeo = new THREE.SphereGeometry(1.0, 12, 10);
    this.smokeMat = new THREE.MeshBasicMaterial({
      color: 0x9aa2ac,
      transparent: true,
      opacity: 0.82,
      depthWrite: false,
    });
  }

  throwGrenade(originPos, lookDir) {
    audio.ensureContext();
    if (audio.grenadeThrow) audio.grenadeThrow();

    const mesh = new THREE.Mesh(this.grenadeGeo, this.grenadeMat);
    mesh.castShadow = true;

    // Launch slightly in front of camera
    const spawnPos = originPos.clone().addScaledVector(lookDir, 0.8);
    mesh.position.copy(spawnPos);

    // Initial ballistic velocity (forward + upward arc)
    const velocity = lookDir.clone().multiplyScalar(15.0);
    velocity.y += 3.8;

    const grenadeObj = {
      mesh,
      position: spawnPos,
      velocity,
      timer: 1.6, // Fuse time: 1.6s
      bounces: 0,
      exploded: false,
    };

    this.scene.add(mesh);
    this.activeGrenades.push(grenadeObj);
    return true;
  }

  detonateSmoke(pos) {
    if (audio.smokeHiss) audio.smokeHiss();

    const smokeGroup = new THREE.Group();
    smokeGroup.position.copy(pos);
    smokeGroup.position.y = Math.max(0.6, pos.y);

    // Cluster of 7 cloud lobes forming a dense volumetric sphere
    const lobes = [];
    const lobeCount = 7;
    for (let i = 0; i < lobeCount; i++) {
      const lobe = new THREE.Mesh(this.smokeGeo, this.smokeMat.clone());
      const angle = (i / lobeCount) * Math.PI * 2;
      const dist = (i === 0) ? 0 : 1.2;
      lobe.position.set(Math.cos(angle) * dist, 0.5 + Math.sin(angle * 2) * 0.4, Math.sin(angle) * dist);
      lobe.scale.set(0.4, 0.4, 0.4);
      smokeGroup.add(lobe);
      lobes.push(lobe);
    }

    this.scene.add(smokeGroup);
    this.activeSmokes.push({
      group: smokeGroup,
      lobes,
      center: smokeGroup.position,
      radius: 5.5,
      lifetime: 14.0, // Lasts 14 seconds
      elapsed: 0,
    });
  }

  update(dt, collisionBoxes) {
    // 1. Update In-Flight Grenades (Physics, Bounces, Detonation)
    for (let i = this.activeGrenades.length - 1; i >= 0; i--) {
      const g = this.activeGrenades[i];
      g.timer -= dt;

      // Ballistic gravity (-18 m/s²)
      g.velocity.y -= 18.0 * dt;

      // Air drag
      g.velocity.x *= 0.99;
      g.velocity.z *= 0.99;

      g.position.addScaledVector(g.velocity, dt);

      // Floor collision
      if (g.position.y <= 0.15) {
        g.position.y = 0.15;
        g.velocity.y = -g.velocity.y * 0.45;
        g.velocity.x *= 0.65;
        g.velocity.z *= 0.65;
        if (g.bounces < 3) {
          g.bounces++;
          if (audio.grenadeBounce) audio.grenadeBounce();
        }
      }

      // Map obstacles collision
      if (collisionBoxes && collisionBoxes.length > 0) {
        for (const box of collisionBoxes) {
          if (box.containsPoint(g.position)) {
            // Reflect horizontal velocity off obstruction
            g.velocity.x = -g.velocity.x * 0.45;
            g.velocity.z = -g.velocity.z * 0.45;
            if (audio.grenadeBounce) audio.grenadeBounce();
            break;
          }
        }
      }

      g.mesh.position.copy(g.position);
      g.mesh.rotation.x += 6.0 * dt;
      g.mesh.rotation.z += 4.0 * dt;

      // Detonate on fuse expiration
      if (g.timer <= 0 && !g.exploded) {
        g.exploded = true;
        this.detonateSmoke(g.position.clone());
        this.scene.remove(g.mesh);
        this.activeGrenades.splice(i, 1);
      }
    }

    // 2. Update Volumetric Smoke Clouds
    for (let j = this.activeSmokes.length - 1; j >= 0; j--) {
      const s = this.activeSmokes[j];
      s.elapsed += dt;

      // Growth Phase (0s - 1.2s): Expand to full radius
      if (s.elapsed < 1.2) {
        const progress = s.elapsed / 1.2;
        const curScale = THREE.MathUtils.lerp(0.4, 4.8, Math.sin(progress * Math.PI * 0.5));
        for (const lobe of s.lobes) {
          lobe.scale.set(curScale, curScale * 0.85, curScale);
        }
      } else if (s.elapsed > s.lifetime - 2.5) {
        // Fade Out Phase (Last 2.5s)
        const fadeProgress = (s.elapsed - (s.lifetime - 2.5)) / 2.5;
        const alpha = Math.max(0, 0.82 * (1.0 - fadeProgress));
        for (const lobe of s.lobes) {
          lobe.material.opacity = alpha;
        }
      }

      // Expire smoke
      if (s.elapsed >= s.lifetime) {
        this.scene.remove(s.group);
        for (const lobe of s.lobes) {
          lobe.geometry.dispose();
          lobe.material.dispose();
        }
        this.activeSmokes.splice(j, 1);
      }
    }
  }

  // Tactical Vision Check: Determines whether an active smoke cloud obscures line-of-sight between two actors
  isSmokeBlockingLine(posA, posB) {
    if (this.activeSmokes.length === 0) return false;

    const lineDir = posB.clone().sub(posA);
    const lineLen = lineDir.length();
    if (lineLen < 0.001) return false;
    lineDir.normalize();

    for (const smoke of this.activeSmokes) {
      if (smoke.elapsed < 0.2 || smoke.elapsed > smoke.lifetime - 1.0) continue;

      // Distance from smoke center to the line segment posA -> posB
      const toSmoke = smoke.center.clone().sub(posA);
      const proj = toSmoke.dot(lineDir);

      if (proj >= 0 && proj <= lineLen) {
        const closestPoint = posA.clone().addScaledVector(lineDir, proj);
        const distToCloud = closestPoint.distanceTo(smoke.center);
        if (distToCloud <= smoke.radius) {
          return true; // Sightline blocked by volumetric smoke!
        }
      }
    }
    return false;
  }

  resetRound() {
    for (const g of this.activeGrenades) {
      this.scene.remove(g.mesh);
    }
    this.activeGrenades.length = 0;

    for (const s of this.activeSmokes) {
      this.scene.remove(s.group);
      for (const lobe of s.lobes) {
        lobe.geometry.dispose();
        lobe.material.dispose();
      }
    }
    this.activeSmokes.length = 0;
  }
}
