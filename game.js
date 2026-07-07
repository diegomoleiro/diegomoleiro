(() => {
  'use strict';

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const container = document.getElementById('game-container');
  const scoreEl = document.getElementById('score');
  const livesEl = document.getElementById('lives');
  const startScreen = document.getElementById('startScreen');
  const gameOverScreen = document.getElementById('gameOverScreen');
  const finalScoreEl = document.getElementById('finalScore');
  const startBtn = document.getElementById('startBtn');
  const restartBtn = document.getElementById('restartBtn');

  let W = 0, H = 0, DPR = 1;

  function resize() {
    const rect = container.getBoundingClientRect();
    DPR = window.devicePixelRatio || 1;
    W = rect.width;
    H = rect.height;
    canvas.width = W * DPR;
    canvas.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  window.addEventListener('resize', resize);
  resize();

  // ---------- Game state ----------
  const STATE = { MENU: 'menu', PLAYING: 'playing', OVER: 'over' };
  let state = STATE.MENU;

  const player = {
    w: 44, h: 40,
    x: 0, y: 0,
    speed: 420,
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
  let stars = [];
  let wave = 1;
  let enemyDir = 1;
  let enemyDropTimer = 0;

  let keys = { left: false, right: false, fire: false };
  let pointerDown = false;
  let pointerX = null;

  function resetPlayer() {
    player.x = W / 2 - player.w / 2;
    player.y = H - player.h - 26;
    player.lives = 3;
    player.invuln = 0;
    player.fireCooldown = 0;
  }

  function initStars() {
    stars = [];
    for (let i = 0; i < 80; i++) {
      stars.push({
        x: Math.random() * W,
        y: Math.random() * H,
        r: Math.random() * 1.6 + 0.4,
        speed: Math.random() * 60 + 20,
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
    const speedBoost = 1 + (wave - 1) * 0.12;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        enemies.push({
          x: marginX + c * spacingX + spacingX / 2 - 16,
          y: startY + r * spacingY,
          w: 32, h: 28,
          alive: true,
          shootCooldown: Math.random() * 3 + 1,
          type: r % 3,
          speedBoost,
        });
      }
    }
    enemyDir = 1;
    enemyDropTimer = 0;
  }

  function startGame() {
    score = 0;
    wave = 1;
    bullets = [];
    enemyBullets = [];
    particles = [];
    resetPlayer();
    buildWave();
    initStars();
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
    livesEl.textContent = 'Vidas: ' + '❤️'.repeat(Math.max(player.lives, 0));
  }

  // ---------- Input ----------
  window.addEventListener('keydown', (e) => {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = true;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = true;
    if (e.code === 'Space') { keys.fire = true; e.preventDefault(); }
  });
  window.addEventListener('keyup', (e) => {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = false;
    if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = false;
    if (e.code === 'Space') keys.fire = false;
  });

  function pointerFromEvent(e) {
    const rect = canvas.getBoundingClientRect();
    const t = e.touches ? e.touches[0] : e;
    return t.clientX - rect.left;
  }

  function onPointerDown(e) {
    pointerDown = true;
    pointerX = pointerFromEvent(e);
    e.preventDefault();
  }
  function onPointerMove(e) {
    if (!pointerDown) return;
    pointerX = pointerFromEvent(e);
    e.preventDefault();
  }
  function onPointerUp(e) {
    pointerDown = false;
    pointerX = null;
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

  function spawnExplosion(x, y, color) {
    for (let i = 0; i < 14; i++) {
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
    // stars
    for (const s of stars) {
      s.y += s.speed * dt;
      if (s.y > H) { s.y = 0; s.x = Math.random() * W; }
    }

    if (state !== STATE.PLAYING) return;

    // player movement
    let moveDir = 0;
    if (keys.left) moveDir -= 1;
    if (keys.right) moveDir += 1;

    if (pointerDown && pointerX !== null) {
      const targetX = pointerX - player.w / 2;
      const dx = targetX - player.x;
      player.x += dx * Math.min(1, dt * 12);
    } else {
      player.x += moveDir * player.speed * dt;
    }
    player.x = Math.max(6, Math.min(W - player.w - 6, player.x));

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

    // enemy formation movement
    let hitEdge = false;
    const aliveEnemies = enemies.filter(e => e.alive);
    const formSpeed = (40 + wave * 6);
    for (const e of aliveEnemies) {
      e.x += enemyDir * formSpeed * e.speedBoost * dt;
      if (e.x < 10 || e.x + e.w > W - 10) hitEdge = true;
    }
    if (hitEdge) {
      enemyDir *= -1;
      enemyDropTimer = 0.25;
    }
    if (enemyDropTimer > 0) {
      enemyDropTimer -= dt;
      for (const e of aliveEnemies) e.y += 30 * dt;
    }

    // enemy shooting
    for (const e of aliveEnemies) {
      e.shootCooldown -= dt;
      if (e.shootCooldown <= 0) {
        spawnEnemyBullet(e);
        e.shootCooldown = Math.random() * (4.5 - Math.min(wave * 0.2, 3)) + 1.5;
      }
      if (e.y + e.h >= player.y) {
        endGame();
      }
    }

    // collisions: player bullets vs enemies
    for (const b of bullets) {
      for (const e of aliveEnemies) {
        if (!e.alive) continue;
        if (rectsOverlap(b, e)) {
          e.alive = false;
          b.dead = true;
          score += 10 * wave;
          spawnExplosion(e.x + e.w / 2, e.y + e.h / 2, '#ffcc00');
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
  function drawShip(x, y, w, h, color, glow) {
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2);
    ctx.shadowColor = glow || color;
    ctx.shadowBlur = 12;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, -h / 2);
    ctx.lineTo(w / 2, h / 2);
    ctx.lineTo(0, h / 3);
    ctx.lineTo(-w / 2, h / 2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawEnemy(e) {
    const colors = ['#ff3b6e', '#7c4dff', '#00e5a8'];
    ctx.save();
    ctx.translate(e.x + e.w / 2, e.y + e.h / 2);
    ctx.rotate(Math.PI);
    ctx.shadowColor = colors[e.type];
    ctx.shadowBlur = 10;
    ctx.fillStyle = colors[e.type];
    ctx.beginPath();
    ctx.moveTo(0, -e.h / 2);
    ctx.lineTo(e.w / 2, e.h / 2);
    ctx.lineTo(0, e.h / 3);
    ctx.lineTo(-e.w / 2, e.h / 2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    // stars
    ctx.fillStyle = '#ffffff';
    for (const s of stars) {
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    if (state !== STATE.PLAYING) return;

    // player
    if (player.invuln <= 0 || Math.floor(player.invuln * 12) % 2 === 0) {
      drawShip(player.x, player.y, player.w, player.h, '#00e5ff', '#00e5ff');
    }

    // enemies
    for (const e of enemies) drawEnemy(e);

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

  function loop(timestamp) {
    if (lastTime === null) lastTime = timestamp;
    let dt = (timestamp - lastTime) / 1000;
    dt = Math.min(dt, 0.05);
    lastTime = timestamp;

    update(dt);
    draw();

    requestAnimationFrame(loop);
  }

  initStars();
  requestAnimationFrame(loop);
})();
