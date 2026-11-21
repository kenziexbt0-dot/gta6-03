// Solmarina — particles and short-lived effects: skid smoke, crash sparks,
// muzzle flashes, tracers, impact stars and drifting dust. All purely visual.

import { makeRng } from './random.js';

// Fresh effects state: one particle list and one tracer list.
export function createEffects() {
  return {
    particles: [],
    tracers: [],
    // Bound helpers the gameplay code calls; set up by bindEffects below.
    crashSparks: null,
    skidSmoke: null,
    impactStars: null,
    muzzleFlash: null,
    tracer: null,
  };
}

// Wire the helper methods onto the effects object so gameplay modules can call
// game.effects.crashSparks(...) without importing this file everywhere.
export function bindEffects(effects) {
  effects.crashSparks = (x, y, count) => {
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 180;
      effects.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.4 + Math.random() * 0.3,
        maxLife: 0.7,
        size: 2 + Math.random() * 3,
        color: Math.random() < 0.5 ? '#ffcf4d' : '#ff7a3c',
        kind: 'spark',
      });
    }
  };

  effects.skidSmoke = (x, y) => {
    effects.particles.push({
      x, y,
      vx: (Math.random() - 0.5) * 30,
      vy: (Math.random() - 0.5) * 30 - 12,
      life: 0.7,
      maxLife: 0.7,
      size: 6 + Math.random() * 6,
      color: '#cfc8b8',
      kind: 'smoke',
    });
  };

  effects.impactStars = (x, y) => {
    for (let i = 0; i < 6; i += 1) {
      const angle = (i / 6) * Math.PI * 2;
      effects.particles.push({
        x, y,
        vx: Math.cos(angle) * 70,
        vy: Math.sin(angle) * 70,
        life: 0.35,
        maxLife: 0.35,
        size: 3,
        color: '#ffe94d',
        kind: 'star',
      });
    }
  };

  effects.muzzleFlash = (x, y) => {
    effects.particles.push({
      x, y,
      vx: 0, vy: 0,
      life: 0.08,
      maxLife: 0.08,
      size: 14,
      color: '#ffe94d',
      kind: 'flash',
    });
  };

  effects.tracer = (x1, y1, x2, y2) => {
    effects.tracers.push({ x1, y1, x2, y2, life: 0.12, maxLife: 0.12 });
  };
}

// Advance particles and tracers one frame.
export function updateEffects(effects, dt) {
  for (const p of effects.particles) {
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.96;
    p.vy *= 0.96;
    if (p.kind === 'smoke') p.size += 14 * dt;
  }
  effects.particles = effects.particles.filter((p) => p.life > 0);
  for (const t of effects.tracers) t.life -= dt;
  effects.tracers = effects.tracers.filter((t) => t.life > 0);
}

// Draw all live particles and tracers in world space.
export function drawEffects(ctx, effects) {
  for (const t of effects.tracers) {
    ctx.strokeStyle = `rgba(255, 233, 77, ${t.life / t.maxLife})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(t.x1, t.y1);
    ctx.lineTo(t.x2, t.y2);
    ctx.stroke();
  }
  for (const p of effects.particles) {
    const alpha = Math.max(0, p.life / p.maxLife);
    if (p.kind === 'smoke') {
      ctx.fillStyle = `rgba(207, 200, 184, ${alpha * 0.5})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.kind === 'flash') {
      ctx.fillStyle = `rgba(255, 233, 77, ${alpha})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * alpha + 2, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.kind === 'star') {
      ctx.fillStyle = `rgba(255, 233, 77, ${alpha})`;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.life * 12);
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      ctx.restore();
    } else {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = alpha;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      ctx.globalAlpha = 1;
    }
  }
}
