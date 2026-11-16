// Operation Vortex: Tactical EMP Bomb Objective Engine
// Handles bomb planting, detonation countdown, defusal, and 3D visual beacon.

import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { audio } from './audio.js';

export const BOMB_STATE = {
  UNPLANTED: 'UNPLANTED',
  PLANTING: 'PLANTING',
  ARMED: 'ARMED',
  DEFUSING: 'DEFUSING',
  DETONATED: 'DETONATED',
  DEFUSED: 'DEFUSED',
};

export class BombSystem {
  constructor(scene, mapData) {
    this.scene = scene;
    this.mapData = mapData;
    this.state = BOMB_STATE.UNPLANTED;
    this.timer = 40.0;
    this.plantProgress = 0;
    this.defuseProgress = 0;
    this.plantedSite = null;
    this.plantedPosition = new THREE.Vector3();
    this.lastBeepTime = 0;

    // 3D EMP Bomb Mesh
    this.mesh = new THREE.Group();
    const bodyGeo = new THREE.CylinderGeometry(0.2, 0.22, 0.45, 16);
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x22272e, roughness: 0.5, metalness: 0.8 });
    const coreMat = new THREE.MeshBasicMaterial({ color: PALETTE.cyan });
    this.coreMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.12, 16), coreMat);
    this.coreMesh.position.y = 0.22;
    const baseMesh = new THREE.Mesh(bodyGeo, bodyMat);
    baseMesh.position.y = 0.225;
    this.mesh.add(baseMesh, this.coreMesh);
    this.mesh.visible = false;
    scene.add(this.mesh);
  }

  reset() {
    this.state = BOMB_STATE.UNPLANTED;
    this.timer = 40.0;
    this.plantProgress = 0;
    this.defuseProgress = 0;
    this.plantedSite = null;
    this.mesh.visible = false;
  }

  checkPlantZone(pos) {
    if (pos.distanceTo(this.mapData.siteA) <= this.mapData.plantRadius) return 'A';
    if (pos.distanceTo(this.mapData.siteB) <= this.mapData.plantRadius) return 'B';
    return null;
  }

  startPlant(site, pos) {
    if (this.state !== BOMB_STATE.UNPLANTED) return false;
    this.state = BOMB_STATE.PLANTING;
    this.plantedSite = site;
    this.plantedPosition.copy(pos);
    this.plantProgress = 0;
    return true;
  }

  updatePlant(dt) {
    if (this.state !== BOMB_STATE.PLANTING) return false;
    this.plantProgress += dt / 3.0; // 3 seconds to plant
    if (this.plantProgress >= 1.0) {
      this.state = BOMB_STATE.ARMED;
      this.mesh.position.copy(this.plantedPosition);
      this.mesh.visible = true;
      this.coreMesh.material.color.setHex(PALETTE.crimson);
      audio.bombBeep(true);
      return true; // Finished plant
    }
    return false;
  }

  cancelPlant() {
    if (this.state === BOMB_STATE.PLANTING) {
      this.state = BOMB_STATE.UNPLANTED;
      this.plantProgress = 0;
    }
  }

  updateArmed(dt, now) {
    if (this.state !== BOMB_STATE.ARMED && this.state !== BOMB_STATE.DEFUSING) return null;

    this.timer -= dt;

    // Beep interval: slows at 40s (1.0s), accelerates under 10s (0.25s)
    const interval = this.timer > 15 ? 1.0 : (this.timer > 5 ? 0.5 : 0.22);
    if (now - this.lastBeepTime >= interval) {
      this.lastBeepTime = now;
      audio.bombBeep(this.timer < 10);
      // Visual pulse
      this.coreMesh.scale.setScalar(1.2);
    } else {
      this.coreMesh.scale.lerp(new THREE.Vector3(1, 1, 1), 0.15);
    }

    if (this.timer <= 0) {
      this.state = BOMB_STATE.DETONATED;
      audio.explosion();
      return 'DETONATED';
    }
    return null;
  }

  startDefuse(pos) {
    if (this.state !== BOMB_STATE.ARMED) return false;
    if (pos.distanceTo(this.plantedPosition) > 2.5) return false;
    this.state = BOMB_STATE.DEFUSING;
    this.defuseProgress = 0;
    return true;
  }

  updateDefuse(dt) {
    if (this.state !== BOMB_STATE.DEFUSING) return false;
    this.defuseProgress += dt / 5.0; // 5 seconds to defuse
    if (this.defuseProgress >= 1.0) {
      this.state = BOMB_STATE.DEFUSED;
      this.coreMesh.material.color.setHex(PALETTE.emerald);
      return true; // Successfully defused
    }
    return false;
  }

  cancelDefuse() {
    if (this.state === BOMB_STATE.DEFUSING) {
      this.state = BOMB_STATE.ARMED;
      this.defuseProgress = 0;
    }
  }
}
