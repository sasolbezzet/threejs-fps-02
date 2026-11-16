// Operation Vortex: Full Tactical HUD & Economy Buy Menu Overlay
// Controls dynamic crosshair bloom, health/armor readouts, radar canvas, killfeed, and buy menu.

import { WEAPON_REGISTRY } from './weapons.js';

export class TacticalHUD {
  constructor() {
    this.hpEl = document.getElementById('hud-hp');
    this.apEl = document.getElementById('hud-ap');
    this.ammoMagEl = document.getElementById('hud-ammo-mag');
    this.ammoResEl = document.getElementById('hud-ammo-res');
    this.cashEl = document.getElementById('hud-cash');
    this.timerEl = document.getElementById('hud-timer');
    this.scoreEl = document.getElementById('hud-score');
    this.crosshairEl = document.getElementById('crosshair');
    this.hitmarkerEl = document.getElementById('hitmarker');
    this.killfeedEl = document.getElementById('hud-killfeed');
    this.buyMenuEl = document.getElementById('buy-menu');
    this.radarCanvas = document.getElementById('radar-canvas');
    this.radarCtx = this.radarCanvas ? this.radarCanvas.getContext('2d') : null;

    this.hitmarkerTimer = 0;
  }

  update(player, bomb, bots, roundState) {
    if (this.hpEl) this.hpEl.textContent = Math.round(player.health);
    if (this.apEl) this.apEl.textContent = Math.round(player.armor);
    if (this.cashEl) this.cashEl.textContent = `$${player.cash}`;

    const weapon = player.activeWeapon;
    if (this.ammoMagEl && this.ammoResEl) {
      this.ammoMagEl.textContent = weapon.ammoInMag;
      this.ammoResEl.textContent = `/ ${weapon.reserveAmmo}`;
      if (weapon.ammoInMag <= 5) this.ammoMagEl.classList.add('low');
      else this.ammoMagEl.classList.remove('low');
    }

    if (this.timerEl) {
      if (bomb.state === 'ARMED' || bomb.state === 'DEFUSING') {
        this.timerEl.textContent = `EMP: ${Math.max(0, bomb.timer).toFixed(1)}s`;
        this.timerEl.classList.add('bomb-armed');
      } else {
        const mins = Math.floor(roundState.timeLeft / 60);
        const secs = Math.floor(roundState.timeLeft % 60).toString().padStart(2, '0');
        this.timerEl.textContent = `${mins}:${secs}`;
        this.timerEl.classList.remove('bomb-armed');
      }
    }

    if (this.scoreEl) {
      this.scoreEl.textContent = `ATT ${roundState.attScore} · ${roundState.defScore} DEF (Round ${roundState.currentRound}/${roundState.maxRounds})`;
    }

    // Dynamic Crosshair Bloom based on spread
    if (this.crosshairEl) {
      const isMoving = player.velocity.lengthSq() > 0.1;
      const spreadSize = player.activeWeapon.calculateSpread(isMoving, player.isCrouching) * 450;
      this.crosshairEl.style.setProperty('--bloom', `${Math.max(8, Math.round(spreadSize))}px`);
    }

    // Hitmarker fade
    if (this.hitmarkerTimer > 0) {
      this.hitmarkerTimer -= 0.016;
      if (this.hitmarkerTimer <= 0 && this.hitmarkerEl) {
        this.hitmarkerEl.classList.remove('on', 'headshot');
      }
    }

    // Draw Tactical Radar
    this.drawRadar(player, bomb, bots);
  }

  showHitmarker(isHeadshot) {
    if (!this.hitmarkerEl) return;
    this.hitmarkerEl.classList.add('on');
    if (isHeadshot) this.hitmarkerEl.classList.add('headshot');
    this.hitmarkerTimer = 0.18;
  }

  addKillfeed(killer, victim, weaponName, isHeadshot) {
    if (!this.killfeedEl) return;
    const item = document.createElement('div');
    item.className = 'killfeed-item';
    item.innerHTML = `<span>${killer}</span> <span class="kf-weapon">[${weaponName}${isHeadshot ? ' 🎯' : ''}]</span> <span>${victim}</span>`;
    this.killfeedEl.appendChild(item);

    setTimeout(() => {
      item.remove();
    }, 4500);
  }

  toggleBuyMenu(show) {
    if (!this.buyMenuEl) return;
    if (show) this.buyMenuEl.removeAttribute('hidden');
    else this.buyMenuEl.setAttribute('hidden', '');
  }

  drawRadar(player, bomb, botSquad) {
    if (!this.radarCtx) return;
    const ctx = this.radarCtx;
    const w = this.radarCanvas.width;
    const h = this.radarCanvas.height;

    ctx.clearRect(0, 0, w, h);

    // Radar background grid
    ctx.strokeStyle = 'rgba(88, 166, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, w, h);
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, w / 2 - 2, 0, Math.PI * 2);
    ctx.stroke();

    // Coordinate mapping: map bounds ~64x72m
    const scale = (w - 16) / 72;
    const toRadarX = (worldX) => w / 2 + worldX * scale;
    const toRadarY = (worldZ) => h / 2 + worldZ * scale;

    // Bomb sites
    ctx.fillStyle = '#3fb950';
    ctx.fillText('A', toRadarX(-18) - 4, toRadarY(-10) + 4);
    ctx.fillStyle = '#e3b341';
    ctx.fillText('B', toRadarX(18) - 4, toRadarY(-10) + 4);

    // Bots
    for (const bot of botSquad.bots) {
      if (bot.isDead) continue;
      ctx.fillStyle = bot.team === 'DEFENDERS' ? '#f85149' : '#58a6ff';
      ctx.beginPath();
      ctx.arc(toRadarX(bot.group.position.x), toRadarY(bot.group.position.z), 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Player position & arrow
    ctx.fillStyle = '#ffffff';
    const px = toRadarX(player.position.x);
    const py = toRadarY(player.position.z);
    ctx.beginPath();
    ctx.arc(px, py, 4, 0, Math.PI * 2);
    ctx.fill();

    // Direction pointer
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px - Math.sin(player.yaw) * 8, py - Math.cos(player.yaw) * 8);
    ctx.stroke();
  }
}
