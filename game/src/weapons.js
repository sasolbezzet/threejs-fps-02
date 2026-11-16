// Operation Vortex: Weapon Arsenal & Ballistic Model
// Defines weapons, ballistic spread, recoil climb, and damage multipliers.

export const WEAPON_REGISTRY = {
  pistol: {
    id: 'pistol',
    name: 'P-9 Tactical',
    slot: 2,
    price: 0,
    damage: 28,
    headMultiplier: 3.2,
    fireRate: 0.22,
    magazineSize: 15,
    reserveAmmo: 60,
    reloadTime: 1.4,
    baseSpread: 0.012,
    movingSpreadPenalty: 0.038,
    recoilClimb: 0.015,
    range: 60,
    automatic: false,
    color: 0x98a0a8,
  },
  rifle: {
    id: 'rifle',
    name: 'Vortex-AR 47',
    slot: 1,
    price: 2700,
    damage: 34,
    headMultiplier: 3.5,
    fireRate: 0.10,
    magazineSize: 30,
    reserveAmmo: 90,
    reloadTime: 2.1,
    baseSpread: 0.018,
    movingSpreadPenalty: 0.065,
    recoilClimb: 0.028,
    range: 120,
    automatic: true,
    color: 0xe3b341,
  },
  sniper: {
    id: 'sniper',
    name: 'Viper .50',
    slot: 1,
    price: 4500,
    damage: 120,
    headMultiplier: 3.8,
    fireRate: 1.15,
    magazineSize: 5,
    reserveAmmo: 25,
    reloadTime: 2.8,
    baseSpread: 0.003,
    movingSpreadPenalty: 0.160,
    recoilClimb: 0.080,
    range: 200,
    automatic: false,
    color: 0x58a6ff,
  },
  shotgun: {
    id: 'shotgun',
    name: 'Breach-12',
    slot: 1,
    price: 1500,
    damage: 16,
    pellets: 8,
    headMultiplier: 2.0,
    fireRate: 0.65,
    magazineSize: 7,
    reserveAmmo: 28,
    reloadTime: 2.4,
    baseSpread: 0.065,
    movingSpreadPenalty: 0.040,
    recoilClimb: 0.045,
    range: 35,
    automatic: false,
    color: 0xd29922,
  },
};

export class WeaponInstance {
  constructor(config) {
    this.config = config;
    this.ammoInMag = config.magazineSize;
    this.reserveAmmo = config.reserveAmmo;
    this.lastFireTime = 0;
    this.isReloading = false;
    this.reloadProgress = 0;
  }

  canFire(now) {
    return !this.isReloading && (now - this.lastFireTime >= this.config.fireRate) && this.ammoInMag > 0;
  }

  fire(now) {
    if (!this.canFire(now)) return false;
    this.lastFireTime = now;
    this.ammoInMag -= 1;
    return true;
  }

  startReload(now) {
    if (this.isReloading || this.ammoInMag >= this.config.magazineSize || this.reserveAmmo <= 0) {
      return false;
    }
    this.isReloading = true;
    this.reloadStartTime = now;
    return true;
  }

  updateReload(now) {
    if (!this.isReloading) return false;
    if (now - this.reloadStartTime >= this.config.reloadTime) {
      const needed = this.config.magazineSize - this.ammoInMag;
      const loaded = Math.min(needed, this.reserveAmmo);
      this.ammoInMag += loaded;
      this.reserveAmmo -= loaded;
      this.isReloading = false;
      return true; // Finished reload
    }
    return false;
  }

  calculateSpread(isMoving, isCrouching) {
    let spread = this.config.baseSpread;
    if (isMoving) spread += this.config.movingSpreadPenalty;
    if (isCrouching) spread *= 0.55;
    return spread;
  }
}
