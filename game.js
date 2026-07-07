(() => {
  'use strict';

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const container = document.getElementById('game-container');
  const scoreEl = document.getElementById('score');
  const levelEl = document.getElementById('level');
  const livesEl = document.getElementById('lives');
  const startScreen = document.getElementById('startScreen');
  const gameOverScreen = document.getElementById('gameOverScreen');
  const finalScoreEl = document.getElementById('finalScore');
  const startBtn = document.getElementById('startBtn');
  const restartBtn = document.getElementById('restartBtn');

  let W = 0, H = 0, DPR = 1;
  const FLOOR_H = 70;

  function resize() {
    const rect = container.getBoundingClientRect();
    DPR = window.devicePixelRatio || 1;
    W = rect.width;
    H = rect.height;
    canvas.width = W * DPR;
    canvas.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    initBubbles();
    initStarfish();
  }
  window.addEventListener('resize', resize);

  // ---------- Game state ----------
  const STATE = { MENU: 'menu', PLAYING: 'playing', OVER: 'over' };
  let state = STATE.MENU;

  const player = {
    w: 54, h: 38,
    x: 0, y: 0,
    speed: 380,
    tilt: 0,
    fireCooldown: 0,
    fireRate: 0.22,
    lives: 3,
    invuln: 0,
  };

  let score = 0;
  let bullets = [];       // player bullets
  let enemyBullets = [];
  let enemies = [];
  let particles = [];
  let bubbles = [];
  let starfish = [];
  let seaweed = [];
  let wave = 1;
  let phase = 1;
  let phaseBannerTimer = 0;
  let enemyDir = 1;
  let enemyDropTimer = 0;
  let elapsed = 0;

  let keys = { left: false, right: false, up: false, down: false, fire: false };
  let pointerDown = false;
  let pointerX = null;
  let pointerY = null;

  const DEPTH_THEMES = [
    ['#1f6f8b', '#052a3a'],
    ['#145374', '#031c2b'],
    ['#0b3d5c', '#020f1c'],
    ['#3a1c5c', '#0a0416'],
  ];
  function themeForPhase(p) {
    return DEPTH_THEMES[Math.min(p - 1, DEPTH_THEMES.length - 1)];
  }
  function phaseForWave(w) {
    return Math.floor((w - 1) / 3) + 1;
  }

  function playerMinY() { return 76; }
  function playerMaxY() { return H - FLOOR_H - player.h - 6; }

  function resetPlayer() {
    player.x = W / 2 - player.w / 2;
    player.y = playerMaxY();
    player.tilt = 0;
    player.lives = 3;
    player.invuln = 0;
    player.fireCooldown = 0;
  }

  function initBubbles() {
    bubbles = [];
    for (let i = 0; i < 50; i++) {
      bubbles.push({
        x: Math.random() * W,
        y: Math.random() * H,
        r: Math.random() * 3 + 1.5,
        speed: Math.random() * 40 + 20,
        wobble: Math.random() * Math.PI * 2,
      });
    }
  }

  function initStarfish() {
    starfish = [];
    const count = 5;
    for (let i = 0; i < count; i++) {
      starfish.push({
        x: (W / count) * i + (W / count) / 2 + (Math.random() * 24 - 12),
        y: H - FLOOR_H * 0.4 + (Math.random() * 12 - 6),
        size: Math.random() * 7 + 13,
        rot: Math.random() * Math.PI,
        phase: Math.random() * Math.PI * 2,
        color: Math.random() < 0.5 ? '#ff7f50' : '#ffb347',
      });
    }
    seaweed = [];
    const wCount = 4;
    for (let i = 0; i < wCount; i++) {
      seaweed.push({
        x: (W / wCount) * i + (W / wCount) * 0.3 + Math.random() * 20,
        height: Math.random() * 26 + 26,
        phase: Math.random() * Math.PI * 2,
      });
    }
  }

  function buildWave() {
    enemies = [];
    const cols = Math.min(6, 4 + Math.floor(wave / 2));
    const rows = Math.min(4, 2 + Math.floor(wave / 3));
    const marginX = 30;
    const spacingX = (W - marginX * 2) / cols;
    const spacingY = 46;
    const startY = 50;
    const speedBoost = (1 + (wave - 1) * 0.12) * (1 + (phase - 1) * 0.15);
    const hp = Math.min(1 + Math.floor((phase - 1) / 2), 3);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const baseX = marginX + c * spacingX + spacingX / 2 - 16;
        enemies.push({
          baseX,
          x: baseX,
          y: startY + r * spacingY,
          w: 32, h: 28,
          alive: true,
          hp,
          shootCooldown: Math.random() * 3 + 1,
          type: r % 3,
          speedBoost,
          waveAmp: Math.random() * 10 + 8,
          phaseOffset: Math.random() * Math.PI * 2,
          diving: false,
          diveCooldown: Math.random() * 5 + 4,
        });
      }
    }
    enemyDir = 1;
    enemyDropTimer = 0;
  }

  function startGame() {
    score = 0;
    wave = 1;
    phase = phaseForWave(wave);
    bullets = [];
    enemyBullets = [];
    particles = [];
    resetPlayer();
    buildWave();
    initBubbles();
    initStarfish();
    updateHud();
    state = STATE.PLAYING;
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
  }

  function endGame() {
    state = STATE.OVER;
    finalScoreEl.textContent = `Pontuação final: ${score}`;
    gameOverScreen.classList.remove('hidden');
  }

  function updateHud() {
    scoreEl.textContent = `Pontos: ${score}`;
    levelEl.textContent = `Fase ${phase} • Onda ${wave}`;
    livesEl.textContent = 'Vidas: ' + '❤️'.repeat(Math.max(player.lives, 0));
  }

  // ---------- Input ----------
  window.addEventListener('keydown', (e) => {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = true;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = true;
    if (e.code === 'ArrowUp' || e.code === 'KeyW') keys.up = true;
    if (e.code === 'ArrowDown' || e.code === 'KeyS') keys.down = true;
    if (e.code === 'Space') { keys.fire = true; e.preventDefault(); }
  });
  window.addEventListener('keyup', (e) => {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = false;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = false;
    if (e.code === 'ArrowUp' || e.code === 'KeyW') keys.up = false;
    if (e.code === 'ArrowDown' || e.code === 'KeyS') keys.down = false;
    if (e.code === 'Space') keys.fire = false;
  });

  function pointerFromEvent(e) {
    const rect = canvas.getBoundingClientRect();
    const t = e.touches ? e.touches[0] : e;
    return { x: t.clientX - rect.left, y: t.clientY - rect.top };
  }

  function onPointerDown(e) {
    pointerDown = true;
    const p = pointerFromEvent(e);
    pointerX = p.x;
    pointerY = p.y;
    e.preventDefault();
  }
  function onPointerMove(e) {
    if (!pointerDown) return;
    const p = pointerFromEvent(e);
    pointerX = p.x;
    pointerY = p.y;
    e.preventDefault();
  }
  function onPointerUp(e) {
    pointerDown = false;
    pointerX = null;
    pointerY = null;
    if (e) e.preventDefault();
  }

  canvas.addEventListener('mousedown', onPointerDown);
  canvas.addEventListener('mousemove', onPointerMove);
  window.addEventListener('mouseup', onPointerUp);
  canvas.addEventListener('touchstart', onPointerDown, { passive: false });
  canvas.addEventListener('touchmove', onPointerMove, { passive: false });
  canvas.addEventListener('touchend', onPointerUp, { passive: false });
  canvas.addEventListener('touchcancel', onPointerUp, { passive: false });

  startBtn.addEventListener('click', startGame);
  restartBtn.addEventListener('click', startGame);

  // ---------- Entities helpers ----------
  function spawnPlayerBullet() {
    bullets.push({
      x: player.x + player.w / 2 - 3,
      y: player.y - 10,
      w: 6, h: 14,
      speed: 620,
    });
  }

  function spawnEnemyBullet(enemy) {
    enemyBullets.push({
      x: enemy.x + enemy.w / 2 - 3,
      y: enemy.y + enemy.h,
      w: 6, h: 14,
      speed: 260 + wave * 12,
    });
  }

  function spawnExplosion(x, y, color, count) {
    for (let i = 0; i < (count || 14); i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 140 + 40;
      particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: Math.random() * 0.4 + 0.3,
        age: 0,
        color: color || '#ff8800',
      });
    }
  }

  function rectsOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x &&
           a.y < b.y + b.h && a.y + a.h > b.y;
  }

  // ---------- Update ----------
  let lastTime = null;

  function update(dt) {
    elapsed += dt;

    // bubbles (ambient, animate even outside gameplay)
    for (const b of bubbles) {
      b.y -= b.speed * dt;
      b.x += Math.sin(elapsed * 2 + b.wobble) * 8 * dt;
      if (b.y < -10) { b.y = H + 10; b.x = Math.random() * W; }
    }

    if (phaseBannerTimer > 0) phaseBannerTimer -= dt;

    if (state !== STATE.PLAYING) return;

    // player movement (free roam: left/right + forward/back)
    let moveDirX = 0, moveDirY = 0;
    if (keys.left) moveDirX -= 1;
    if (keys.right) moveDirX += 1;
    if (keys.up) moveDirY -= 1;
    if (keys.down) moveDirY += 1;

    let desiredVX = moveDirX * player.speed;

    if (pointerDown && pointerX !== null) {
      const targetX = pointerX - player.w / 2;
      const dx = targetX - player.x;
      desiredVX = dx * Math.min(1, dt * 12) / Math.max(dt, 0.001);
      player.x += dx * Math.min(1, dt * 12);
      const targetY = pointerY - player.h / 2;
      const dy = targetY - player.y;
      player.y += dy * Math.min(1, dt * 12);
    } else {
      player.x += moveDirX * player.speed * dt;
      player.y += moveDirY * player.speed * dt;
    }
    player.x = Math.max(6, Math.min(W - player.w - 6, player.x));
    player.y = Math.max(playerMinY(), Math.min(playerMaxY(), player.y));

    const targetTilt = Math.max(-1, Math.min(1, desiredVX / 300)) * 0.32;
    player.tilt += (targetTilt - player.tilt) * Math.min(1, dt * 8);

    // firing: holding pointer down on canvas, or spacebar
    player.fireCooldown -= dt;
    const wantsFire = (pointerDown || keys.fire) && player.fireCooldown <= 0;
    if (wantsFire) {
      spawnPlayerBullet();
      player.fireCooldown = player.fireRate;
    }

    if (player.invuln > 0) player.invuln -= dt;

    // player bullets
    bullets.forEach(b => b.y -= b.speed * dt);
    bullets = bullets.filter(b => b.y + b.h > 0);

    // enemy bullets
    enemyBullets.forEach(b => b.y += b.speed * dt);
    enemyBullets = enemyBullets.filter(b => b.y < H);

    // enemy formation + organic swim movement
    let hitEdge = false;
    const aliveEnemies = enemies.filter(e => e.alive);
    const formSpeed = (40 + wave * 6) * (1 + (phase - 1) * 0.15);
    const descendSpeed = (16 + wave * 2) * (1 + (phase - 1) * 0.2);

    for (const e of aliveEnemies) {
      if (phase >= 2 && !e.diving) {
        e.diveCooldown -= dt;
        if (e.diveCooldown <= 0) {
          e.diving = true;
        }
      }

      if (e.diving) {
        const targetCx = player.x + player.w / 2;
        e.x += (targetCx - (e.x + e.w / 2)) * Math.min(1, dt * 1.5);
        e.y += descendSpeed * 2.6 * dt;
      } else {
        e.baseX += enemyDir * formSpeed * e.speedBoost * dt;
        e.x = e.baseX + Math.sin(elapsed * 2 + e.phaseOffset) * e.waveAmp;
        e.y += descendSpeed * dt;
        if (e.baseX < 10 || e.baseX + e.w > W - 10) hitEdge = true;
      }
    }
    if (hitEdge) {
      enemyDir *= -1;
      enemyDropTimer = 0.25;
    }
    if (enemyDropTimer > 0) {
      enemyDropTimer -= dt;
      for (const e of aliveEnemies) if (!e.diving) e.y += 30 * dt;
    }

    // enemy shooting + floor invasion check
    const floorY = H - FLOOR_H;
    for (const e of aliveEnemies) {
      e.shootCooldown -= dt;
      if (e.shootCooldown <= 0) {
        spawnEnemyBullet(e);
        e.shootCooldown = Math.random() * (4.5 - Math.min(wave * 0.2, 3)) + 1.5;
      }
      if (e.y + e.h >= floorY) {
        endGame();
      }
    }

    // collisions: player bullets vs enemies
    for (const b of bullets) {
      if (b.dead) continue;
      for (const e of aliveEnemies) {
        if (!e.alive || b.dead) continue;
        if (rectsOverlap(b, e)) {
          b.dead = true;
          e.hp -= 1;
          if (e.hp <= 0) {
            e.alive = false;
            score += 10 * wave;
            spawnExplosion(e.x + e.w / 2, e.y + e.h / 2, '#ffcc00');
          } else {
            spawnExplosion(b.x, b.y, '#ffffff', 6);
          }
        }
      }
    }
    bullets = bullets.filter(b => !b.dead);
    enemies = enemies.filter(e => e.alive);

    // collisions: enemy bullets vs player
    if (player.invuln <= 0) {
      for (const b of enemyBullets) {
        if (rectsOverlap(b, player)) {
          b.dead = true;
          hitPlayer();
        }
      }
      enemyBullets = enemyBullets.filter(b => !b.dead);

      // collisions: player vs enemies (direct contact)
      for (const e of enemies) {
        if (!e.alive) continue;
        if (rectsOverlap(player, e)) {
          e.alive = false;
          spawnExplosion(e.x + e.w / 2, e.y + e.h / 2, '#ffcc00');
          hitPlayer();
          break;
        }
      }
      enemies = enemies.filter(e => e.alive);
    }

    // particles
    for (const p of particles) {
      p.age += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    particles = particles.filter(p => p.age < p.life);

    // wave clear
    if (enemies.length === 0) {
      wave += 1;
      const newPhase = phaseForWave(wave);
      if (newPhase !== phase) {
        phase = newPhase;
        phaseBannerTimer = 2.6;
      }
      buildWave();
    }

    updateHud();
  }

  function hitPlayer() {
    player.lives -= 1;
    player.invuln = 1.6;
    spawnExplosion(player.x + player.w / 2, player.y + player.h / 2, '#00e5ff');
    updateHud();
    if (player.lives <= 0) {
      endGame();
    }
  }

  // ---------- Draw ----------
  function drawSubmarine(x, y, w, h, color, glow, tilt) {
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2);
    ctx.rotate(tilt || 0);
    ctx.shadowColor = glow || color;
    ctx.shadowBlur = 12;
    ctx.fillStyle = color;

    const bodyW = w;
    const bodyH = h * 0.5;
    const bodyY = h * 0.1;

    // hull
    ctx.beginPath();
    ctx.ellipse(0, bodyY, bodyW / 2, bodyH / 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // conning tower (sail)
    ctx.beginPath();
    ctx.moveTo(-w * 0.12, bodyY);
    ctx.lineTo(-w * 0.12, -h * 0.34);
    ctx.quadraticCurveTo(0, -h * 0.5, w * 0.12, -h * 0.34);
    ctx.lineTo(w * 0.12, bodyY);
    ctx.closePath();
    ctx.fill();

    // periscope
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -h * 0.42);
    ctx.lineTo(0, -h * 0.56);
    ctx.stroke();

    // tail (propeller end)
    ctx.beginPath();
    ctx.moveTo(-bodyW / 2, bodyY);
    ctx.lineTo(-bodyW / 2 - w * 0.14, bodyY - h * 0.14);
    ctx.lineTo(-bodyW / 2 - w * 0.14, bodyY + h * 0.14);
    ctx.closePath();
    ctx.fill();

    // nose fin
    ctx.beginPath();
    ctx.moveTo(bodyW / 2, bodyY);
    ctx.lineTo(bodyW / 2 + w * 0.1, bodyY - h * 0.08);
    ctx.lineTo(bodyW / 2 + w * 0.1, bodyY + h * 0.08);
    ctx.closePath();
    ctx.fill();

    // portholes
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    [-bodyW * 0.18, 0, bodyW * 0.18].forEach(px => {
      ctx.beginPath();
      ctx.arc(px, bodyY, Math.max(2, w * 0.035), 0, Math.PI * 2);
      ctx.fill();
    });

    ctx.restore();
  }

  function drawFish(e) {
    const colors = ['#ff3b6e', '#7c4dff', '#00e5a8'];
    const color = colors[e.type];
    const w = e.w, h = e.h;
    ctx.save();
    ctx.translate(e.x + w / 2, e.y + h / 2);
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    ctx.fillStyle = color;

    // tail fin (up top, fish head points down toward the player)
    ctx.beginPath();
    ctx.moveTo(0, -h * 0.18);
    ctx.lineTo(-w * 0.22, -h * 0.62);
    ctx.lineTo(w * 0.22, -h * 0.62);
    ctx.closePath();
    ctx.fill();

    // body
    ctx.beginPath();
    ctx.ellipse(0, 0, w * 0.34, h * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();

    // side fins
    ctx.beginPath();
    ctx.moveTo(-w * 0.32, -h * 0.02);
    ctx.lineTo(-w * 0.52, h * 0.12);
    ctx.lineTo(-w * 0.28, h * 0.18);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(w * 0.32, -h * 0.02);
    ctx.lineTo(w * 0.52, h * 0.12);
    ctx.lineTo(w * 0.28, h * 0.18);
    ctx.closePath();
    ctx.fill();

    // eye
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(-w * 0.1, h * 0.18, w * 0.09, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#001122';
    ctx.beginPath();
    ctx.arc(-w * 0.1, h * 0.2, w * 0.045, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function drawStar(cx, cy, spikes, outerR, innerR, rot, color) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    ctx.beginPath();
    for (let i = 0; i < spikes * 2; i++) {
      const r = i % 2 === 0 ? outerR : innerR;
      const ang = (Math.PI / spikes) * i - Math.PI / 2;
      const px = Math.cos(ang) * r, py = Math.sin(ang) * r;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = 6;
    ctx.fill();
    ctx.restore();
  }

  function drawOceanBackground() {
    const [topColor, bottomColor] = themeForPhase(phase);
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, topColor);
    grad.addColorStop(1, bottomColor);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // soft light shafts from the surface
    ctx.save();
    ctx.globalAlpha = 0.06;
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 3; i++) {
      const sx = (W / 3) * i + Math.sin(elapsed * 0.3 + i) * 20;
      ctx.beginPath();
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx + 60, 0);
      ctx.lineTo(sx - 40, H);
      ctx.lineTo(sx - 120, H);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // bubbles
    for (const b of bubbles) {
      ctx.beginPath();
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.arc(b.x - b.r * 0.3, b.y - b.r * 0.3, b.r * 0.3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawFloor() {
    const floorY = H - FLOOR_H;
    ctx.beginPath();
    ctx.moveTo(0, floorY);
    const segments = 10;
    for (let i = 0; i <= segments; i++) {
      const x = (W / segments) * i;
      const y = floorY + Math.sin(elapsed * 0.6 + i * 0.8) * 4;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, floorY, 0, H);
    grad.addColorStop(0, '#e8d190');
    grad.addColorStop(1, '#9c7f42');
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    for (let i = 0; i < 40; i++) {
      const gx = (i * 53.7) % W;
      const gy = floorY + 10 + (i * 13) % (FLOOR_H - 14);
      ctx.beginPath();
      ctx.arc(gx, gy, 1.3, 0, Math.PI * 2);
      ctx.fill();
    }

    // seaweed
    ctx.strokeStyle = '#2e8b57';
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    for (const s of seaweed) {
      const sway = Math.sin(elapsed * 1.4 + s.phase) * 10;
      ctx.beginPath();
      ctx.moveTo(s.x, H - 4);
      ctx.quadraticCurveTo(s.x + sway, H - s.height * 0.6, s.x + sway * 1.4, H - s.height);
      ctx.stroke();
    }

    // starfish
    for (const sf of starfish) {
      const pulse = 1 + Math.sin(elapsed * 1.5 + sf.phase) * 0.06;
      drawStar(sf.x, sf.y, 5, sf.size * pulse, sf.size * 0.45 * pulse, sf.rot, sf.color);
    }
  }

  function drawPhaseBanner() {
    if (phaseBannerTimer <= 0) return;
    const alpha = Math.min(1, phaseBannerTimer / 1.2);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#baf5ff';
    ctx.shadowColor = '#00e5ff';
    ctx.shadowBlur = 18;
    ctx.font = 'bold 34px Trebuchet MS, Arial, sans-serif';
    ctx.fillText(`FASE ${phase}`, W / 2, H / 2 - 10);
    ctx.font = '16px Trebuchet MS, Arial, sans-serif';
    ctx.fillText('As águas ficam mais profundas...', W / 2, H / 2 + 20);
    ctx.restore();
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    drawOceanBackground();

    if (state === STATE.PLAYING) {
      // player
      if (player.invuln <= 0 || Math.floor(player.invuln * 12) % 2 === 0) {
        drawSubmarine(player.x, player.y, player.w, player.h, '#00e5ff', '#00e5ff', player.tilt);
      }

      // enemies
      for (const e of enemies) drawFish(e);

      // bullets
      ctx.fillStyle = '#00ffea';
      ctx.shadowColor = '#00ffea';
      ctx.shadowBlur = 8;
      for (const b of bullets) ctx.fillRect(b.x, b.y, b.w, b.h);

      ctx.fillStyle = '#ff4455';
      ctx.shadowColor = '#ff4455';
      for (const b of enemyBullets) ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.shadowBlur = 0;

      // particles
      for (const p of particles) {
        const alpha = 1 - p.age / p.life;
        ctx.globalAlpha = Math.max(alpha, 0);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    drawFloor();

    if (state === STATE.PLAYING) drawPhaseBanner();
  }

  function loop(timestamp) {
    if (lastTime === null) lastTime = timestamp;
    let dt = (timestamp - lastTime) / 1000;
    dt = Math.min(dt, 0.05);
    lastTime = timestamp;

    update(dt);
    draw();

    requestAnimationFrame(loop);
  }

  resize();
  requestAnimationFrame(loop);
})();
