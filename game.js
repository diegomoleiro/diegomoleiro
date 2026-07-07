(() => {
  'use strict';

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const container = document.getElementById('game-container');
  const scoreEl = document.getElementById('score');
  const ammoEl = document.getElementById('ammo');
  const levelEl = document.getElementById('level');
  const livesEl = document.getElementById('lives');
  const startScreen = document.getElementById('startScreen');
  const gameOverScreen = document.getElementById('gameOverScreen');
  const finalScoreEl = document.getElementById('finalScore');
  const startBtn = document.getElementById('startBtn');
  const restartBtn = document.getElementById('restartBtn');
  const gradeSelect = document.getElementById('gradeSelect');
  const quizScreen = document.getElementById('quizScreen');
  const quizTitle = document.getElementById('quizTitle');
  const quizProgress = document.getElementById('quizProgress');
  const quizQuestion = document.getElementById('quizQuestion');
  const quizOptions = document.getElementById('quizOptions');
  const quizFeedback = document.getElementById('quizFeedback');
  const abilityScreen = document.getElementById('abilityScreen');
  const abilityCards = document.getElementById('abilityCards');

  let W = 0, H = 0, DPR = 1;
  const GROUND_MARGIN = 20;
  const PATCH_GROWTH_TIME = 14;
  const BASE_SPEED = 380;

  const fieldCanvas = document.createElement('canvas');
  const fieldCtx = fieldCanvas.getContext('2d');

  function resize() {
    const rect = container.getBoundingClientRect();
    DPR = window.devicePixelRatio || 1;
    W = rect.width;
    H = rect.height;
    canvas.width = W * DPR;
    canvas.height = H * DPR;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    fieldCanvas.width = W;
    fieldCanvas.height = H;
    buildField();
  }
  window.addEventListener('resize', resize);

  // ---------- Game state ----------
  const STATE = { MENU: 'menu', PLAYING: 'playing', ABILITY: 'ability', QUIZ: 'quiz', OVER: 'over' };
  let state = STATE.MENU;
  let schoolGrade = null;
  let gradeTier = 'inicial';

  const player = {
    w: 58, h: 44,
    x: 0, y: 0,
    speed: BASE_SPEED,
    tilt: 0,
    fireCooldown: 0,
    fireRate: 0.22,
    lives: 3,
    invuln: 0,
    ammo: 30,
    maxAmmo: 30,
    slowTimer: 0,
    slowFx: 0,
    shotPattern: 'single',
  };

  let score = 0;
  let bullets = [];        // corn kernels
  let enemyBullets = [];   // crow pecks
  let enemies = [];        // crows
  let grasshoppers = [];   // agile pests
  let hearts = [];         // extra-life pickups
  let gifts = [];          // mystery bonus-question pickups
  let patches = [];        // side corn plots to harvest for ammo
  let particles = [];
  let clouds = [];
  let wave = 1;
  let phase = 1;
  let phaseBannerTimer = 0;
  let enemyDir = 1;
  let enemyDropTimer = 0;
  let grasshopperSpawnTimer = 4;
  let giftSpawnTimer = 18;
  let elapsed = 0;

  let keys = { left: false, right: false, up: false, down: false, fire: false };
  let pointerDown = false;
  let pointerX = null;
  let pointerY = null;

  // ---------- Ability system ----------
  const ABILITIES = [
    {
      id: 'life', icon: '❤️', name: 'Vida Extra',
      desc: 'Ganhe +1 coração de vida.',
      apply: () => { player.lives += 1; },
    },
    {
      id: 'agility', icon: '⚡', name: 'Mais Agilidade',
      desc: 'A colheitadeira fica mais rápida.',
      apply: () => { player.speed *= 1.18; },
    },
    {
      id: 'double', icon: '🌽🌽', name: 'Tiro Duplo',
      desc: 'Atira 2 grãos retos ao mesmo tempo.',
      apply: () => { player.shotPattern = 'double'; },
    },
    {
      id: 'tripleDiag', icon: '↖️🌽↗️', name: 'Tiro Triplo Diagonal',
      desc: 'Atira 3 grãos: um reto e dois na diagonal.',
      apply: () => { player.shotPattern = 'tripleDiagonal'; },
    },
    {
      id: 'tripleStraight', icon: '🌽🌽🌽', name: 'Tiro Triplo Reto',
      desc: 'Atira 3 grãos retos ao mesmo tempo.',
      apply: () => { player.shotPattern = 'tripleStraight'; },
    },
  ];

  function shotCost() {
    if (player.shotPattern === 'double') return 2;
    if (player.shotPattern === 'tripleStraight' || player.shotPattern === 'tripleDiagonal') return 3;
    return 1;
  }

  function openAbilitySelection() {
    state = STATE.ABILITY;
    const pool = [...ABILITIES];
    const first = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
    const second = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
    abilityCards.innerHTML = '';
    [first, second].forEach(ab => {
      const card = document.createElement('div');
      card.className = 'ability-card';
      card.innerHTML = `<h3>${ab.icon}</h3><h3>${ab.name}</h3><p>${ab.desc}</p>`;
      card.addEventListener('click', () => chooseAbility(ab));
      abilityCards.appendChild(card);
    });
    abilityScreen.classList.remove('hidden');
  }

  function chooseAbility(ab) {
    ab.apply();
    updateHud();
    abilityScreen.classList.add('hidden');
    advanceWave();
    state = STATE.PLAYING;
  }

  function advanceWave() {
    wave += 1;
    const newPhase = phaseForWave(wave);
    if (newPhase !== phase) {
      phase = newPhase;
      phaseBannerTimer = 2.6;
      spawnPhaseHearts();
    }
    buildWave();
  }

  // ---------- School quiz system ----------
  const QUESTION_BANK = {
    inicial: {
      normal: [
        { q: 'Quanto é 4 + 5?', options: ['7', '9', '10', '8'], correct: 1 },
        { q: 'Quanto é 10 - 3?', options: ['6', '7', '8', '5'], correct: 1 },
        { q: 'Qual destas palavras é um substantivo?', options: ['Correr', 'Bonito', 'Cachorro', 'Rapidamente'], correct: 2 },
        { q: 'Quantas patas tem um cachorro?', options: ['2', '4', '6', '8'], correct: 1 },
        { q: 'Quanto é 3 x 3?', options: ['6', '9', '12', '3'], correct: 1 },
        { q: 'O que as plantas precisam para crescer?', options: ['Só água', 'Água, luz e ar', 'Só terra', 'Só luz'], correct: 1 },
        { q: 'Qual é o plural de "flor"?', options: ['Flors', 'Floris', 'Flores', 'Flor'], correct: 2 },
        { q: 'Em que planeta nós vivemos?', options: ['Marte', 'Terra', 'Lua', 'Sol'], correct: 1 },
      ],
      hard: [
        { q: 'Quanto é 7 x 8?', options: ['54', '56', '64', '48'], correct: 1 },
        { q: 'Qual é o antônimo de "grande"?', options: ['Enorme', 'Gigante', 'Pequeno', 'Alto'], correct: 2 },
        { q: 'Qual órgão bombeia o sangue no corpo?', options: ['Pulmão', 'Coração', 'Estômago', 'Fígado'], correct: 1 },
        { q: 'Quantos lados tem um hexágono?', options: ['5', '6', '7', '8'], correct: 1 },
        { q: 'Qual é a capital do Brasil?', options: ['Rio de Janeiro', 'São Paulo', 'Brasília', 'Salvador'], correct: 2 },
      ],
    },
    final: {
      normal: [
        { q: 'Quanto é 15% de 200?', options: ['20', '30', '25', '40'], correct: 1 },
        { q: 'Qual classe gramatical é a palavra "rapidamente"?', options: ['Substantivo', 'Adjetivo', 'Advérbio', 'Verbo'], correct: 2 },
        { q: 'Quantos ossos tem o corpo humano adulto, aproximadamente?', options: ['106', '206', '306', '406'], correct: 1 },
        { q: 'Em que ano o Brasil foi descoberto pelos portugueses?', options: ['1500', '1822', '1889', '1600'], correct: 0 },
        { q: 'Qual é o resultado de 2³?', options: ['6', '8', '9', '4'], correct: 1 },
        { q: 'Qual é o maior oceano do mundo?', options: ['Atlântico', 'Índico', 'Pacífico', 'Ártico'], correct: 2 },
        { q: 'Qual é o plural correto de "cidadão"?', options: ['Cidadãos', 'Cidadães', 'Cidadões', 'Cidadão'], correct: 0 },
        { q: 'Qual gás os seres humanos precisam respirar para viver?', options: ['Gás carbônico', 'Oxigênio', 'Nitrogênio', 'Hidrogênio'], correct: 1 },
      ],
      hard: [
        { q: 'Se x + 5 = 12, quanto vale x?', options: ['5', '6', '7', '8'], correct: 2 },
        { q: 'Quem proclamou a independência do Brasil?', options: ['Tiradentes', 'Dom Pedro I', 'Dom Pedro II', 'Getúlio Vargas'], correct: 1 },
        { q: 'Qual é a menor unidade da vida?', options: ['Átomo', 'Célula', 'Molécula', 'Tecido'], correct: 1 },
        { q: 'Qual é o maior país da América do Sul?', options: ['Argentina', 'Brasil', 'Peru', 'Colômbia'], correct: 1 },
        { q: 'Quanto é a raiz quadrada de 81?', options: ['7', '8', '9', '10'], correct: 2 },
      ],
    },
    medio: {
      normal: [
        { q: 'A fórmula de Bhaskara é usada para resolver:', options: ['Equações do 1º grau', 'Equações do 2º grau', 'Sistemas lineares', 'Logaritmos'], correct: 1 },
        { q: 'Qual é a unidade de força no Sistema Internacional?', options: ['Watt', 'Joule', 'Newton', 'Pascal'], correct: 2 },
        { q: 'Qual é o símbolo químico do ouro?', options: ['Ag', 'Au', 'Fe', 'Pb'], correct: 1 },
        { q: 'Qual é a função das mitocôndrias na célula?', options: ['Produzir energia', 'Armazenar água', 'Fazer fotossíntese', 'Guardar DNA'], correct: 0 },
        { q: 'Em que período ocorreu a Segunda Guerra Mundial?', options: ['1914-1918', '1939-1945', '1929-1933', '1945-1950'], correct: 1 },
        { q: 'Quem escreveu "Dom Casmurro"?', options: ['José de Alencar', 'Machado de Assis', 'Carlos Drummond', 'Clarice Lispector'], correct: 1 },
        { q: 'Quanto é log10(100)?', options: ['1', '2', '10', '100'], correct: 1 },
        { q: 'Qual é o maior deserto do mundo em área?', options: ['Saara', 'Antártico', 'Arábico', 'Gobi'], correct: 1 },
      ],
      hard: [
        { q: 'Qual é a fórmula da segunda lei de Newton?', options: ['F=m/a', 'F=ma', 'F=m+a', 'F=a/m'], correct: 1 },
        { q: 'Quantos elétrons tem um átomo neutro de carbono (Z=6)?', options: ['4', '6', '8', '12'], correct: 1 },
        { q: 'Qual é a derivada de x²?', options: ['x', '2x', 'x²', '2'], correct: 1 },
        { q: 'Qual é o processo de divisão celular usado na reprodução das células do corpo?', options: ['Mitose', 'Fotossíntese', 'Respiração', 'Digestão'], correct: 0 },
        { q: 'Quem foi o primeiro presidente do Brasil?', options: ['Getúlio Vargas', 'Deodoro da Fonseca', 'Juscelino Kubitschek', 'Dom Pedro II'], correct: 1 },
      ],
    },
  };

  function tierForGrade(grade) {
    const fundamentalI = ['1º ano', '2º ano', '3º ano', '4º ano', '5º ano'];
    const fundamentalII = ['6º ano', '7º ano', '8º ano', '9º ano'];
    if (fundamentalI.includes(grade)) return 'inicial';
    if (fundamentalII.includes(grade)) return 'final';
    return 'medio';
  }

  function sampleQuestions(tier, difficulty, count) {
    const pool = [...QUESTION_BANK[tier][difficulty]];
    const picked = [];
    while (picked.length < count && pool.length > 0) {
      const idx = Math.floor(Math.random() * pool.length);
      picked.push(pool.splice(idx, 1)[0]);
    }
    return picked;
  }

  const quiz = { mode: 'lifeline', pool: [], index: 0, correct: 0 };

  function startLifelineQuiz() {
    if (state === STATE.QUIZ && quiz.mode === 'lifeline') return;
    state = STATE.QUIZ;
    quiz.mode = 'lifeline';
    quiz.pool = sampleQuestions(gradeTier, 'normal', 5);
    quiz.index = 0;
    quiz.correct = 0;
    quizTitle.textContent = '📚 Hora do Quiz!';
    quizScreen.classList.remove('hidden');
    showQuizQuestion();
  }

  function startGiftQuiz() {
    state = STATE.QUIZ;
    quiz.mode = 'gift';
    quiz.pool = sampleQuestions(gradeTier, 'hard', 1);
    quiz.index = 0;
    quiz.correct = 0;
    quizTitle.textContent = '🎁 Pergunta Bônus!';
    quizScreen.classList.remove('hidden');
    showQuizQuestion();
  }

  function showQuizQuestion() {
    const q = quiz.pool[quiz.index];
    quizProgress.textContent = quiz.mode === 'lifeline'
      ? `Pergunta ${quiz.index + 1}/${quiz.pool.length} • Acertos: ${quiz.correct}`
      : 'Acerte para destruir todos os corvos da tela!';
    quizQuestion.textContent = q.q;
    quizFeedback.textContent = '';
    quizOptions.innerHTML = '';

    const correctText = q.options[q.correct];
    const shuffled = [...q.options];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    shuffled.forEach(optText => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = optText;
      btn.addEventListener('click', () => handleQuizAnswer(btn, optText === correctText));
      quizOptions.appendChild(btn);
    });
  }

  function handleQuizAnswer(btn, isCorrect) {
    Array.from(quizOptions.children).forEach(b => { b.disabled = true; });
    btn.classList.add(isCorrect ? 'correct' : 'wrong');
    quizFeedback.textContent = isCorrect ? '✅ Certinho!' : '❌ Não foi dessa vez!';
    if (isCorrect) quiz.correct += 1;

    setTimeout(() => {
      quiz.index += 1;
      if (quiz.mode === 'lifeline') {
        if (quiz.index < quiz.pool.length) {
          showQuizQuestion();
        } else {
          finishLifelineQuiz();
        }
      } else {
        finishGiftQuiz(isCorrect);
      }
    }, 1200);
  }

  function finishLifelineQuiz() {
    quizOptions.innerHTML = '';
    quizQuestion.textContent = '';
    quizProgress.textContent = '';
    if (quiz.correct >= 3) {
      quizFeedback.textContent = `🎉 Você acertou ${quiz.correct}/5! Vidas recarregadas, de volta ao jogo!`;
      player.lives = 3;
      player.invuln = 1.5;
      enemyBullets = [];
      setTimeout(() => {
        quizScreen.classList.add('hidden');
        state = STATE.PLAYING;
        updateHud();
      }, 1800);
    } else {
      quizFeedback.textContent = `📉 Você acertou só ${quiz.correct}/5. Não foi dessa vez...`;
      setTimeout(() => {
        quizScreen.classList.add('hidden');
        endGame();
      }, 1800);
    }
  }

  function finishGiftQuiz(isCorrect) {
    quizOptions.innerHTML = '';
    quizQuestion.textContent = '';
    quizProgress.textContent = '';
    if (isCorrect) {
      quizFeedback.textContent = '💥 Isso! Todos os corvos foram embora!';
      for (const e of enemies) spawnExplosion(e.x + e.w / 2, e.y + e.h / 2, '#2b2b2b');
      score += enemies.length * 10 * wave;
      enemies = [];
    } else {
      quizFeedback.textContent = '💔 Resposta errada, você perdeu um coração...';
      player.lives -= 1;
    }
    setTimeout(() => {
      quizScreen.classList.add('hidden');
      updateHud();
      if (player.lives <= 0) {
        startLifelineQuiz();
      } else {
        state = STATE.PLAYING;
      }
    }, 1800);
  }

  function phaseForWave(w) {
    return Math.floor((w - 1) / 3) + 1;
  }

  // difficulty ramps normally through wave 3, then eases off so it doesn't
  // spike too hard/fast afterwards
  function difficultyWave() {
    return wave <= 3 ? wave : 3 + (wave - 3) * 0.4;
  }

  function playerMinY() { return 76; }
  function playerMaxY() { return H - GROUND_MARGIN - player.h - 6; }

  function resetPlayer() {
    player.x = W / 2 - player.w / 2;
    player.y = playerMaxY();
    player.tilt = 0;
    player.lives = 3;
    player.invuln = 0;
    player.fireCooldown = 0;
    player.ammo = player.maxAmmo;
    player.slowTimer = 0;
    player.slowFx = 0;
    player.speed = BASE_SPEED;
    player.shotPattern = 'single';
  }

  // ---------- Corn field background (baked onto an offscreen canvas so the
  // harvester leaves a permanent cut trail as it drives through the crop) ----------
  function drawCornStalk(c, x, y) {
    c.strokeStyle = '#2f6e21';
    c.lineWidth = 3;
    c.lineCap = 'round';
    c.beginPath(); c.moveTo(x, y); c.lineTo(x - 7, y - 9); c.stroke();
    c.beginPath(); c.moveTo(x, y); c.lineTo(x + 7, y - 9); c.stroke();
    c.strokeStyle = '#3f8a2c';
    c.beginPath(); c.moveTo(x, y); c.lineTo(x, y - 17); c.stroke();
    c.fillStyle = '#e8c144';
    c.beginPath();
    c.ellipse(x, y - 19, 3, 6, 0, 0, Math.PI * 2);
    c.fill();
  }

  function buildField() {
    if (W <= 0 || H <= 0) return;
    fieldCtx.fillStyle = '#4a8a2f';
    fieldCtx.fillRect(0, 0, W, H);

    const rowWidth = 32;
    for (let rx = 0, i = 0; rx < W; rx += rowWidth, i++) {
      fieldCtx.fillStyle = i % 2 === 0 ? 'rgba(0,0,0,0.05)' : 'rgba(255,255,255,0.04)';
      fieldCtx.fillRect(rx, 0, rowWidth, H);
    }

    for (let ry = 14; ry < H; ry += 28) {
      for (let rx = rowWidth / 2; rx < W; rx += rowWidth) {
        const jx = (Math.random() - 0.5) * 8;
        const jy = (Math.random() - 0.5) * 8;
        drawCornStalk(fieldCtx, rx + jx, ry + jy);
      }
    }
  }

  function cutField(x, y, w, h) {
    fieldCtx.save();
    fieldCtx.fillStyle = '#caa457';
    fieldCtx.beginPath();
    fieldCtx.ellipse(x, y, w / 2, h / 2, 0, 0, Math.PI * 2);
    fieldCtx.fill();
    fieldCtx.fillStyle = 'rgba(0,0,0,0.06)';
    for (let i = 0; i < 3; i++) {
      fieldCtx.beginPath();
      fieldCtx.arc(x + (Math.random() - 0.5) * w * 0.6, y + (Math.random() - 0.5) * h * 0.6, 1.4, 0, Math.PI * 2);
      fieldCtx.fill();
    }
    fieldCtx.restore();
  }

  function initClouds() {
    clouds = [];
    for (let i = 0; i < 4; i++) {
      clouds.push({
        x: Math.random() * W,
        y: Math.random() * H * 0.6,
        w: Math.random() * 90 + 70,
        h: Math.random() * 26 + 20,
        speed: Math.random() * 10 + 6,
      });
    }
  }

  // ---------- Side corn patches (ammo reload stations) ----------
  function initPatches() {
    patches = [
      { side: 'left', yFrac: 0.32, growth: 0, ripe: false },
      { side: 'left', yFrac: 0.68, growth: 0, ripe: false },
      { side: 'right', yFrac: 0.32, growth: 0, ripe: false },
      { side: 'right', yFrac: 0.68, growth: 0, ripe: false },
    ];
  }

  function patchRect(p) {
    const w = 34, h = 34;
    const x = p.side === 'left' ? 20 : W - 20 - w;
    const y = H * p.yFrac - h / 2;
    return { x, y, w, h };
  }

  function buildWave() {
    enemies = [];
    const dWave = difficultyWave();
    const cols = Math.min(6, 4 + Math.floor(dWave / 2));
    const rows = Math.min(4, 2 + Math.floor(dWave / 3));
    const marginX = 30;
    const spacingX = (W - marginX * 2) / cols;
    const spacingY = 46;
    const startY = 50;
    const speedBoost = (1 + (dWave - 1) * 0.1) * (1 + (phase - 1) * 0.12);
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

  function spawnPhaseHearts() {
    for (let i = 0; i < 2; i++) {
      hearts.push({
        x: Math.random() * (W - 50) + 25,
        y: -30 - i * 60,
        w: 22, h: 20,
        speed: Math.random() * 25 + 45,
        wobble: Math.random() * Math.PI * 2,
      });
    }
  }

  function spawnGrasshopper() {
    const nearSide = Math.random() < 0.55;
    let x;
    if (nearSide) {
      x = Math.random() < 0.5 ? Math.random() * 50 + 8 : W - Math.random() * 50 - 26;
    } else {
      x = Math.random() * (W - 40) + 20;
    }
    grasshoppers.push({
      x, y: -20, w: 18, h: 16,
      vx: 0, vy: 50,
      state: 'jump', timer: 0.3,
      alive: true,
    });
  }

  function spawnGift() {
    gifts.push({
      x: Math.random() * (W - 60) + 30,
      y: -30,
      w: 26, h: 26,
      speed: Math.random() * 20 + 35,
      wobble: Math.random() * Math.PI * 2,
    });
  }

  function startGame() {
    score = 0;
    wave = 1;
    phase = phaseForWave(wave);
    bullets = [];
    enemyBullets = [];
    particles = [];
    hearts = [];
    gifts = [];
    grasshoppers = [];
    grasshopperSpawnTimer = 4;
    giftSpawnTimer = Math.random() * 8 + 16;
    resetPlayer();
    buildWave();
    buildField();
    initClouds();
    initPatches();
    spawnPhaseHearts();
    updateHud();
    state = STATE.PLAYING;
    startScreen.classList.add('hidden');
    gameOverScreen.classList.add('hidden');
    quizScreen.classList.add('hidden');
    abilityScreen.classList.add('hidden');
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
    ammoEl.textContent = `🌽 ${player.ammo}/${player.maxAmmo}`;
    ammoEl.classList.toggle('empty', player.ammo === 0);
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

  startBtn.addEventListener('click', () => {
    const grade = gradeSelect.value;
    if (!grade) {
      gradeSelect.classList.add('invalid');
      gradeSelect.focus();
      return;
    }
    gradeSelect.classList.remove('invalid');
    schoolGrade = grade;
    gradeTier = tierForGrade(grade);
    startGame();
  });
  restartBtn.addEventListener('click', startGame);

  // ---------- Entities helpers ----------
  function spawnKernelAt(x, y, vx) {
    bullets.push({
      x: x - 3.5,
      y,
      w: 7, h: 10,
      speed: 620,
      vx: vx || 0,
    });
  }

  function fireShotPattern() {
    const cx = player.x + player.w / 2;
    const topY = player.y - 10;
    if (player.shotPattern === 'double') {
      spawnKernelAt(cx - 9, topY, 0);
      spawnKernelAt(cx + 9, topY, 0);
    } else if (player.shotPattern === 'tripleStraight') {
      spawnKernelAt(cx - 14, topY, 0);
      spawnKernelAt(cx, topY, 0);
      spawnKernelAt(cx + 14, topY, 0);
    } else if (player.shotPattern === 'tripleDiagonal') {
      spawnKernelAt(cx, topY, 0);
      spawnKernelAt(cx - 6, topY, -140);
      spawnKernelAt(cx + 6, topY, 140);
    } else {
      spawnKernelAt(cx, topY, 0);
    }
  }

  function spawnEnemyBullet(enemy) {
    enemyBullets.push({
      x: enemy.x + enemy.w / 2 - 3,
      y: enemy.y + enemy.h,
      w: 6, h: 9,
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

    // clouds drift regardless of game state
    for (const c of clouds) {
      c.x += c.speed * dt;
      if (c.x - c.w > W) { c.x = -c.w; c.y = Math.random() * H * 0.6; }
    }

    if (phaseBannerTimer > 0) phaseBannerTimer -= dt;

    if (state !== STATE.PLAYING) return;

    // player movement (free roam: left/right + forward/back), slowed by grasshoppers
    let moveDirX = 0, moveDirY = 0;
    if (keys.left) moveDirX -= 1;
    if (keys.right) moveDirX += 1;
    if (keys.up) moveDirY -= 1;
    if (keys.down) moveDirY += 1;

    if (player.slowTimer > 0) {
      player.slowTimer -= dt;
      player.slowFx -= dt;
      if (player.slowFx <= 0) {
        spawnExplosion(player.x + player.w / 2, player.y + player.h * 0.8, '#9fd456', 3);
        player.slowFx = 0.18;
      }
    }
    const speedMul = player.slowTimer > 0 ? 0.45 : 1;
    const smoothFactor = player.slowTimer > 0 ? 5 : 12;

    let desiredVX = moveDirX * player.speed * speedMul;

    if (pointerDown && pointerX !== null) {
      const targetX = pointerX - player.w / 2;
      const dx = targetX - player.x;
      desiredVX = dx * Math.min(1, dt * smoothFactor) / Math.max(dt, 0.001);
      player.x += dx * Math.min(1, dt * smoothFactor);
      const targetY = pointerY - player.h / 2;
      const dy = targetY - player.y;
      player.y += dy * Math.min(1, dt * smoothFactor);
    } else {
      player.x += moveDirX * player.speed * speedMul * dt;
      player.y += moveDirY * player.speed * speedMul * dt;
    }
    player.x = Math.max(6, Math.min(W - player.w - 6, player.x));
    player.y = Math.max(playerMinY(), Math.min(playerMaxY(), player.y));

    const targetTilt = Math.max(-1, Math.min(1, desiredVX / 300)) * 0.2;
    player.tilt += (targetTilt - player.tilt) * Math.min(1, dt * 8);

    // the harvester cuts a trail through the corn as it drives
    cutField(player.x + player.w / 2, player.y + player.h * 0.55, player.w * 1.35, player.h * 1.2);

    // firing: holding pointer down on canvas, or spacebar (limited ammo)
    player.fireCooldown -= dt;
    const cost = shotCost();
    const wantsFire = (pointerDown || keys.fire) && player.fireCooldown <= 0 && player.ammo >= cost;
    if (wantsFire) {
      fireShotPattern();
      player.ammo -= cost;
      player.fireCooldown = player.fireRate;
    }

    if (player.invuln > 0) player.invuln -= dt;

    // player bullets
    bullets.forEach(b => { b.y -= b.speed * dt; b.x += (b.vx || 0) * dt; });
    bullets = bullets.filter(b => b.y + b.h > 0 && b.x > -30 && b.x < W + 30);

    // enemy bullets
    enemyBullets.forEach(b => b.y += b.speed * dt);
    enemyBullets = enemyBullets.filter(b => b.y < H);

    // hearts (extra-life pickups)
    for (const h of hearts) {
      h.y += h.speed * dt;
      h.x += Math.sin(elapsed * 2 + h.wobble) * 18 * dt;
    }
    hearts = hearts.filter(h => h.y < H + 30);

    // mystery gifts (bonus question pickups)
    giftSpawnTimer -= dt;
    if (giftSpawnTimer <= 0) {
      spawnGift();
      giftSpawnTimer = Math.random() * 15 + 22;
    }
    for (const g of gifts) {
      g.y += g.speed * dt;
      g.x += Math.sin(elapsed * 1.6 + g.wobble) * 14 * dt;
    }
    gifts = gifts.filter(g => g.y < H + 30);

    // side corn patches: grow over time, slowed while a grasshopper sits on them
    for (const p of patches) {
      if (p.ripe) continue;
      const rect = patchRect(p);
      let rate = 1;
      for (const g of grasshoppers) {
        if (g.alive && rectsOverlap(rect, g)) { rate = 0.22; break; }
      }
      p.growth = Math.min(1, p.growth + (dt / PATCH_GROWTH_TIME) * rate);
      if (p.growth >= 1) p.ripe = true;
    }

    // grasshoppers: agile hop-and-pause movement
    grasshopperSpawnTimer -= dt;
    if (grasshopperSpawnTimer <= 0) {
      spawnGrasshopper();
      grasshopperSpawnTimer = Math.max(2.2, 7 - phase * 0.7) + Math.random() * 2;
    }
    for (const g of grasshoppers) {
      g.timer -= dt;
      if (g.state === 'jump') {
        g.x += g.vx * dt;
        g.y += g.vy * dt;
        if (g.timer <= 0) {
          g.state = 'pause';
          g.timer = Math.random() * 0.3 + 0.15;
        }
      } else if (g.timer <= 0) {
        const dx = (Math.random() - 0.5) * 170;
        const dy = Math.random() * 70 + 35;
        const dur = 0.22;
        g.vx = dx / dur;
        g.vy = dy / dur;
        g.state = 'jump';
        g.timer = dur;
      }
    }
    grasshoppers = grasshoppers.filter(g => g.alive && g.x > -40 && g.x < W + 40 && g.y < H + 40);

    // crow formation + organic swim movement (eased off after wave 3)
    let hitEdge = false;
    const aliveEnemies = enemies.filter(e => e.alive);
    const dWave = difficultyWave();
    const formSpeed = (40 + dWave * 5) * (1 + (phase - 1) * 0.12);
    const descendSpeed = (14 + dWave * 1.6) * (1 + (phase - 1) * 0.16);

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
        e.y += descendSpeed * 2 * dt;
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

    // crow attacks + ground invasion check
    const groundY = H - GROUND_MARGIN;
    for (const e of aliveEnemies) {
      e.shootCooldown -= dt;
      if (e.shootCooldown <= 0) {
        spawnEnemyBullet(e);
        e.shootCooldown = Math.random() * (4.5 - Math.min(wave * 0.2, 3)) + 1.5;
      }
      if (e.y + e.h >= groundY && state === STATE.PLAYING) {
        startLifelineQuiz();
      }
    }
    if (state !== STATE.PLAYING) { updateHud(); return; }

    // collisions: corn kernels vs crows and vs grasshoppers
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
            spawnExplosion(e.x + e.w / 2, e.y + e.h / 2, '#2b2b2b');
          } else {
            spawnExplosion(b.x, b.y, '#ffffff', 6);
          }
        }
      }
      if (b.dead) continue;
      for (const g of grasshoppers) {
        if (!g.alive || b.dead) continue;
        if (rectsOverlap(b, g)) {
          b.dead = true;
          g.alive = false;
          score += 5 * wave;
          spawnExplosion(g.x + g.w / 2, g.y + g.h / 2, '#9fd456', 8);
        }
      }
    }
    bullets = bullets.filter(b => !b.dead);
    enemies = enemies.filter(e => e.alive);
    grasshoppers = grasshoppers.filter(g => g.alive);

    // pickups: harvester drives over a heart -> +1 life
    for (const h of hearts) {
      if (rectsOverlap(player, h)) {
        h.dead = true;
        player.lives += 1;
        spawnExplosion(h.x + h.w / 2, h.y + h.h / 2, '#ff6b81', 10);
      }
    }
    hearts = hearts.filter(h => !h.dead);

    // pickups: harvester drives over a mystery gift -> bonus question
    for (const g of gifts) {
      if (rectsOverlap(player, g)) {
        g.dead = true;
        startGiftQuiz();
        break;
      }
    }
    gifts = gifts.filter(g => !g.dead);
    if (state !== STATE.PLAYING) { updateHud(); return; }

    // harvester drives over a ripe patch -> reload ammo
    for (const p of patches) {
      if (!p.ripe) continue;
      const rect = patchRect(p);
      if (rectsOverlap(player, rect)) {
        p.ripe = false;
        p.growth = 0;
        player.ammo = player.maxAmmo;
        spawnExplosion(rect.x + rect.w / 2, rect.y + rect.h / 2, '#ffd23f', 16);
      }
    }

    // harvester vs grasshopper (direct contact) -> slowed, no life lost
    for (const g of grasshoppers) {
      if (!g.alive) continue;
      if (rectsOverlap(player, g)) {
        g.alive = false;
        player.slowTimer = 3;
        spawnExplosion(g.x + g.w / 2, g.y + g.h / 2, '#9fd456', 8);
      }
    }
    grasshoppers = grasshoppers.filter(g => g.alive);

    // collisions: crow pecks vs harvester
    if (player.invuln <= 0) {
      for (const b of enemyBullets) {
        if (rectsOverlap(b, player)) {
          b.dead = true;
          hitPlayer();
        }
      }
      enemyBullets = enemyBullets.filter(b => !b.dead);

      // collisions: harvester vs crows (direct contact)
      for (const e of enemies) {
        if (!e.alive) continue;
        if (rectsOverlap(player, e)) {
          e.alive = false;
          spawnExplosion(e.x + e.w / 2, e.y + e.h / 2, '#2b2b2b');
          hitPlayer();
          break;
        }
      }
      enemies = enemies.filter(e => e.alive);
    }
    if (state !== STATE.PLAYING) { updateHud(); return; }

    // particles
    for (const p of particles) {
      p.age += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    particles = particles.filter(p => p.age < p.life);

    // wave clear -> choose an ability before the next wave begins
    if (enemies.length === 0) {
      openAbilitySelection();
    }

    updateHud();
  }

  function hitPlayer() {
    player.lives -= 1;
    player.invuln = 1.6;
    spawnExplosion(player.x + player.w / 2, player.y + player.h / 2, '#dff6ff');
    updateHud();
    if (player.lives <= 0) {
      startLifelineQuiz();
    }
  }

  // ---------- Draw ----------
  function drawHarvester(x, y, w, h, glow, tilt) {
    ctx.save();
    ctx.translate(x + w / 2, y + h / 2);
    ctx.rotate(tilt || 0);

    // rear unloading auger (drawn first, behind the body)
    ctx.strokeStyle = '#2b2b2b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, h * 0.3);
    ctx.lineTo(0, h * 0.62);
    ctx.stroke();
    ctx.fillStyle = '#2b2b2b';
    ctx.beginPath();
    ctx.arc(0, h * 0.62, 3, 0, Math.PI * 2);
    ctx.fill();

    // wheels
    ctx.fillStyle = '#161616';
    [-1, 1].forEach(side => {
      ctx.beginPath();
      ctx.arc(side * w * 0.3, -h * 0.12, h * 0.13, 0, Math.PI * 2);
      ctx.fill();
    });
    [-1, 1].forEach(side => {
      ctx.beginPath();
      ctx.arc(side * w * 0.24, h * 0.26, h * 0.09, 0, Math.PI * 2);
      ctx.fill();
    });

    // body hull
    const bodyW = w * 0.62;
    const bodyTop = -h * 0.22;
    const bodyBottom = h * 0.34;
    ctx.shadowColor = glow || '#bfeaff';
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#3f9142';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(-bodyW / 2, bodyTop, bodyW, bodyBottom - bodyTop, 7);
    else ctx.rect(-bodyW / 2, bodyTop, bodyW, bodyBottom - bodyTop);
    ctx.fill();

    // engine hood (rear, darker)
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#245a27';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(-bodyW * 0.34, h * 0.05, bodyW * 0.68, h * 0.24, 4);
    else ctx.rect(-bodyW * 0.34, h * 0.05, bodyW * 0.68, h * 0.24);
    ctx.fill();

    // cab window
    ctx.fillStyle = '#dff6ff';
    ctx.strokeStyle = '#2b8bb0';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(-bodyW * 0.26, -h * 0.14, bodyW * 0.52, h * 0.24, 3);
    else ctx.rect(-bodyW * 0.26, -h * 0.14, bodyW * 0.52, h * 0.24);
    ctx.fill();
    ctx.stroke();

    // corn header (front intake, wide + segmented, fires kernels from here)
    ctx.shadowColor = glow || '#bfeaff';
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#c9d3d8';
    ctx.beginPath();
    ctx.moveTo(-w * 0.5, -h * 0.22);
    ctx.lineTo(w * 0.5, -h * 0.22);
    ctx.lineTo(w * 0.4, -h * 0.44);
    ctx.lineTo(-w * 0.4, -h * 0.44);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#8a9aa0';
    ctx.lineWidth = 1;
    for (let i = -4; i <= 4; i++) {
      ctx.beginPath();
      ctx.moveTo(i * w * 0.1, -h * 0.22);
      ctx.lineTo(i * w * 0.08, -h * 0.44);
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawCrow(e) {
    const colors = ['#161616', '#eef1f3', '#8d949b'];
    const color = colors[e.type];
    const w = e.w, h = e.h;
    ctx.save();
    ctx.translate(e.x + w / 2, e.y + h / 2);
    ctx.shadowColor = e.type === 1 ? '#c7ccd1' : color;
    ctx.shadowBlur = 9;
    ctx.fillStyle = color;

    // tail feathers (top, opposite the beak which points down at the harvester)
    ctx.beginPath();
    ctx.moveTo(0, -h * 0.1);
    ctx.lineTo(-w * 0.2, -h * 0.56);
    ctx.lineTo(0, -h * 0.38);
    ctx.lineTo(w * 0.2, -h * 0.56);
    ctx.closePath();
    ctx.fill();

    // wings spread to the sides
    ctx.beginPath();
    ctx.moveTo(-w * 0.1, -h * 0.04);
    ctx.quadraticCurveTo(-w * 0.62, -h * 0.06, -w * 0.56, h * 0.22);
    ctx.quadraticCurveTo(-w * 0.28, h * 0.1, -w * 0.08, h * 0.14);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(w * 0.1, -h * 0.04);
    ctx.quadraticCurveTo(w * 0.62, -h * 0.06, w * 0.56, h * 0.22);
    ctx.quadraticCurveTo(w * 0.28, h * 0.1, w * 0.08, h * 0.14);
    ctx.closePath();
    ctx.fill();

    // body
    ctx.beginPath();
    ctx.ellipse(0, h * 0.05, w * 0.22, h * 0.34, 0, 0, Math.PI * 2);
    ctx.fill();
    if (e.type === 1) {
      ctx.strokeStyle = 'rgba(0,0,0,0.2)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }

    // head
    ctx.beginPath();
    ctx.arc(0, h * 0.32, w * 0.16, 0, Math.PI * 2);
    ctx.fill();
    if (e.type === 1) {
      ctx.strokeStyle = 'rgba(0,0,0,0.2)';
      ctx.stroke();
    }

    // beak
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#f5a623';
    ctx.beginPath();
    ctx.moveTo(-w * 0.07, h * 0.42);
    ctx.lineTo(0, h * 0.58);
    ctx.lineTo(w * 0.07, h * 0.42);
    ctx.closePath();
    ctx.fill();

    // eye
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(-w * 0.06, h * 0.28, w * 0.045, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(-w * 0.06, h * 0.28, w * 0.02, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function drawGrasshopper(g) {
    ctx.save();
    ctx.translate(g.x + g.w / 2, g.y + g.h / 2);
    const speed2 = g.vx * g.vx + g.vy * g.vy;
    const angle = speed2 > 4 ? Math.atan2(g.vy, g.vx) : Math.PI / 2;
    ctx.rotate(angle - Math.PI / 2);
    ctx.shadowColor = '#6fae2f';
    ctx.shadowBlur = 7;
    ctx.fillStyle = '#6fae2f';

    // body
    ctx.beginPath();
    ctx.ellipse(0, 0, g.w * 0.22, g.h * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // head
    ctx.beginPath();
    ctx.arc(0, -g.h * 0.42, g.w * 0.16, 0, Math.PI * 2);
    ctx.fill();

    // folded hind legs
    ctx.strokeStyle = '#4f8a1f';
    ctx.lineWidth = 2;
    [-1, 1].forEach(side => {
      ctx.beginPath();
      ctx.moveTo(side * g.w * 0.1, g.h * 0.1);
      ctx.lineTo(side * g.w * 0.45, g.h * 0.28);
      ctx.lineTo(side * g.w * 0.3, g.h * 0.55);
      ctx.stroke();
    });

    // antennae
    ctx.beginPath();
    ctx.moveTo(-g.w * 0.05, -g.h * 0.55);
    ctx.lineTo(-g.w * 0.2, -g.h * 0.75);
    ctx.moveTo(g.w * 0.05, -g.h * 0.55);
    ctx.lineTo(g.w * 0.2, -g.h * 0.75);
    ctx.stroke();

    ctx.restore();
  }

  function drawKernel(b) {
    ctx.save();
    ctx.translate(b.x + b.w / 2, b.y + b.h / 2);
    ctx.shadowColor = '#ffd23f';
    ctx.shadowBlur = 6;
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.ellipse(0, 0, b.w / 2, b.h / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath();
    ctx.ellipse(-b.w * 0.15, -b.h * 0.2, b.w * 0.18, b.h * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawPeck(b) {
    ctx.save();
    ctx.translate(b.x + b.w / 2, b.y + b.h / 2);
    ctx.rotate(0.4);
    ctx.shadowColor = '#2b2b2b';
    ctx.shadowBlur = 6;
    ctx.fillStyle = '#2b2b2b';
    ctx.beginPath();
    ctx.ellipse(0, 0, b.w / 2, b.h / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawHeart(h) {
    ctx.save();
    ctx.font = `${h.h + 8}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#ff4d6d';
    ctx.shadowBlur = 10;
    ctx.fillText('❤️', h.x + h.w / 2, h.y + h.h / 2);
    ctx.restore();
  }

  function drawGift(g) {
    ctx.save();
    const pulse = 1 + Math.sin(elapsed * 3 + g.wobble) * 0.08;
    ctx.font = `${(g.h + 10) * pulse}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#ffb347';
    ctx.shadowBlur = 14;
    ctx.fillText('🎁', g.x + g.w / 2, g.y + g.h / 2);
    ctx.restore();
  }

  function drawPatch(p) {
    const rect = patchRect(p);
    const cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2;

    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.28)';
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(cx, cy, rect.w * 0.62, rect.h * 0.62, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    const pulse = p.ripe ? 1 + Math.sin(elapsed * 4) * 0.08 : 1;
    const scale = (0.35 + p.growth * 0.65) * pulse;
    const stalkColor = p.ripe ? '#ffd23f' : (p.growth > 0.5 ? '#c9d15a' : '#2f6e21');

    ctx.save();
    ctx.translate(cx, cy);
    if (p.ripe) { ctx.shadowColor = '#ffd23f'; ctx.shadowBlur = 16; }
    for (let i = -1; i <= 1; i++) {
      ctx.strokeStyle = stalkColor;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(i * 8, rect.h * 0.3);
      ctx.lineTo(i * 8, rect.h * 0.3 - 22 * scale);
      ctx.stroke();
      if (p.growth > 0.25) {
        ctx.fillStyle = p.ripe ? '#ffe27a' : '#e8c144';
        ctx.beginPath();
        ctx.ellipse(i * 8, rect.h * 0.3 - 24 * scale, 3.2 * scale, 6.5 * scale, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawPhaseBanner() {
    if (phaseBannerTimer <= 0) return;
    const alpha = Math.min(1, phaseBannerTimer / 1.2);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff6d9';
    ctx.shadowColor = '#ffb347';
    ctx.shadowBlur = 18;
    ctx.font = 'bold 34px Trebuchet MS, Arial, sans-serif';
    ctx.fillText(`FASE ${phase}`, W / 2, H / 2 - 10);
    ctx.font = '16px Trebuchet MS, Arial, sans-serif';
    ctx.fillText('Mais corvos estão chegando...', W / 2, H / 2 + 20);
    ctx.restore();
  }

  function drawSky() {
    for (const c of clouds) {
      ctx.save();
      ctx.globalAlpha = 0.1;
      ctx.fillStyle = '#0a1a05';
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, c.w / 2, c.h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(fieldCanvas, 0, 0);
    drawSky();

    if (state === STATE.PLAYING || state === STATE.ABILITY || state === STATE.QUIZ) {
      // side corn patches
      for (const p of patches) drawPatch(p);

      // player
      if (player.invuln <= 0 || Math.floor(player.invuln * 12) % 2 === 0) {
        const glow = player.slowTimer > 0 ? '#9fd456' : '#bfeaff';
        drawHarvester(player.x, player.y, player.w, player.h, glow, player.tilt);
      }

      // crows + grasshoppers
      for (const e of enemies) drawCrow(e);
      for (const g of grasshoppers) drawGrasshopper(g);

      // hearts + gifts
      for (const h of hearts) drawHeart(h);
      for (const g of gifts) drawGift(g);

      // bullets
      for (const b of bullets) drawKernel(b);
      for (const b of enemyBullets) drawPeck(b);

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

      if (state === STATE.PLAYING) drawPhaseBanner();
    }
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
  initClouds();
  initPatches();
  requestAnimationFrame(loop);
})();
