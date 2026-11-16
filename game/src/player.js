// Operation Vortex: First-Person Tactical Player Controller
// Handles PointerLock mouse look, WASD movement, crouching, collision, weapon models, and recoil.

import * as THREE from 'three';
import { WEAPON_REGISTRY, WeaponInstance } from './weapons.js';
import { PALETTE } from './palette.js';
import { audio } from './audio.js';

export class PlayerController {
  constructor(camera, scene, mapData) {
    this.camera = camera;
    this.scene = scene;
    this.mapData = mapData;

    // Health & Economy State
    this.health = 100;
    this.armor = 100;
    this.cash = 800;
    this.isDead = false;

    // Spatial State
    this.position = new THREE.Vector3(0, 1.65, 26);
    this.velocity = new THREE.Vector3();
    this.isGrounded = true;
    this.isCrouching = false;
    this.isSprinting = false;
    this.eyeHeight = 1.65;
    this.targetEyeHeight = 1.65;

    // Rotation & Pointer Lock
    this.pitch = 0;
    this.yaw = Math.PI; // Face north towards bomb sites
    this.sensitivity = 0.0022;
    this.recoilPitch = 0;
    this.recoilYaw = 0;

    // Inventory
    this.weapons = {
      primary: new WeaponInstance(WEAPON_REGISTRY.rifle),
      secondary: new WeaponInstance(WEAPON_REGISTRY.pistol),
    };
    this.activeSlot = 'primary';
    this.hasBomb = true;
    this.hasGrenade = true;

    // Procedural Viewmodel (First-person gun mesh)
    this.gunGroup = new THREE.Group();
    this.buildGunModel();
    this.camera.add(this.gunGroup);
    this.scene.add(this.camera);

    this.recoilOffset = new THREE.Vector3();
    this.walkSwayTimer = 0;
  }

  buildGunModel() {
    this.gunGroup.clear();
    const gunMat = new THREE.MeshStandardMaterial({ color: 0x21262d, roughness: 0.4, metalness: 0.7 });
    const barrelMat = new THREE.MeshStandardMaterial({ color: 0x0d1117, roughness: 0.2, metalness: 0.9 });
    const trimMat = new THREE.MeshBasicMaterial({ color: PALETTE.accent });

    // Receiver
    const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.45), gunMat);
    // Barrel
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.35, 12), barrelMat);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.04, -0.35);
    // Magazine
    const mag = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.18, 0.1), gunMat);
    mag.position.set(0, -0.12, -0.05);
    // Sight trim
    const sight = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.03, 0.04), trimMat);
    sight.position.set(0, 0.075, -0.3);

    this.gunGroup.add(receiver, barrel, mag, sight);
    this.gunGroup.position.set(0.24, -0.22, -0.5);
  }

  resetRound() {
    this.health = 100;
    this.armor = Math.max(this.armor, 50);
    this.isDead = false;
    this.position.set(0, 1.65, 26);
    this.velocity.set(0, 0, 0);
    this.pitch = 0;
    this.yaw = Math.PI;
    this.activeWeapon.ammoInMag = this.activeWeapon.config.magazineSize;
    this.activeWeapon.isReloading = false;
  }

  get activeWeapon() {
    return this.weapons[this.activeSlot] ?? this.weapons.secondary;
  }

  onMouseMove(dx, dy) {
    if (this.isDead) return;
    this.yaw -= dx * this.sensitivity;
    this.pitch -= dy * this.sensitivity;
    // Limit pitch to prevent flipping
    this.pitch = Math.max(-Math.PI / 2.1, Math.min(Math.PI / 2.1, this.pitch));
  }

  applyRecoil(climb) {
    this.pitch += climb * 0.4;
    this.yaw += (Math.random() - 0.5) * climb * 0.3;
    this.recoilOffset.z += 0.08;
    this.recoilOffset.y += 0.02;
  }

  takeDamage(amount) {
    if (this.isDead) return;
    let finalDmg = amount;
    if (this.armor > 0) {
      finalDmg *= 0.6;
      this.armor = Math.max(0, this.armor - amount * 0.4);
    }
    this.health -= finalDmg;
    audio.hitBody();

    if (this.health <= 0) {
      this.health = 0;
      this.isDead = true;
    }
  }

  update(dt, inputState) {
    if (this.isDead) return;

    // Smooth crouch eye level transition
    this.isCrouching = !!inputState.crouch;
    this.isSprinting = !!inputState.sprint && !this.isCrouching;
    this.targetEyeHeight = this.isCrouching ? 1.05 : 1.65;
    this.eyeHeight = THREE.MathUtils.lerp(this.eyeHeight, this.targetEyeHeight, 0.2);

    // Speed calculation: crouching gives pinpoint accuracy at cost of speed
    let moveSpeed = 4.4;
    if (this.isCrouching) moveSpeed = 2.2;
    else if (this.isSprinting) moveSpeed = 6.4;

    // Movement vectors from yaw
    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));

    const moveDir = new THREE.Vector3();
    if (inputState.forward) moveDir.add(forward);
    if (inputState.backward) moveDir.sub(forward);
    if (inputState.right) moveDir.add(right);
    if (inputState.left) moveDir.sub(right);

    const isMoving = moveDir.lengthSq() > 0.01;
    if (isMoving) {
      moveDir.normalize();
      this.velocity.x = moveDir.x * moveSpeed;
      this.velocity.z = moveDir.z * moveSpeed;
      this.walkSwayTimer += dt * (this.isSprinting ? 12 : 8);
    } else {
      // Friction deceleration
      this.velocity.x *= 0.75;
      this.velocity.z *= 0.75;
    }

    // Apply gravity
    this.velocity.y -= 14.0 * dt;
    this.position.y += this.velocity.y * dt;

    if (this.position.y <= this.eyeHeight) {
      this.position.y = this.eyeHeight;
      this.velocity.y = 0;
      this.isGrounded = true;
    }

    if (inputState.jump && this.isGrounded && !this.isCrouching) {
      this.velocity.y = 5.0;
      this.isGrounded = false;
    }

    // New prospective position
    const nextX = this.position.x + this.velocity.x * dt;
    const nextZ = this.position.z + this.velocity.z * dt;

    // Collision check with map colliders
    const playerRadius = 0.4;
    let allowedX = true;
    let allowedZ = true;

    for (const box of this.mapData.colliders) {
      if (box.containsPoint(new THREE.Vector3(nextX, this.position.y, this.position.z))) allowedX = false;
      if (box.containsPoint(new THREE.Vector3(this.position.x, this.position.y, nextZ))) allowedZ = false;
    }

    if (allowedX) this.position.x = nextX;
    if (allowedZ) this.position.z = nextZ;

    // Update Camera
    this.camera.position.set(this.position.x, this.position.y, this.position.z);
    this.camera.rotation.set(0, 0, 0);
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;

    // Viewmodel weapon sway & recoil recovery
    const swayX = Math.sin(this.walkSwayTimer) * (isMoving ? 0.015 : 0.002);
    const swayY = Math.abs(Math.cos(this.walkSwayTimer)) * (isMoving ? 0.015 : 0.002);
    this.recoilOffset.lerp(new THREE.Vector3(0, 0, 0), 0.2);

    this.gunGroup.position.set(
      0.24 + swayX + this.recoilOffset.x,
      -0.22 - swayY + this.recoilOffset.y,
      -0.5 + this.recoilOffset.z
    );
  }
}
