// Operation Vortex: Tactical Sector 9 Map & Collision Geometry
// Builds an original industrial tactical layout with Site A, Site B, and Mid choke points.

import * as THREE from 'three';
import { PALETTE } from './palette.js';

export function createMap(scene) {
  const colliders = [];

  // Materials
  const floorMat = new THREE.MeshStandardMaterial({
    color: PALETTE.floor,
    roughness: 0.85,
    metalness: 0.2,
  });
  const wallMat = new THREE.MeshStandardMaterial({
    color: PALETTE.surface,
    roughness: 0.7,
    metalness: 0.35,
  });
  const panelMat = new THREE.MeshStandardMaterial({
    color: PALETTE.panel,
    roughness: 0.6,
    metalness: 0.5,
  });
  const crateMat = new THREE.MeshStandardMaterial({
    color: 0x3d444d,
    roughness: 0.75,
    metalness: 0.3,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: PALETTE.accent,
    roughness: 0.4,
    metalness: 0.6,
  });

  // Main Floor (64m x 72m)
  const floorGeo = new THREE.PlaneGeometry(64, 72);
  const floorMesh = new THREE.Mesh(floorGeo, floorMat);
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.receiveShadow = true;
  scene.add(floorMesh);

  // Helper to add collidable wall or crate
  function addBox(x, y, z, width, height, depth, material = wallMat) {
    const geo = new THREE.BoxGeometry(width, height, depth);
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);

    const box = new THREE.Box3().setFromObject(mesh);
    colliders.push(box);
    return mesh;
  }

  // Outer Perimeter Walls (height 5m)
  addBox(0, 2.5, -36, 64, 5, 2);  // North wall
  addBox(0, 2.5, 36, 64, 5, 2);   // South wall
  addBox(-32, 2.5, 0, 2, 5, 72);  // West wall
  addBox(32, 2.5, 0, 2, 5, 72);   // East wall

  // Mid Courtyard Central Barriers
  addBox(0, 1.2, 0, 8, 2.4, 2, panelMat);
  addBox(-6, 0.75, 4, 3, 1.5, 3, crateMat);
  addBox(6, 0.75, -4, 3, 1.5, 3, crateMat);
  addBox(-10, 2.5, 0, 2, 5, 14, wallMat); // Mid-to-A dividing wall
  addBox(10, 2.5, 0, 2, 5, 14, wallMat);  // Mid-to-B dividing wall

  // Site A (West Sector: Storage Terminal)
  addBox(-20, 2.5, -16, 12, 5, 2, wallMat);
  addBox(-26, 2.5, -6, 2, 5, 18, wallMat);
  addBox(-18, 0.9, -10, 3, 1.8, 3, crateMat);
  addBox(-15, 0.9, -14, 2.5, 1.8, 4, crateMat);

  // Site A Plant Zone Marker (Decal / Ground ring)
  const zoneAGeo = new THREE.RingGeometry(3.0, 3.2, 32);
  const zoneAMat = new THREE.MeshBasicMaterial({ color: PALETTE.emerald, side: THREE.DoubleSide });
  const zoneAMesh = new THREE.Mesh(zoneAGeo, zoneAMat);
  zoneAMesh.rotation.x = -Math.PI / 2;
  zoneAMesh.position.set(-18, 0.02, -10);
  scene.add(zoneAMesh);

  // Site B (East Sector: Reactor Generator)
  addBox(20, 2.5, -16, 12, 5, 2, wallMat);
  addBox(26, 2.5, -6, 2, 5, 18, wallMat);
  addBox(18, 1.5, -10, 4, 3.0, 4, panelMat); // Reactor cylinder core
  addBox(22, 0.75, -14, 3, 1.5, 2.5, crateMat);

  // Site B Plant Zone Marker
  const zoneBGeo = new THREE.RingGeometry(3.0, 3.2, 32);
  const zoneBMat = new THREE.MeshBasicMaterial({ color: PALETTE.accent, side: THREE.DoubleSide });
  const zoneBMesh = new THREE.Mesh(zoneBGeo, zoneBMat);
  zoneBMesh.rotation.x = -Math.PI / 2;
  zoneBMesh.position.set(18, 0.02, -10);
  scene.add(zoneBMesh);

  // Attacker Spawn Cover Blocks
  addBox(0, 0.7, 24, 4, 1.4, 2, crateMat);
  addBox(-8, 1.0, 20, 2, 2.0, 6, wallMat);
  addBox(8, 1.0, 20, 2, 2.0, 6, wallMat);

  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
  scene.add(ambientLight);

  const sunLight = new THREE.DirectionalLight(0xffffff, 1.2);
  sunLight.position.set(18, 32, 20);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.width = 1024;
  sunLight.shadow.mapSize.height = 1024;
  sunLight.shadow.camera.near = 0.5;
  sunLight.shadow.camera.far = 80;
  sunLight.shadow.camera.left = -36;
  sunLight.shadow.camera.right = 36;
  sunLight.shadow.camera.top = 36;
  sunLight.shadow.camera.bottom = -36;
  scene.add(sunLight);

  // Colored point lights at bomb sites
  const lightA = new THREE.PointLight(PALETTE.emerald, 2.0, 15);
  lightA.position.set(-18, 3.5, -10);
  scene.add(lightA);

  const lightB = new THREE.PointLight(PALETTE.accent, 2.5, 15);
  lightB.position.set(18, 3.5, -10);
  scene.add(lightB);

  // Waypoints for AI navigation
  const waypoints = [
    { id: 'att_spawn', pos: new THREE.Vector3(0, 0.9, 26), neighbors: ['mid_south', 'lane_a_south', 'lane_b_south'] },
    { id: 'lane_a_south', pos: new THREE.Vector3(-18, 0.9, 16), neighbors: ['att_spawn', 'lane_a_mid'] },
    { id: 'lane_a_mid', pos: new THREE.Vector3(-18, 0.9, 0), neighbors: ['lane_a_south', 'site_a'] },
    { id: 'site_a', pos: new THREE.Vector3(-18, 0.9, -10), neighbors: ['lane_a_mid', 'def_spawn'] },
    { id: 'lane_b_south', pos: new THREE.Vector3(18, 0.9, 16), neighbors: ['att_spawn', 'lane_b_mid'] },
    { id: 'lane_b_mid', pos: new THREE.Vector3(18, 0.9, 0), neighbors: ['lane_b_south', 'site_b'] },
    { id: 'site_b', pos: new THREE.Vector3(18, 0.9, -10), neighbors: ['lane_b_mid', 'def_spawn'] },
    { id: 'mid_south', pos: new THREE.Vector3(0, 0.9, 12), neighbors: ['att_spawn', 'mid_center'] },
    { id: 'mid_center', pos: new THREE.Vector3(0, 0.9, 0), neighbors: ['mid_south', 'mid_north', 'lane_a_mid', 'lane_b_mid'] },
    { id: 'mid_north', pos: new THREE.Vector3(0, 0.9, -14), neighbors: ['mid_center', 'def_spawn'] },
    { id: 'def_spawn', pos: new THREE.Vector3(0, 0.9, -26), neighbors: ['mid_north', 'site_a', 'site_b'] },
  ];

  return {
    colliders,
    waypoints,
    siteA: new THREE.Vector3(-18, 0, -10),
    siteB: new THREE.Vector3(18, 0, -10),
    plantRadius: 4.0,
  };
}
