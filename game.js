(() => {
  'use strict';

  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const container = document.getElementById('game-container');
  const scoreEl = document.getElementById('score');
  const ammoEl = document.getElementById('ammo');
  const powerupEl = document.getElementById('powerup');
  const shieldInfoEl = document.getElementById('shieldInfo');
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
  const quizExplanation = document.getElementById('quizExplanation');
  const quizContinueBtn = document.getElementById('quizContinueBtn');
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
    w: 47.9, h: 36.3,
    x: 0, y: 0,
    speed: BASE_SPEED,
    tilt: 0,
    fireCooldown: 0,
    fireRate: 0.22,
    lives: 5,
    maxLives: 10,
    invuln: 0,
    ammo: 60,
    maxAmmo: 60,
    slowTimer: 0,
    slowFx: 0,
    shotPattern: 'single',
    shieldHp: 0,
    shieldMax: 3,
    plowShields: 0,
  };

  let score = 0;
  let bullets = [];        // corn kernels
  let enemyBullets = [];   // crow pecks
  let enemies = [];        // crows
  let grasshoppers = [];   // agile pests
  let hearts = [];         // extra-life pickups
  let powerups = [];       // 💥✈️🧨 combat bonus pickups
  let patches = [];        // side corn plots to harvest for ammo
  let particles = [];
  let clouds = [];
  let wave = 1;
  let phase = 1;
  let phaseBannerTimer = 0;
  let enemyDir = 1;
  let enemyDropTimer = 0;
  let grasshopperSpawnTimer = 4;
  let powerupSpawnTimer = 20;
  let activePowerUp = null;      // only 'rojao' persists; others fire instantly
  let powerupLabel = '';
  let powerupPersistent = false;
  let powerupLabelTimer = 0;
  let plowAngle = 0;
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
      apply: () => { player.lives = Math.min(player.maxLives, player.lives + 1); },
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

  const PLOW_SHIELD_ABILITY = {
    id: 'plowShield', icon: '🛡️', name: 'Escudo Arado',
    desc: 'Adiciona um escudo giratório que rebate os tiros dos corvos (máx. 3).',
    apply: () => { player.plowShields = Math.min(3, player.plowShields + 1); },
  };

  function shotCost() {
    if (player.shotPattern === 'double') return 2;
    if (player.shotPattern === 'tripleStraight' || player.shotPattern === 'tripleDiagonal') return 3;
    return 1;
  }

  let abilityRestartMode = false; // true when the ability choice restarts the current wave instead of advancing to the next one

  function openAbilitySelection(restart) {
    state = STATE.ABILITY;
    abilityRestartMode = !!restart;
    const pool = [...ABILITIES];
    if (phase >= 5 && player.plowShields < 3) pool.push(PLOW_SHIELD_ABILITY);
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
    if (abilityRestartMode) {
      buildWave();
    } else {
      advanceWave();
    }
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

  // ---------- Combat bonus power-ups ----------
  const POWERUP_TYPES = ['burst', 'duster', 'rojao'];
  const POWERUP_ICONS = { burst: '💥', duster: '✈️', rojao: '🧨' };

  function setPowerupDisplay(text, persistent) {
    powerupLabel = text;
    powerupPersistent = persistent;
    powerupLabelTimer = persistent ? 0 : 1.8;
  }

  function fireRadialBurst() {
    const cx = player.x + player.w / 2;
    const cy = player.y + player.h / 2;
    const count = 8;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 / count) * i;
      bullets.push({
        x: cx - 3.5, y: cy - 5,
        w: 7, h: 10,
        vx: Math.cos(angle) * 480,
        vy: Math.sin(angle) * 480,
      });
    }
    spawnExplosion(cx, cy, '#ffd23f', 20);
  }

  function applyCropDuster() {
    for (const e of enemies) {
      if (e.alive) e.duststunned = 4;
    }
    spawnExplosion(player.x + player.w / 2, player.y - 20, '#dff6ff', 14);
  }

  function explodeCrow(e) {
    const radius = 55;
    const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
    spawnExplosion(cx, cy, '#ff8800', 18);
    for (const other of enemies) {
      if (!other.alive || other === e) continue;
      const ocx = other.x + other.w / 2, ocy = other.y + other.h / 2;
      if (Math.hypot(ocx - cx, ocy - cy) <= radius) {
        other.alive = false;
        score += 10 * wave;
        spawnExplosion(ocx, ocy, '#2b2b2b');
      }
    }
  }

  function activatePowerUp(type) {
    activePowerUp = null; // picking up any bonus clears whatever was active before
    if (type === 'burst') {
      fireRadialBurst();
      setPowerupDisplay('💥 Rajada de Milho!', false);
    } else if (type === 'duster') {
      applyCropDuster();
      setPowerupDisplay('✈️ Corvos atordoados!', false);
    } else if (type === 'rojao') {
      activePowerUp = 'rojao';
      setPowerupDisplay('🧨 Grão Rojão ativo', true);
    }
  }

  function spawnPowerupItem() {
    const type = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
    powerups.push({
      type,
      x: Math.random() * (W - 60) + 30,
      y: -30,
      w: 21.5, h: 21.5,
      speed: Math.random() * 20 + 35,
      wobble: Math.random() * Math.PI * 2,
    });
  }

  // ---------- School quiz system ----------
  const QUESTION_BANK = {
    inicial: {
      normal: [
        { q: 'Quanto é 7 + 5?', options: ['10', '11', '12', '13'], correct: 2, explanation: 'Somando 7 mais 5 chegamos a 12.' },
        { q: 'Quanto é 15 - 8?', options: ['5', '6', '7', '8'], correct: 2, explanation: 'Se tirarmos 8 de 15, sobram 7.' },
        { q: 'Quanto é 6 x 3?', options: ['16', '18', '20', '21'], correct: 1, explanation: '6 vezes 3 é o mesmo que somar 6 três vezes: 6+6+6=18.' },
        { q: 'Quanto é 20 ÷ 4?', options: ['4', '5', '6', '8'], correct: 1, explanation: '20 dividido por 4 dá 5, pois 5 x 4 = 20.' },
        { q: 'Qual número vem logo depois do 99?', options: ['98', '100', '101', '110'], correct: 1, explanation: 'Contando em ordem, depois do 99 vem o 100.' },
        { q: 'Quantos lados tem um triângulo?', options: ['2', '3', '4', '5'], correct: 1, explanation: 'O triângulo é uma figura geométrica que tem exatamente 3 lados.' },
        { q: 'Quantos lados tem um quadrado?', options: ['3', '4', '5', '6'], correct: 1, explanation: 'O quadrado tem 4 lados, todos do mesmo tamanho.' },
        { q: 'Quanto é a metade de 10?', options: ['2', '4', '5', '6'], correct: 2, explanation: 'Dividindo 10 em duas partes iguais, cada parte tem 5.' },
        { q: 'Qual é o dobro de 6?', options: ['8', '10', '12', '14'], correct: 2, explanation: 'O dobro de um número é ele somado com ele mesmo: 6+6=12.' },
        { q: 'Quanto é 100 - 50?', options: ['40', '45', '50', '60'], correct: 2, explanation: 'Se tirarmos 50 de 100, sobram exatamente 50.' },
        { q: 'Qual destes números é par?', options: ['3', '5', '2', '7'], correct: 2, explanation: 'O número 2 é par porque pode ser dividido em dois grupos iguais, sem sobrar nada.' },
        { q: 'Quantas horas tem um dia?', options: ['12', '20', '24', '30'], correct: 2, explanation: 'Um dia completo tem 24 horas.' },
        { q: 'Quantos dias tem uma semana?', options: ['5', '6', '7', '8'], correct: 2, explanation: 'Uma semana é formada por 7 dias, de domingo a sábado.' },
        { q: 'Qual fração representa a metade de um todo?', options: ['1/4', '1/2', '1/3', '2/2'], correct: 1, explanation: 'A fração 1/2 significa uma parte dividida em duas partes iguais, ou seja, a metade.' },
        { q: 'Quanto é 9 x 2?', options: ['16', '18', '20', '22'], correct: 1, explanation: '9 vezes 2 é o mesmo que 9+9, que é igual a 18.' },
        { q: 'Qual número é maior?', options: ['45', '54', '44', '40'], correct: 1, explanation: 'Comparando os números, 54 é maior porque tem 5 dezenas contra 4 dezenas do 45.' },
        { q: 'Quantos meses tem um ano?', options: ['10', '11', '12', '13'], correct: 2, explanation: 'Um ano é dividido em 12 meses, de janeiro a dezembro.' },
        { q: 'Quanto é 50 + 50?', options: ['90', '95', '100', '105'], correct: 2, explanation: 'Somando 50 com 50 chegamos a 100.' },
        { q: 'Qual é o nome da figura geométrica totalmente redonda?', options: ['Quadrado', 'Triângulo', 'Círculo', 'Retângulo'], correct: 2, explanation: 'O círculo é a figura geométrica que tem formato redondo, sem pontas.' },
        { q: 'Quantos centímetros tem 1 metro?', options: ['10', '50', '100', '1000'], correct: 2, explanation: 'Um metro equivale a 100 centímetros.' },
        { q: 'Quanto é 8 - 8?', options: ['0', '1', '8', '16'], correct: 0, explanation: 'Quando tiramos um número dele mesmo, o resultado é sempre 0.' },
        { q: 'Qual destes números é ímpar?', options: ['4', '6', '8', '9'], correct: 3, explanation: 'O número 9 é ímpar porque não pode ser dividido em dois grupos exatamente iguais.' },
        { q: 'Qual destas palavras é um substantivo?', options: ['Correr', 'Bonito', 'Cachorro', 'Rapidamente'], correct: 2, explanation: 'Cachorro é um substantivo porque nomeia um ser, um animal.' },
        { q: 'Quantas vogais tem a palavra \'amor\'?', options: ['1', '2', '3', '4'], correct: 1, explanation: 'Na palavra \'amor\' as vogais são o \'a\' e o \'o\', totalizando 2.' },
        { q: 'Qual é o plural de \'flor\'?', options: ['Flors', 'Floris', 'Flores', 'Florzinhas'], correct: 2, explanation: 'O plural de palavras terminadas em \'r\' geralmente é feito acrescentando \'es\': flor vira flores.' },
        { q: 'Qual destas letras é uma vogal?', options: ['B', 'C', 'A', 'D'], correct: 2, explanation: 'As vogais do nosso alfabeto são A, E, I, O, U, e a letra A está entre as opções.' },
        { q: 'Complete: \'O menino ___ feliz.\'', options: ['Está', 'Estão', 'Estar', 'Estavam'], correct: 0, explanation: 'Como \'o menino\' é uma pessoa só, usamos o verbo no singular: \'está\'.' },
        { q: 'Qual é o diminutivo de \'casa\'?', options: ['Casona', 'Casarão', 'Casinha', 'Casebre'], correct: 2, explanation: 'O diminutivo indica algo pequeno, e \'casinha\' é o diminutivo de casa.' },
        { q: 'Qual destas palavras está escrita corretamente?', options: ['Mininu', 'Minino', 'Meninu', 'Menino'], correct: 3, explanation: 'A forma correta de escrever essa palavra é \'menino\'.' },
        { q: 'Qual é o antônimo (contrário) de \'grande\'?', options: ['Enorme', 'Pequeno', 'Alto', 'Largo'], correct: 1, explanation: 'Antônimo é a palavra de sentido oposto, e o oposto de \'grande\' é \'pequeno\'.' },
        { q: 'Qual é o sinônimo de \'feliz\'?', options: ['Triste', 'Bravo', 'Alegre', 'Cansado'], correct: 2, explanation: 'Sinônimo é uma palavra com o mesmo significado, e \'alegre\' quer dizer o mesmo que \'feliz\'.' },
        { q: 'Quantas sílabas tem a palavra \'bola\'?', options: ['1', '2', '3', '4'], correct: 1, explanation: 'A palavra \'bola\' se divide em \'bo-la\', ou seja, 2 sílabas.' },
        { q: 'Qual destas palavras é um verbo?', options: ['Mesa', 'Correr', 'Azul', 'Livro'], correct: 1, explanation: 'Verbo é a palavra que indica ação, e \'correr\' representa uma ação.' },
        { q: 'Qual é o plural de \'animal\'?', options: ['Animals', 'Animales', 'Animais', 'Animalzinhos'], correct: 2, explanation: 'Palavras terminadas em \'al\' geralmente trocam o \'l\' por \'is\' no plural: animal vira animais.' },
        { q: 'Complete: \'Eu ___ para a escola todos os dias.\'', options: ['Vai', 'Vou', 'Vamos', 'Vão'], correct: 1, explanation: 'Quando falamos de nós mesmos (eu), usamos \'vou\', a forma correta do verbo ir.' },
        { q: 'Qual sinal de pontuação usamos no final de uma pergunta?', options: ['Ponto final', 'Vírgula', 'Ponto de interrogação', 'Ponto de exclamação'], correct: 2, explanation: 'O ponto de interrogação (?) é usado para indicar que uma frase é uma pergunta.' },
        { q: 'Qual é o feminino de \'menino\'?', options: ['Menino', 'Menina', 'Meninu', 'Meninão'], correct: 1, explanation: 'O feminino de \'menino\' é \'menina\'.' },
        { q: 'Qual destas palavras é escrita com \'ç\'?', options: ['Cabesa', 'Cabeça', 'Cabeza', 'Kabeça'], correct: 1, explanation: 'A forma correta é \'cabeça\', escrita com a letra ç (cê-cedilha).' },
        { q: 'Qual é o aumentativo de \'casa\'?', options: ['Casinha', 'Casita', 'Casarão', 'Casebre pequeno'], correct: 2, explanation: 'O aumentativo indica algo grande, e \'casarão\' é o aumentativo de casa.' },
        { q: 'Qual letra vem logo depois do \'M\' no alfabeto?', options: ['L', 'N', 'O', 'K'], correct: 1, explanation: 'Na ordem do alfabeto, depois do M vem o N.' },
        { q: 'Qual destas frases é uma pergunta?', options: ['Eu fui à escola.', 'Vá à escola.', 'Você vai à escola?', 'A escola é longe.'], correct: 2, explanation: 'A frase \'Você vai à escola?\' termina com ponto de interrogação, por isso é uma pergunta.' },
        { q: 'Qual é o sinônimo de \'rápido\'?', options: ['Lento', 'Veloz', 'Parado', 'Fraco'], correct: 1, explanation: '\'Veloz\' tem o mesmo significado de \'rápido\'.' },
        { q: 'Quantas letras tem o alfabeto da língua portuguesa usado no Brasil hoje?', options: ['23', '24', '25', '26'], correct: 3, explanation: 'Com as letras K, W e Y incluídas, o nosso alfabeto tem 26 letras.' },
        { q: 'Qual é o plural de \'papel\'?', options: ['Papeis', 'Papéis', 'Papels', 'Papelzinhos'], correct: 1, explanation: 'Palavras terminadas em \'l\' com som de \'éu\' formam plural trocando por \'is\': papel vira papéis.' },
        { q: 'Qual é o órgão do corpo humano responsável por bombear o sangue?', options: ['Pulmão', 'Cérebro', 'Coração', 'Fígado'], correct: 2, explanation: 'O coração é o órgão que bombeia o sangue para todo o corpo.' },
        { q: 'Em qual estado físico a água se encontra quando é gelo?', options: ['Líquido', 'Gasoso', 'Sólido', 'Plasma'], correct: 2, explanation: 'O gelo é água no estado sólido, pois está bem dura e com forma definida.' },
        { q: 'Qual planeta é conhecido como o \'planeta vermelho\'?', options: ['Vênus', 'Marte', 'Júpiter', 'Saturno'], correct: 1, explanation: 'Marte é chamado de planeta vermelho por causa da cor avermelhada do seu solo.' },
        { q: 'Qual é o maior planeta do Sistema Solar?', options: ['Terra', 'Saturno', 'Júpiter', 'Netuno'], correct: 2, explanation: 'Júpiter é o maior planeta do Sistema Solar, muito maior que a Terra.' },
        { q: 'Qual parte da planta é responsável por absorver água do solo?', options: ['Folha', 'Flor', 'Raiz', 'Caule'], correct: 2, explanation: 'A raiz fica embaixo da terra e absorve água e nutrientes do solo.' },
        { q: 'Quantos pulmões tem o ser humano?', options: ['1', '2', '3', '4'], correct: 1, explanation: 'O ser humano possui 2 pulmões, usados para respirar.' },
        { q: 'Qual órgão do corpo humano usamos para enxergar?', options: ['Ouvidos', 'Olhos', 'Nariz', 'Boca'], correct: 1, explanation: 'Os olhos são os órgãos responsáveis pela visão.' },
        { q: 'Qual é o astro que fica no centro do Sistema Solar?', options: ['Lua', 'Terra', 'Sol', 'Marte'], correct: 2, explanation: 'O Sol fica no centro do Sistema Solar, e os planetas giram ao seu redor.' },
        { q: 'Qual é o satélite natural da Terra?', options: ['Sol', 'Lua', 'Marte', 'Vênus'], correct: 1, explanation: 'A Lua é o satélite natural que gira ao redor da Terra.' },
        { q: 'Como chamamos os animais que se alimentam apenas de plantas?', options: ['Carnívoros', 'Herbívoros', 'Onívoros', 'Predadores'], correct: 1, explanation: 'Herbívoros são os animais que comem apenas plantas, como a vaca e o coelho.' },
        { q: 'Como chamamos os animais que se alimentam de carne?', options: ['Herbívoros', 'Onívoros', 'Carnívoros', 'Vegetarianos'], correct: 2, explanation: 'Carnívoros são os animais que se alimentam principalmente de carne, como o leão.' },
        { q: 'Qual gás precisamos respirar para viver?', options: ['Gás carbônico', 'Oxigênio', 'Nitrogênio', 'Hidrogênio'], correct: 1, explanation: 'Respiramos o oxigênio do ar, que é essencial para o funcionamento do nosso corpo.' },
        { q: 'Qual é a estação do ano mais fria?', options: ['Verão', 'Outono', 'Inverno', 'Primavera'], correct: 2, explanation: 'O inverno é a estação do ano com as temperaturas mais baixas.' },
        { q: 'Qual animal é conhecido como o \'rei da selva\'?', options: ['Tigre', 'Leão', 'Elefante', 'Urso'], correct: 1, explanation: 'O leão é popularmente chamado de \'rei da selva\'.' },
        { q: 'Quantas patas tem uma aranha?', options: ['4', '6', '8', '10'], correct: 2, explanation: 'As aranhas são aracnídeos e possuem 8 patas.' },
        { q: 'Qual é o maior animal terrestre do mundo?', options: ['Girafa', 'Rinoceronte', 'Elefante', 'Hipopótamo'], correct: 2, explanation: 'O elefante é o maior animal que vive em terra firme.' },
        { q: 'De qual animal vem o leite que geralmente bebemos?', options: ['Cabra', 'Vaca', 'Ovelha', 'Búfala'], correct: 1, explanation: 'O leite mais consumido no dia a dia vem da vaca.' },
        { q: 'Qual órgão do corpo humano é responsável por comandar nossos pensamentos?', options: ['Coração', 'Estômago', 'Cérebro', 'Pulmão'], correct: 2, explanation: 'O cérebro é o órgão que controla nossos pensamentos e todo o corpo.' },
        { q: 'O que as abelhas produzem?', options: ['Leite', 'Mel', 'Seda', 'Lã'], correct: 1, explanation: 'As abelhas produzem o mel a partir do néctar das flores.' },
        { q: 'Como se chama o fenômeno em que a água evapora, forma nuvens e depois cai como chuva?', options: ['Ciclo da água', 'Ciclo das plantas', 'Ciclo solar', 'Ciclo do vento'], correct: 0, explanation: 'O ciclo da água descreve o caminho da água na natureza: evapora, forma nuvens e cai como chuva.' },
        { q: 'Sapos e rãs pertencem a qual grupo de animais?', options: ['Répteis', 'Anfíbios', 'Mamíferos', 'Peixes'], correct: 1, explanation: 'Sapos e rãs são anfíbios, animais que vivem tanto na água quanto na terra.' },
        { q: 'Quantos sentidos principais o corpo humano possui?', options: ['3', '4', '5', '6'], correct: 2, explanation: 'Os 5 sentidos são visão, audição, olfato, paladar e tato.' },
        { q: 'Quem foi o navegador que chegou ao Brasil em 1500?', options: ['Cristóvão Colombo', 'Pedro Álvares Cabral', 'Vasco da Gama', 'Fernão de Magalhães'], correct: 1, explanation: 'Pedro Álvares Cabral foi o navegador português que chegou ao Brasil em 1500.' },
        { q: 'Em que ano os portugueses chegaram ao Brasil?', options: ['1400', '1500', '1600', '1822'], correct: 1, explanation: 'Os portugueses chegaram ao território que hoje é o Brasil no ano de 1500.' },
        { q: 'Como eram chamados os primeiros habitantes do Brasil, antes da chegada dos portugueses?', options: ['Colonizadores', 'Indígenas', 'Bandeirantes', 'Escravos'], correct: 1, explanation: 'Os povos indígenas já viviam no Brasil muito antes da chegada dos portugueses.' },
        { q: 'Em que data comemoramos a Independência do Brasil?', options: ['21 de abril', '1º de maio', '7 de setembro', '15 de novembro'], correct: 2, explanation: 'A Independência do Brasil é comemorada em 7 de setembro.' },
        { q: 'Quem proclamou a Independência do Brasil, em 1822?', options: ['Dom João VI', 'Dom Pedro I', 'Dom Pedro II', 'Tiradentes'], correct: 1, explanation: 'Dom Pedro I proclamou a Independência do Brasil às margens do rio Ipiranga, em 1822.' },
        { q: 'Qual é a capital do Brasil atualmente?', options: ['Rio de Janeiro', 'São Paulo', 'Brasília', 'Salvador'], correct: 2, explanation: 'Brasília é a capital do Brasil desde 1960.' },
        { q: 'Qual cidade era a capital do Brasil antes de Brasília?', options: ['São Paulo', 'Salvador', 'Recife', 'Rio de Janeiro'], correct: 3, explanation: 'Antes de Brasília, a capital do Brasil era a cidade do Rio de Janeiro.' },
        { q: 'Quem foi o primeiro presidente do Brasil?', options: ['Dom Pedro II', 'Deodoro da Fonseca', 'Getúlio Vargas', 'Tiradentes'], correct: 1, explanation: 'Marechal Deodoro da Fonseca foi o primeiro presidente do Brasil, após a Proclamação da República.' },
        { q: 'Em que data é comemorado o Dia do Trabalho?', options: ['1º de maio', '12 de outubro', '7 de setembro', '25 de dezembro'], correct: 0, explanation: 'O Dia do Trabalho é comemorado em 1º de maio.' },
        { q: 'Qual é o nome da lei que aboliu a escravidão no Brasil?', options: ['Lei do Ventre Livre', 'Lei Áurea', 'Lei de Terras', 'Lei Sexagenária'], correct: 1, explanation: 'A Lei Áurea, assinada em 1888, aboliu a escravidão no Brasil.' },
        { q: 'Em que ano foi assinada a Lei Áurea?', options: ['1822', '1850', '1888', '1900'], correct: 2, explanation: 'A Lei Áurea foi assinada em 13 de maio de 1888.' },
        { q: 'Quem assinou a Lei Áurea, que libertou os escravos no Brasil?', options: ['Dom Pedro I', 'Dom Pedro II', 'Princesa Isabel', 'Getúlio Vargas'], correct: 2, explanation: 'A Princesa Isabel assinou a Lei Áurea em 1888.' },
        { q: 'Em que data é comemorado o Dia das Crianças no Brasil?', options: ['12 de outubro', '1º de junho', '25 de dezembro', '15 de outubro'], correct: 0, explanation: 'O Dia das Crianças é comemorado em 12 de outubro.' },
        { q: 'Como se chama a música que representa oficialmente o Brasil?', options: ['Hino Nacional', 'Samba Nacional', 'Canção do Brasil', 'Hino da Bandeira'], correct: 0, explanation: 'O Hino Nacional é a música oficial que representa o nosso país.' },
        { q: 'De qual país o Brasil foi colônia?', options: ['Espanha', 'Portugal', 'França', 'Holanda'], correct: 1, explanation: 'O Brasil foi colônia de Portugal por cerca de 300 anos.' },
        { q: 'Como se chama o processo em que o Brasil deixou de ser colônia de Portugal?', options: ['Abolição', 'República', 'Independência do Brasil', 'Descobrimento'], correct: 2, explanation: 'A Independência do Brasil foi o processo em que o país deixou de ser controlado por Portugal.' },
        { q: 'Em qual mês do ano de 1500 os portugueses chegaram ao Brasil?', options: ['Janeiro', 'Abril', 'Julho', 'Dezembro'], correct: 1, explanation: 'Os portugueses chegaram ao Brasil em abril de 1500.' },
        { q: 'Quem foi Tiradentes?', options: ['Um rei de Portugal', 'Um herói que lutou pela independência de Minas Gerais', 'O primeiro presidente do Brasil', 'Um navegador espanhol'], correct: 1, explanation: 'Tiradentes foi um dos líderes que lutaram por mais liberdade em Minas Gerais, sendo considerado um herói nacional.' },
        { q: 'Em que data é comemorado o feriado de Tiradentes?', options: ['21 de abril', '7 de setembro', '19 de abril', '1º de maio'], correct: 0, explanation: 'O feriado de Tiradentes é comemorado em 21 de abril.' },
        { q: 'Em que data é comemorado o Dia do Índio no Brasil?', options: ['19 de abril', '12 de outubro', '22 de abril', '7 de setembro'], correct: 0, explanation: 'O Dia do Índio é comemorado em 19 de abril, celebrando os povos indígenas do Brasil.' },
        { q: 'Quem foi Dom Pedro II?', options: ['O primeiro presidente do Brasil', 'O segundo imperador do Brasil', 'Um navegador português', 'O líder da Inconfidência Mineira'], correct: 1, explanation: 'Dom Pedro II foi o segundo e último imperador do Brasil.' },
        { q: 'De qual país vieram os primeiros europeus que chegaram ao Brasil?', options: ['Espanha', 'Portugal', 'Itália', 'Inglaterra'], correct: 1, explanation: 'Os primeiros europeus a chegar ao Brasil vieram de Portugal.' },
        { q: 'Quantos continentes existem no mundo?', options: ['4', '5', '6', '7'], correct: 2, explanation: 'Segundo a divisão usada nas escolas brasileiras, existem 6 continentes: América, África, Ásia, Europa, Oceania e Antártida.' },
        { q: 'Em qual continente o Brasil está localizado?', options: ['América do Norte', 'América do Sul', 'Europa', 'África'], correct: 1, explanation: 'O Brasil fica no continente da América do Sul.' },
        { q: 'Qual é o maior oceano do mundo?', options: ['Atlântico', 'Índico', 'Pacífico', 'Ártico'], correct: 2, explanation: 'O Oceano Pacífico é o maior e mais profundo oceano do planeta.' },
        { q: 'Qual é o rio mais extenso do Brasil?', options: ['Rio São Francisco', 'Rio Amazonas', 'Rio Tietê', 'Rio Paraná'], correct: 1, explanation: 'O Rio Amazonas é o rio mais extenso do Brasil e um dos maiores do mundo.' },
        { q: 'Qual é a maior floresta tropical do mundo?', options: ['Floresta Amazônica', 'Mata Atlântica', 'Floresta Negra', 'Floresta Boreal'], correct: 0, explanation: 'A Floresta Amazônica é a maior floresta tropical do mundo, localizada principalmente no Brasil.' },
        { q: 'Quantos estados tem o Brasil?', options: ['24', '25', '26', '27'], correct: 2, explanation: 'O Brasil é formado por 26 estados, além do Distrito Federal.' },
        { q: 'Qual é a capital do estado de Minas Gerais?', options: ['Ouro Preto', 'Belo Horizonte', 'Juiz de Fora', 'Uberlândia'], correct: 1, explanation: 'Belo Horizonte é a capital do estado de Minas Gerais.' },
        { q: 'Qual é a capital do estado da Bahia?', options: ['Feira de Santana', 'Ilhéus', 'Salvador', 'Vitória da Conquista'], correct: 2, explanation: 'Salvador é a capital do estado da Bahia.' },
        { q: 'Qual é o continente mais frio da Terra?', options: ['Europa', 'Ásia', 'Antártida', 'América do Norte'], correct: 2, explanation: 'A Antártida é o continente mais frio, coberto quase todo por gelo.' },
        { q: 'Qual é o deserto mais famoso do continente africano?', options: ['Deserto do Atacama', 'Deserto do Saara', 'Deserto de Gobi', 'Deserto da Arábia'], correct: 1, explanation: 'O Deserto do Saara, na África, é o maior deserto quente do mundo.' },
        { q: 'Quantas regiões tem o Brasil?', options: ['4', '5', '6', '7'], correct: 1, explanation: 'O Brasil é dividido em 5 regiões: Norte, Nordeste, Centro-Oeste, Sudeste e Sul.' },
        { q: 'Qual é o ponto cardeal oposto ao Norte?', options: ['Leste', 'Oeste', 'Sul', 'Nordeste'], correct: 2, explanation: 'O ponto cardeal oposto ao Norte é o Sul.' },
        { q: 'Qual movimento da Terra é responsável pelo dia e pela noite?', options: ['Translação', 'Rotação', 'Gravitação', 'Inclinação'], correct: 1, explanation: 'A rotação é o movimento em que a Terra gira em torno do seu próprio eixo, causando o dia e a noite.' },
        { q: 'Qual é o nome da linha imaginária que divide a Terra em Hemisfério Norte e Hemisfério Sul?', options: ['Linha do Equador', 'Meridiano de Greenwich', 'Linha do Horizonte', 'Trópico de Capricórnio'], correct: 0, explanation: 'A Linha do Equador é a linha imaginária que divide a Terra ao meio, entre os hemisférios Norte e Sul.' },
        { q: 'Qual oceano banha o litoral do Brasil?', options: ['Oceano Pacífico', 'Oceano Índico', 'Oceano Atlântico', 'Oceano Ártico'], correct: 2, explanation: 'O Brasil tem seu litoral banhado pelo Oceano Atlântico.' },
        { q: 'Qual é a montanha mais alta do mundo?', options: ['Monte Fuji', 'Monte Everest', 'Pico da Neblina', 'Aconcágua'], correct: 1, explanation: 'O Monte Everest, na Ásia, é a montanha mais alta do mundo.' },
        { q: 'Qual é o maior país do mundo em extensão de território?', options: ['China', 'Estados Unidos', 'Brasil', 'Rússia'], correct: 3, explanation: 'A Rússia é o país com o maior território do mundo.' },
        { q: 'Qual é a capital da França?', options: ['Londres', 'Paris', 'Madri', 'Roma'], correct: 1, explanation: 'Paris é a capital da França.' },
        { q: 'Qual estação do ano vem logo depois do verão?', options: ['Primavera', 'Inverno', 'Outono', 'Verão novamente'], correct: 2, explanation: 'Depois do verão vem o outono, uma estação mais amena e com folhas caindo das árvores.' },
        { q: 'Qual é a capital do Japão?', options: ['Pequim', 'Seul', 'Tóquio', 'Bangkok'], correct: 2, explanation: 'Tóquio é a capital do Japão.' },
        { q: 'Qual é a capital do estado do Rio de Janeiro?', options: ['Niterói', 'Rio de Janeiro', 'Petrópolis', 'Angra dos Reis'], correct: 1, explanation: 'A cidade do Rio de Janeiro é a capital do estado do Rio de Janeiro.' },
        { q: 'Em qual hemisfério está localizada a maior parte do território do Brasil?', options: ['Hemisfério Norte', 'Hemisfério Sul', 'Hemisfério Leste apenas', 'Hemisfério Oeste apenas'], correct: 1, explanation: 'A maior parte do Brasil está localizada no Hemisfério Sul, abaixo da Linha do Equador.' },
      ],
      hard: [
        { q: 'Quanto é 12 x 8?', options: ['86', '92', '96', '108'], correct: 2, explanation: 'Multiplicando 12 por 8 chegamos a 96.' },
        { q: 'Quanto é 144 ÷ 12?', options: ['10', '11', '12', '14'], correct: 2, explanation: '144 dividido por 12 é igual a 12, pois 12 x 12 = 144.' },
        { q: 'Qual número romano representa o número 10?', options: ['V', 'X', 'L', 'C'], correct: 1, explanation: 'Na numeração romana, o X representa o número 10.' },
        { q: 'Qual é a área de um quadrado cujo lado mede 4 cm?', options: ['8 cm²', '12 cm²', '16 cm²', '20 cm²'], correct: 2, explanation: 'A área do quadrado é lado x lado, então 4 x 4 = 16 cm².' },
        { q: 'Qual fração é equivalente a 2/4?', options: ['1/3', '1/2', '2/3', '3/4'], correct: 1, explanation: 'Simplificando 2/4 (dividindo o numerador e o denominador por 2), chegamos a 1/2.' },
        { q: 'Qual é o nome do substantivo coletivo usado para um grupo de abelhas?', options: ['Cardume', 'Manada', 'Enxame', 'Alcateia'], correct: 2, explanation: 'Enxame é o nome dado a um grupo de abelhas.' },
        { q: 'Qual é o plural correto da palavra \'cidadão\'?', options: ['Cidadãos', 'Cidadães', 'Cidadões', 'Cidadons'], correct: 0, explanation: 'O plural de \'cidadão\' é \'cidadãos\'.' },
        { q: 'Qual é o superlativo absoluto sintético da palavra \'grande\'?', options: ['Mais grande', 'Grandão', 'Grandíssimo', 'Muito grande'], correct: 2, explanation: 'O superlativo absoluto sintético é formado com um sufixo, como em \'grandíssimo\'.' },
        { q: 'Na frase \'O gato dorme no sofá\', qual é o sujeito?', options: ['Dorme', 'O gato', 'No sofá', 'Sofá'], correct: 1, explanation: 'O sujeito é quem pratica a ação, e nessa frase é \'o gato\' quem dorme.' },
        { q: 'Qual destas palavras é um advérbio de tempo?', options: ['Hoje', 'Bonito', 'Casa', 'Correr'], correct: 0, explanation: '\'Hoje\' indica quando algo acontece, por isso é um advérbio de tempo.' },
        { q: 'Como se chama o processo pelo qual as plantas produzem seu próprio alimento usando a luz do sol?', options: ['Respiração', 'Fotossíntese', 'Germinação', 'Polinização'], correct: 1, explanation: 'A fotossíntese é o processo em que as plantas usam a luz do sol, água e gás carbônico para produzir seu alimento.' },
        { q: 'Aproximadamente quantos ossos tem o corpo de um ser humano adulto?', options: ['106', '156', '206', '256'], correct: 2, explanation: 'O corpo humano adulto tem, em média, 206 ossos.' },
        { q: 'Qual é o nome da camada da atmosfera que protege a Terra dos raios solares prejudiciais?', options: ['Camada de ozônio', 'Estratosfera baixa', 'Camada de nitrogênio', 'Ionosfera'], correct: 0, explanation: 'A camada de ozônio protege a Terra, filtrando parte dos raios ultravioleta do Sol.' },
        { q: 'Qual é o menor osso do corpo humano?', options: ['Fêmur', 'Estribo', 'Costela', 'Falange'], correct: 1, explanation: 'O estribo, localizado no ouvido, é o menor osso do corpo humano.' },
        { q: 'Como se chama o processo em que a água líquida se transforma em vapor?', options: ['Condensação', 'Solidificação', 'Evaporação', 'Fusão'], correct: 2, explanation: 'A evaporação é a passagem da água do estado líquido para o estado gasoso (vapor).' },
        { q: 'Como se chamou o movimento liderado por Tiradentes, que buscava mais liberdade para Minas Gerais?', options: ['Revolta da Vacina', 'Inconfidência Mineira', 'Guerra dos Farrapos', 'Revolução Pernambucana'], correct: 1, explanation: 'A Inconfidência Mineira foi o movimento liderado por Tiradentes e outros mineiros em busca de mais liberdade.' },
        { q: 'Em que ano foi proclamada a República no Brasil?', options: ['1822', '1888', '1889', '1900'], correct: 2, explanation: 'A Proclamação da República no Brasil aconteceu em 1889.' },
        { q: 'Quem proclamou a República no Brasil?', options: ['Dom Pedro II', 'Marechal Deodoro da Fonseca', 'Getúlio Vargas', 'Tiradentes'], correct: 1, explanation: 'O Marechal Deodoro da Fonseca liderou a Proclamação da República em 1889.' },
        { q: 'Como se chamava a divisão de terras do Brasil colonial, doadas pelo rei de Portugal a nobres responsáveis por administrá-las?', options: ['Capitanias Hereditárias', 'Sesmarias Reais', 'Províncias Coloniais', 'Distritos Portugueses'], correct: 0, explanation: 'As Capitanias Hereditárias foram a primeira forma de divisão administrativa do Brasil colonial.' },
        { q: 'Qual é o nome do tratado que dividiu as terras recém-descobertas da América entre Portugal e Espanha?', options: ['Tratado de Madri', 'Tratado de Tordesilhas', 'Tratado de Utrecht', 'Tratado de Paris'], correct: 1, explanation: 'O Tratado de Tordesilhas, de 1494, dividiu as terras da América entre Portugal e Espanha.' },
        { q: 'Quantos países fazem fronteira terrestre com o Brasil?', options: ['7', '8', '10', '12'], correct: 2, explanation: 'O Brasil faz fronteira com 10 países da América do Sul, sendo o único que não faz fronteira apenas com Chile e Equador.' },
        { q: 'Qual é o famoso arquipélago brasileiro reconhecido como Patrimônio Mundial pela UNESCO?', options: ['Abrolhos', 'Fernando de Noronha', 'Ilha Grande', 'Ilhabela'], correct: 1, explanation: 'O arquipélago de Fernando de Noronha é reconhecido pela UNESCO como Patrimônio Mundial Natural.' },
        { q: 'Qual é a capital da Austrália?', options: ['Sydney', 'Melbourne', 'Camberra', 'Perth'], correct: 2, explanation: 'Muita gente pensa que é Sydney, mas a capital da Austrália é Camberra.' },
        { q: 'Qual é o movimento da Terra responsável pelas estações do ano?', options: ['Rotação', 'Translação', 'Revolução lunar', 'Gravitação'], correct: 1, explanation: 'A translação é o movimento em que a Terra gira ao redor do Sol, e é responsável pelas estações do ano.' },
        { q: 'Qual é o nome da grande cordilheira de montanhas que percorre o lado oeste da América do Sul?', options: ['Cordilheira dos Andes', 'Serra do Mar', 'Montanhas Rochosas', 'Serra da Mantiqueira'], correct: 0, explanation: 'A Cordilheira dos Andes é a extensa cadeia de montanhas que atravessa o lado oeste da América do Sul.' },
      ],
    },
    final: {
      normal: [
        { q: 'Quanto é 25% de 200?', options: ['25', '50', '75', '100'], correct: 1, explanation: '25% de 200 equivale a 0,25 x 200, que resulta em 50.' },
        { q: 'Qual é o resultado de 7 ao quadrado (7²)?', options: ['14', '49', '21', '77'], correct: 1, explanation: '7² significa 7 x 7, que é igual a 49.' },
        { q: 'Qual é a raiz quadrada de 81?', options: ['7', '8', '9', '10'], correct: 2, explanation: '9 x 9 = 81, logo a raiz quadrada de 81 é 9.' },
        { q: 'Resolva a equação x + 5 = 12. Qual é o valor de x?', options: ['5', '6', '7', '17'], correct: 2, explanation: 'Subtraindo 5 dos dois lados da equação, obtemos x = 7.' },
        { q: 'Qual é o perímetro de um quadrado de lado 6 cm?', options: ['12 cm', '18 cm', '24 cm', '36 cm'], correct: 2, explanation: 'O perímetro do quadrado é 4 vezes o lado, ou seja, 4 x 6 = 24 cm.' },
        { q: 'Qual é a área de um retângulo com base 8 cm e altura 5 cm?', options: ['13 cm²', '26 cm²', '40 cm²', '45 cm²'], correct: 2, explanation: 'A área do retângulo é base x altura, ou seja, 8 x 5 = 40 cm².' },
        { q: 'Qual é o valor de 3/4 em forma decimal?', options: ['0,25', '0,5', '0,75', '1,25'], correct: 2, explanation: 'Dividindo 3 por 4 obtemos 0,75.' },
        { q: 'Qual é o resultado de 2 elevado a 3 (2³)?', options: ['6', '8', '9', '12'], correct: 1, explanation: '2³ significa 2 x 2 x 2, que é igual a 8.' },
        { q: 'Um produto custa R$ 80 e recebe um desconto de 10%. Qual é o novo preço?', options: ['R$ 70', 'R$ 72', 'R$ 75', 'R$ 8'], correct: 1, explanation: '10% de 80 é 8; subtraindo do preço original, 80 - 8 = 72.' },
        { q: 'Qual é a soma dos ângulos internos de um triângulo?', options: ['90°', '180°', '270°', '360°'], correct: 1, explanation: 'A soma dos ângulos internos de qualquer triângulo é sempre 180°.' },
        { q: 'Qual é o mínimo múltiplo comum (MMC) entre 4 e 6?', options: ['8', '10', '12', '24'], correct: 2, explanation: 'Os múltiplos comuns de 4 e 6 incluem 12, 24...; o menor deles é 12.' },
        { q: 'Qual fração representa a metade de um todo?', options: ['1/4', '1/3', '1/2', '2/3'], correct: 2, explanation: 'A fração 1/2 representa exatamente a metade de um inteiro.' },
        { q: 'Quanto é 15% de 60?', options: ['6', '9', '12', '15'], correct: 1, explanation: '15% de 60 é 0,15 x 60, que é igual a 9.' },
        { q: 'Qual é o valor de x na equação 2x = 18?', options: ['6', '7', '9', '10'], correct: 2, explanation: 'Dividindo os dois lados por 2, obtemos x = 9.' },
        { q: 'Quantos lados tem um hexágono?', options: ['5', '6', '7', '8'], correct: 1, explanation: 'A palavra hexágono indica um polígono de 6 lados.' },
        { q: 'Qual é a média aritmética entre 4, 8 e 12?', options: ['6', '7', '8', '9'], correct: 2, explanation: 'Somando os valores (4+8+12=24) e dividindo por 3, obtemos 8.' },
        { q: 'Qual é o resultado de 100 dividido por 4?', options: ['20', '25', '30', '40'], correct: 1, explanation: '100 dividido por 4 é igual a 25.' },
        { q: 'Um triângulo com todos os lados de mesma medida é chamado de:', options: ['escaleno', 'isósceles', 'equilátero', 'retângulo'], correct: 2, explanation: 'O triângulo equilátero possui os três lados e os três ângulos iguais.' },
        { q: 'Qual é a raiz quadrada de 100?', options: ['8', '9', '10', '12'], correct: 2, explanation: '10 x 10 = 100, portanto a raiz quadrada de 100 é 10.' },
        { q: 'Quantos graus tem um ângulo reto?', options: ['45°', '90°', '180°', '360°'], correct: 1, explanation: 'Um ângulo reto mede exatamente 90°.' },
        { q: 'Qual é o resultado da expressão 10 - 3 x 2?', options: ['4', '7', '14', '17'], correct: 0, explanation: 'Pela ordem das operações, a multiplicação é feita primeiro (3x2=6), depois 10-6=4.' },
        { q: 'Qual dos números a seguir é primo?', options: ['4', '6', '9', '7'], correct: 3, explanation: '7 só é divisível por 1 e por ele mesmo, enquanto 4, 6 e 9 possuem outros divisores.' },
        { q: 'Qual é a classe gramatical da palavra \'rapidamente\' na frase \'Ele correu rapidamente\'?', options: ['substantivo', 'adjetivo', 'advérbio', 'verbo'], correct: 2, explanation: 'Advérbios modificam o verbo indicando circunstância; aqui, \'rapidamente\' indica o modo da ação.' },
        { q: 'Na frase \'O gato preto dormiu o dia todo\', qual palavra é o adjetivo?', options: ['gato', 'preto', 'dormiu', 'dia'], correct: 1, explanation: '\'Preto\' qualifica o substantivo \'gato\', sendo por isso um adjetivo.' },
        { q: 'Qual é o sinônimo de \'feliz\'?', options: ['triste', 'alegre', 'cansado', 'bravo'], correct: 1, explanation: '\'Alegre\' possui significado semelhante a \'feliz\'.' },
        { q: 'Qual é o antônimo de \'grande\'?', options: ['enorme', 'pequeno', 'alto', 'largo'], correct: 1, explanation: '\'Pequeno\' tem sentido oposto a \'grande\'.' },
        { q: 'Qual figura de linguagem está presente na frase \'Chorei rios de lágrimas\'?', options: ['metáfora', 'hipérbole', 'comparação', 'onomatopeia'], correct: 1, explanation: 'A hipérbole é um exagero proposital usado para enfatizar um sentimento.' },
        { q: 'Qual figura de linguagem aparece em \'Ela é como um sol\'?', options: ['metáfora', 'comparação', 'personificação', 'ironia'], correct: 1, explanation: 'O uso da palavra \'como\' caracteriza uma comparação entre dois elementos.' },
        { q: 'Qual é o plural correto de \'papel\'?', options: ['papels', 'papeles', 'papéis', 'papés'], correct: 2, explanation: 'Palavras terminadas em \'l\' geralmente formam o plural trocando o \'l\' por \'is\', resultando em \'papéis\'.' },
        { q: 'Qual frase está gramaticalmente correta quanto ao uso do verbo \'fazer\' indicando tempo decorrido?', options: ['Fazem dois anos que ele não vem aqui.', 'Faz dois anos que ele não vem aqui.', 'Fazerá dois anos que ele não vem aqui.', 'Fazendo dois anos que ele não vem aqui.'], correct: 1, explanation: 'O verbo \'fazer\' indicando tempo decorrido é impessoal e deve ficar sempre na terceira pessoa do singular.' },
        { q: 'Qual das palavras a seguir é um substantivo próprio?', options: ['cidade', 'Brasil', 'país', 'nação'], correct: 1, explanation: '\'Brasil\' é o nome específico de um país e, por isso, é um substantivo próprio, escrito com letra maiúscula.' },
        { q: 'Na frase \'Vou à escola\', qual é a função da preposição \'a\'?', options: ['liga duas orações', 'indica lugar ou direção', 'substitui um substantivo', 'qualifica o verbo'], correct: 1, explanation: 'A preposição \'a\' indica o destino ou direção do movimento expresso pelo verbo \'ir\'.' },
        { q: 'Assinale o verbo presente na frase \'As crianças brincam no parque\':', options: ['crianças', 'brincam', 'no', 'parque'], correct: 1, explanation: '\'Brincam\' é a palavra que indica a ação realizada pelas crianças, sendo portanto o verbo.' },
        { q: 'Qual das palavras a seguir é um pronome pessoal?', options: ['bonito', 'ela', 'correr', 'rapidamente'], correct: 1, explanation: '\'Ela\' substitui um nome (substantivo) e indica pessoa, sendo por isso um pronome pessoal.' },
        { q: 'A figura de linguagem chamada onomatopeia é usada para:', options: ['exagerar uma ideia', 'imitar sons', 'comparar dois elementos', 'dar vida a objetos'], correct: 1, explanation: 'A onomatopeia reproduz na escrita sons da natureza ou de objetos, como \'tique-taque\' ou \'miau\'.' },
        { q: 'Em qual alternativa todas as palavras estão acentuadas corretamente?', options: ['água, café, sofá', 'agua, cafe, sofa', 'água, cafê, sofà', 'agüa, café, sofá'], correct: 0, explanation: 'As palavras água, café e sofá seguem corretamente as regras de acentuação do português.' },
        { q: 'A personificação é a figura de linguagem que ocorre quando:', options: ['se atribuem características humanas a seres não humanos', 'se comparam dois seres usando conectivo', 'se exagera uma situação', 'se imita um som'], correct: 0, explanation: 'Na personificação, atribuem-se ações ou sentimentos humanos a objetos, animais ou fenômenos da natureza.' },
        { q: 'Qual é o antônimo de \'começar\'?', options: ['iniciar', 'terminar', 'continuar', 'abrir'], correct: 1, explanation: '\'Terminar\' expressa o sentido contrário de \'começar\'.' },
        { q: 'Na frase \'Maria e João foram ao cinema\', qual é o sujeito?', options: ['cinema', 'foram', 'Maria e João', 'ao'], correct: 2, explanation: '\'Maria e João\' são quem pratica a ação de ir ao cinema, formando o sujeito da oração.' },
        { q: 'Qual conjunção indica ideia de oposição entre duas ideias?', options: ['e', 'mas', 'ou', 'porque'], correct: 1, explanation: '\'Mas\' é uma conjunção adversativa, usada para contrapor ideias.' },
        { q: 'Qual é o plural correto de \'cidadão\'?', options: ['cidadãos', 'cidadães', 'cidadões', 'cidadons'], correct: 0, explanation: 'O plural de \'cidadão\' é \'cidadãos\', seguindo a regra das palavras terminadas em \'ão\' mais comuns.' },
        { q: 'A interjeição é a classe gramatical usada para expressar:', options: ['uma ação', 'uma qualidade', 'uma emoção repentina', 'uma quantidade'], correct: 2, explanation: 'Interjeições como \'Ah!\' e \'Puxa!\' expressam emoções ou reações repentinas.' },
        { q: 'Qual alternativa apresenta concordância verbal correta?', options: ['Os alunos chegou cedo.', 'Os alunos chegaram cedo.', 'Os aluno chegaram cedo.', 'Os alunos chega cedo.'], correct: 1, explanation: 'O verbo deve concordar em número e pessoa com o sujeito plural \'os alunos\', por isso \'chegaram\' é a forma correta.' },
        { q: 'Qual é o sinônimo de \'veloz\'?', options: ['lento', 'rápido', 'fraco', 'pesado'], correct: 1, explanation: '\'Rápido\' tem significado equivalente a \'veloz\'.' },
        { q: 'Qual é o principal órgão do sistema respiratório humano?', options: ['coração', 'pulmão', 'fígado', 'estômago'], correct: 1, explanation: 'O pulmão é o órgão responsável pelas trocas gasosas durante a respiração.' },
        { q: 'Qual é a função dos glóbulos vermelhos no sangue?', options: ['combater infecções', 'transportar oxigênio', 'coagular o sangue', 'produzir hormônios'], correct: 1, explanation: 'Os glóbulos vermelhos (hemácias) são responsáveis por transportar oxigênio pelo corpo.' },
        { q: 'Qual processo as plantas utilizam para produzir seu próprio alimento?', options: ['respiração', 'fotossíntese', 'fermentação', 'digestão'], correct: 1, explanation: 'Na fotossíntese, as plantas usam luz solar, água e gás carbônico para produzir glicose e oxigênio.' },
        { q: 'Qual é a menor unidade da vida?', options: ['átomo', 'célula', 'tecido', 'órgão'], correct: 1, explanation: 'A célula é considerada a menor unidade estrutural e funcional dos seres vivos.' },
        { q: 'Quais são os três principais estados físicos da matéria?', options: ['sólido, líquido e gasoso', 'quente, frio e morno', 'duro, mole e líquido', 'leve, pesado e médio'], correct: 0, explanation: 'A matéria pode se apresentar nos estados sólido, líquido e gasoso.' },
        { q: 'Qual órgão é responsável por bombear o sangue pelo corpo?', options: ['pulmão', 'cérebro', 'coração', 'rim'], correct: 2, explanation: 'O coração é o órgão muscular que bombeia o sangue por todo o corpo.' },
        { q: 'O que é um ecossistema?', options: ['apenas os animais de um lugar', 'o conjunto de seres vivos e o ambiente onde vivem', 'somente as plantas de uma região', 'um tipo de rocha'], correct: 1, explanation: 'Um ecossistema é formado pela interação entre seres vivos e o ambiente físico onde habitam.' },
        { q: 'Qual é a principal função dos rins no corpo humano?', options: ['digerir alimentos', 'filtrar o sangue e produzir urina', 'bombear sangue', 'produzir hormônios do crescimento'], correct: 1, explanation: 'Os rins filtram o sangue, removendo impurezas e produzindo a urina.' },
        { q: 'Qual gás os seres humanos liberam durante a respiração?', options: ['oxigênio', 'gás carbônico', 'hidrogênio', 'nitrogênio'], correct: 1, explanation: 'Durante a respiração, o corpo libera gás carbônico (CO2) como produto do metabolismo.' },
        { q: 'O que compõe basicamente uma cadeia alimentar?', options: ['apenas produtores', 'produtores, consumidores e decompositores', 'apenas predadores', 'apenas plantas e água'], correct: 1, explanation: 'Uma cadeia alimentar é formada por produtores, consumidores e decompositores, que transferem energia entre si.' },
        { q: 'Como se chama o processo de mudança do estado líquido para o gasoso?', options: ['condensação', 'solidificação', 'vaporização', 'fusão'], correct: 2, explanation: 'A vaporização é a passagem da matéria do estado líquido para o gasoso.' },
        { q: 'Quantos ossos, aproximadamente, tem o corpo humano adulto?', options: ['106', '156', '206', '306'], correct: 2, explanation: 'O esqueleto humano adulto possui, em média, 206 ossos.' },
        { q: 'Qual é a principal fonte de energia para a maioria dos ecossistemas da Terra?', options: ['a Lua', 'o Sol', 'o vento', 'a água'], correct: 1, explanation: 'O Sol fornece a energia luminosa usada pelas plantas na fotossíntese, base da maioria das cadeias alimentares.' },
        { q: 'O que são decompositores em um ecossistema?', options: ['seres que produzem seu próprio alimento', 'seres que decompõem matéria orgânica morta', 'animais que caçam outros animais', 'plantas que fazem fotossíntese'], correct: 1, explanation: 'Decompositores, como fungos e bactérias, quebram a matéria orgânica morta, devolvendo nutrientes ao solo.' },
        { q: 'Qual célula do sangue é responsável por defender o corpo contra infecções?', options: ['glóbulos vermelhos', 'glóbulos brancos', 'plaquetas', 'neurônios'], correct: 1, explanation: 'Os glóbulos brancos (leucócitos) fazem parte do sistema imunológico e combatem agentes infecciosos.' },
        { q: 'Qual órgão é responsável por controlar as ações e pensamentos do corpo humano?', options: ['coração', 'cérebro', 'pulmão', 'fígado'], correct: 1, explanation: 'O cérebro é o centro de controle do sistema nervoso, responsável por pensamentos e comandos motores.' },
        { q: 'O ciclo da água inclui, principalmente, as etapas de:', options: ['apenas evaporação e chuva', 'evaporação, condensação e precipitação', 'apenas condensação', 'fusão e solidificação'], correct: 1, explanation: 'O ciclo da água envolve evaporação, condensação e precipitação, entre outras etapas.' },
        { q: 'Qual é a diferença básica entre célula animal e célula vegetal?', options: ['só a célula animal tem núcleo', 'apenas a célula vegetal possui parede celular e cloroplastos', 'só a célula vegetal tem membrana', 'não há diferença'], correct: 1, explanation: 'A célula vegetal possui parede celular e cloroplastos, estruturas ausentes na célula animal.' },
        { q: 'O que é biodiversidade?', options: ['a variedade de seres vivos em um ambiente', 'apenas o número de árvores', 'a quantidade de água doce', 'o tipo de solo de uma região'], correct: 0, explanation: 'Biodiversidade é a variedade de espécies e formas de vida existentes em um determinado ambiente.' },
        { q: 'Qual sistema do corpo humano é responsável pela digestão dos alimentos?', options: ['sistema respiratório', 'sistema digestório', 'sistema circulatório', 'sistema nervoso'], correct: 1, explanation: 'O sistema digestório processa os alimentos, absorvendo nutrientes e eliminando resíduos.' },
        { q: 'Qual é a unidade que mede a força no Sistema Internacional de medidas?', options: ['joule', 'watt', 'newton', 'pascal'], correct: 2, explanation: 'A unidade de força no Sistema Internacional é o newton (N).' },
        { q: 'Em qual meio o som se propaga mais rapidamente?', options: ['no vácuo', 'no ar', 'na água', 'nos sólidos'], correct: 3, explanation: 'O som se propaga mais rápido nos sólidos, pois suas partículas estão mais próximas entre si.' },
        { q: 'Em que ano o Brasil foi \'descoberto\' pelos portugueses?', options: ['1400', '1500', '1600', '1822'], correct: 1, explanation: 'A chegada dos portugueses ao território que hoje é o Brasil ocorreu em 1500.' },
        { q: 'Quem proclamou a independência do Brasil?', options: ['Dom João VI', 'Dom Pedro I', 'Dom Pedro II', 'Getúlio Vargas'], correct: 1, explanation: 'Dom Pedro I proclamou a independência do Brasil às margens do rio Ipiranga.' },
        { q: 'Em que ano foi proclamada a independência do Brasil?', options: ['1808', '1822', '1889', '1500'], correct: 1, explanation: 'A independência do Brasil foi proclamada em 1822.' },
        { q: 'Qual foi o principal produto econômico do período colonial conhecido como \'ciclo do açúcar\'?', options: ['café', 'cana-de-açúcar', 'ouro', 'borracha'], correct: 1, explanation: 'Durante o ciclo do açúcar, a cana-de-açúcar foi o principal produto cultivado e exportado pelo Brasil colonial.' },
        { q: 'Quem assinou a Lei Áurea, que aboliu a escravidão no Brasil?', options: ['Dom Pedro I', 'Princesa Isabel', 'Deodoro da Fonseca', 'Getúlio Vargas'], correct: 1, explanation: 'A Princesa Isabel assinou a Lei Áurea em 1888, abolindo a escravidão no Brasil.' },
        { q: 'Em que ano foi assinada a Lei Áurea?', options: ['1850', '1871', '1888', '1891'], correct: 2, explanation: 'A Lei Áurea, que aboliu a escravidão no Brasil, foi assinada em 1888.' },
        { q: 'Quem proclamou a República no Brasil?', options: ['Dom Pedro II', 'Marechal Deodoro da Fonseca', 'Getúlio Vargas', 'Juscelino Kubitschek'], correct: 1, explanation: 'O Marechal Deodoro da Fonseca liderou a proclamação da República em 1889.' },
        { q: 'Quem foram os bandeirantes?', options: ['comerciantes europeus que só atuavam no litoral', 'exploradores que percorriam o interior do Brasil em busca de riquezas e escravizados indígenas', 'políticos do período republicano', 'líderes religiosos'], correct: 1, explanation: 'Os bandeirantes eram exploradores que se embrenhavam pelo interior do Brasil colonial em busca de riquezas e indígenas para escravizar.' },
        { q: 'O que foram as capitanias hereditárias?', options: ['divisões administrativas usadas por Portugal para colonizar o Brasil', 'tribos indígenas brasileiras', 'cidades fundadas pelos holandeses', 'embarcações usadas nas navegações'], correct: 0, explanation: 'As capitanias hereditárias foram faixas de terra divididas por Portugal e doadas a nobres para colonizar o Brasil.' },
        { q: 'Quem foi Getúlio Vargas?', options: ['um rei português', 'um presidente que governou o Brasil por várias décadas no século XX', 'o primeiro imperador do Brasil', 'um explorador do período colonial'], correct: 1, explanation: 'Getúlio Vargas foi um dos presidentes mais marcantes da história do Brasil, governando por longos períodos entre 1930 e 1954.' },
        { q: 'Em qual período histórico ocorreu a ditadura militar no Brasil?', options: ['1822-1889', '1889-1930', '1964-1985', '1500-1822'], correct: 2, explanation: 'A ditadura militar brasileira teve início em 1964 e durou até 1985.' },
        { q: 'Qual civilização antiga é conhecida pela construção das pirâmides e pelo uso de hieróglifos?', options: ['Grécia', 'Roma', 'Egito', 'Mesopotâmia'], correct: 2, explanation: 'O Egito Antigo construiu as grandes pirâmides e utilizava os hieróglifos como sistema de escrita.' },
        { q: 'Qual civilização antiga é considerada o berço da democracia?', options: ['Roma', 'Grécia', 'Egito', 'Pérsia'], correct: 1, explanation: 'A democracia surgiu na Grécia Antiga, especialmente na cidade de Atenas.' },
        { q: 'O Império Romano teve sua capital em qual cidade?', options: ['Atenas', 'Roma', 'Cartago', 'Alexandria'], correct: 1, explanation: 'A cidade de Roma era a capital e o centro político do Império Romano.' },
        { q: 'O que caracterizou o período conhecido como Idade Média na Europa?', options: ['predomínio do sistema feudal e forte influência da Igreja Católica', 'o início da era espacial', 'a Revolução Industrial', 'o surgimento da internet'], correct: 0, explanation: 'Na Idade Média, predominava o sistema feudal e a Igreja Católica exercia grande influência política e social.' },
        { q: 'A Revolução Francesa, iniciada em 1789, teve como lema:', options: ['Ordem e Progresso', 'Liberdade, Igualdade e Fraternidade', 'Paz e Amor', 'Deus, Pátria e Família'], correct: 1, explanation: 'O lema da Revolução Francesa era Liberdade, Igualdade e Fraternidade.' },
        { q: 'A Revolução Industrial, iniciada na Inglaterra, foi marcada principalmente por:', options: ['o fim da agricultura', 'a substituição do trabalho manual por máquinas nas fábricas', 'o início do comércio marítimo', 'a criação da moeda'], correct: 1, explanation: 'A Revolução Industrial trouxe a mecanização da produção, substituindo o trabalho manual por máquinas.' },
        { q: 'Quem foi Dom Pedro I?', options: ['o primeiro imperador do Brasil', 'o segundo imperador do Brasil', 'o primeiro presidente da República', 'o rei de Portugal durante a colonização'], correct: 0, explanation: 'Dom Pedro I foi o primeiro imperador do Brasil, governando de 1822 a 1831.' },
        { q: 'O Brasil foi colonizado por qual país europeu?', options: ['Espanha', 'Portugal', 'França', 'Holanda'], correct: 1, explanation: 'O Brasil foi colonizado por Portugal a partir de 1500.' },
        { q: 'Qual conflito armado envolveu Brasil, Argentina e Uruguai contra o Paraguai no século XIX?', options: ['Guerra dos Farrapos', 'Guerra do Paraguai', 'Guerra de Canudos', 'Revolta da Vacina'], correct: 1, explanation: 'A Guerra do Paraguai (1864-1870) envolveu a Tríplice Aliança (Brasil, Argentina e Uruguai) contra o Paraguai.' },
        { q: 'O que foi a Semana de Arte Moderna de 1922?', options: ['um evento esportivo', 'um evento cultural que renovou as artes brasileiras', 'uma guerra civil', 'uma eleição presidencial'], correct: 1, explanation: 'A Semana de Arte Moderna, realizada em São Paulo em 1922, trouxe novas ideias artísticas e culturais ao Brasil.' },
        { q: 'Quem eram os jesuítas que atuaram no Brasil colonial?', options: ['comerciantes de escravizados', 'padres católicos responsáveis pela catequização dos indígenas e pela educação', 'exploradores de ouro', 'soldados portugueses'], correct: 1, explanation: 'Os jesuítas eram padres católicos que catequizavam os indígenas e fundaram as primeiras escolas do Brasil colonial.' },
        { q: 'Qual é considerado o maior deserto frio do mundo?', options: ['Deserto do Saara', 'Deserto de Gobi', 'Continente Antártico', 'Deserto de Atacama'], correct: 2, explanation: 'Apesar de coberto de gelo, o continente antártico é classificado como o maior deserto frio do planeta devido à baixíssima precipitação.' },
        { q: 'Qual é o maior oceano do mundo?', options: ['Atlântico', 'Índico', 'Pacífico', 'Ártico'], correct: 2, explanation: 'O Oceano Pacífico é o maior e mais profundo oceano do planeta.' },
        { q: 'Qual é o maior país do mundo em extensão territorial?', options: ['China', 'Estados Unidos', 'Rússia', 'Canadá'], correct: 2, explanation: 'A Rússia é o país com a maior extensão territorial do mundo.' },
        { q: 'Qual é o rio mais extenso da América do Sul e um dos maiores do mundo?', options: ['rio São Francisco', 'rio Amazonas', 'rio Paraná', 'rio Tietê'], correct: 1, explanation: 'O rio Amazonas é o mais extenso e caudaloso rio da América do Sul.' },
        { q: 'Qual é a capital do Brasil?', options: ['Rio de Janeiro', 'São Paulo', 'Brasília', 'Salvador'], correct: 2, explanation: 'Brasília é a capital federal do Brasil desde 1960.' },
        { q: 'Qual bioma brasileiro abriga a maior floresta tropical do mundo?', options: ['Cerrado', 'Caatinga', 'Amazônia', 'Pampa'], correct: 2, explanation: 'O bioma Amazônia abriga a maior floresta tropical do planeta.' },
        { q: 'O que é uma planície, em geografia?', options: ['uma área elevada e plana', 'uma área baixa e plana', 'uma cadeia de montanhas', 'uma depressão profunda no oceano'], correct: 1, explanation: 'A planície é um relevo caracterizado por ser baixo e plano, geralmente próximo ao nível do mar.' },
        { q: 'O que caracteriza o clima equatorial?', options: ['temperaturas baixas e neve constante', 'chuvas abundantes e temperaturas altas o ano todo', 'estações bem definidas com invernos rigorosos', 'clima seco e desértico'], correct: 1, explanation: 'O clima equatorial é marcado por altas temperaturas e chuvas abundantes durante todo o ano.' },
        { q: 'Qual é o menor continente em extensão territorial?', options: ['Europa', 'Oceania', 'Antártida', 'América do Sul'], correct: 1, explanation: 'A Oceania é o continente de menor extensão territorial do planeta.' },
        { q: 'Qual linha imaginária divide a Terra em Hemisfério Norte e Hemisfério Sul?', options: ['Meridiano de Greenwich', 'Linha do Equador', 'Trópico de Câncer', 'Trópico de Capricórnio'], correct: 1, explanation: 'A Linha do Equador divide o planeta em Hemisfério Norte e Hemisfério Sul.' },
        { q: 'O que é uma escala cartográfica?', options: ['a cor usada em um mapa', 'a relação entre a distância no mapa e a distância real', 'o tamanho do papel do mapa', 'o nome do mapa'], correct: 1, explanation: 'A escala indica a proporção entre as medidas representadas no mapa e as medidas reais no terreno.' },
        { q: 'Qual país é conhecido por ter a Grande Muralha, uma das maiores construções humanas?', options: ['Japão', 'Índia', 'China', 'Coreia do Sul'], correct: 2, explanation: 'A Grande Muralha é uma construção histórica localizada na China.' },
        { q: 'Qual é o maior deserto quente do mundo?', options: ['Deserto do Saara', 'Deserto de Atacama', 'Deserto de Gobi', 'Deserto da Arábia'], correct: 0, explanation: 'O Deserto do Saara, na África, é o maior deserto quente do mundo.' },
        { q: 'O que caracteriza uma região montanhosa?', options: ['relevo baixo e plano', 'relevo elevado e acidentado', 'ausência total de vegetação', 'presença exclusiva de rios'], correct: 1, explanation: 'Regiões montanhosas apresentam relevo elevado e acidentado, com grandes variações de altitude.' },
        { q: 'Quais fatores principais definem o clima de uma região?', options: ['apenas a cor do solo', 'temperatura, umidade, pressão atmosférica e ventos', 'apenas a quantidade de habitantes', 'o nome do país'], correct: 1, explanation: 'O clima é definido por fatores como temperatura, umidade, pressão atmosférica e ventos ao longo do tempo.' },
        { q: 'Com quantos países da América do Sul o Brasil faz fronteira?', options: ['8', '9', '10', '12'], correct: 2, explanation: 'O Brasil faz fronteira com 10 países sul-americanos, sendo o único a não fazer fronteira apenas com Chile e Equador.' },
        { q: 'Qual é o continente mais populoso do mundo?', options: ['África', 'Ásia', 'Europa', 'América'], correct: 1, explanation: 'A Ásia concentra a maior parte da população mundial.' },
        { q: 'O que são coordenadas geográficas?', options: ['linhas que indicam apenas o relevo', 'valores de latitude e longitude que localizam um ponto na superfície terrestre', 'nomes de países', 'tipos de clima'], correct: 1, explanation: 'As coordenadas geográficas, formadas por latitude e longitude, permitem localizar qualquer ponto da superfície terrestre.' },
        { q: 'Qual é o bioma característico do Nordeste brasileiro, marcado pela vegetação seca e espinhosa?', options: ['Amazônia', 'Mata Atlântica', 'Caatinga', 'Pantanal'], correct: 2, explanation: 'A Caatinga é o bioma predominante no semiárido do Nordeste brasileiro, adaptado ao clima seco.' },
        { q: 'O que é urbanização?', options: ['o crescimento das áreas rurais', 'o processo de crescimento das cidades e da população urbana', 'a diminuição da população mundial', 'um tipo de clima'], correct: 1, explanation: 'A urbanização é o processo de expansão das cidades e aumento da população que vive em áreas urbanas.' },
        { q: 'Qual oceano banha o litoral brasileiro?', options: ['Oceano Pacífico', 'Oceano Índico', 'Oceano Atlântico', 'Oceano Ártico'], correct: 2, explanation: 'O litoral do Brasil é banhado pelo Oceano Atlântico.' },
        { q: 'Qual região brasileira concentra a maior população do país?', options: ['Norte', 'Nordeste', 'Sudeste', 'Centro-Oeste'], correct: 2, explanation: 'A região Sudeste é a mais populosa do Brasil, concentrando estados como São Paulo, Rio de Janeiro e Minas Gerais.' },
      ],
      hard: [
        { q: 'Qual é o resultado de (2³ + 3²) dividido por 5?', options: ['3', '3,4', '17', '5'], correct: 1, explanation: '2³ = 8 e 3² = 9, somando temos 17; dividindo por 5, o resultado é 3,4.' },
        { q: 'Qual é a área de um círculo de raio 4 cm (use π ≈ 3,14)?', options: ['12,56 cm²', '25,12 cm²', '50,24 cm²', '100,48 cm²'], correct: 2, explanation: 'A área do círculo é π x r², ou seja, 3,14 x 16 = 50,24 cm².' },
        { q: 'Se um trem percorre 240 km em 3 horas, qual é sua velocidade média?', options: ['60 km/h', '70 km/h', '80 km/h', '90 km/h'], correct: 2, explanation: 'Dividindo a distância pelo tempo, 240 km / 3 h = 80 km/h.' },
        { q: 'Qual é o valor de x na equação 3x - 4 = 2x + 5?', options: ['5', '7', '9', '11'], correct: 2, explanation: 'Isolando x, obtemos 3x - 2x = 5 + 4, portanto x = 9.' },
        { q: 'Quantas diagonais tem um pentágono (polígono de 5 lados)?', options: ['3', '4', '5', '6'], correct: 2, explanation: 'Usando a fórmula n(n-3)/2 com n=5, obtemos 5x2/2 = 5 diagonais.' },
        { q: 'Na frase \'O tempo, esse ladrão silencioso, rouba nossos momentos\', qual figura de linguagem se destaca?', options: ['comparação', 'metáfora', 'hipérbole', 'onomatopeia'], correct: 1, explanation: 'O tempo é diretamente chamado de \'ladrão\', sem uso de conectivo comparativo, caracterizando uma metáfora.' },
        { q: 'Qual é a função sintática do termo destacado em \'Precisamos de mais tempo\'?', options: ['sujeito', 'objeto direto', 'objeto indireto', 'predicativo'], correct: 2, explanation: 'O verbo \'precisar\' exige a preposição \'de\', formando um objeto indireto (\'de mais tempo\').' },
        { q: 'Assinale a alternativa em que a crase está empregada corretamente:', options: ['Vou a escola todos os dias.', 'Vou à escola todos os dias.', 'Vou há escola todos os dias.', 'Vou a à escola todos os dias.'], correct: 1, explanation: 'A crase indica a fusão da preposição \'a\' com o artigo feminino \'a\' que antecede a palavra \'escola\'.' },
        { q: 'Na frase \'Se eu tivesse dinheiro, viajaria pelo mundo\', o verbo \'tivesse\' está em qual tempo e modo verbal?', options: ['presente do indicativo', 'pretérito imperfeito do subjuntivo', 'futuro do subjuntivo', 'pretérito perfeito do indicativo'], correct: 1, explanation: 'O verbo expressa uma hipótese ou condição irreal, característica do pretérito imperfeito do subjuntivo.' },
        { q: 'Qual das frases a seguir apresenta um exemplo de linguagem conotativa (figurada)?', options: ['A água ferve a 100°C.', 'Ele comprou pão na padaria.', 'Seu coração é de pedra.', 'O ônibus chegou atrasado.'], correct: 2, explanation: 'A expressão \'coração de pedra\' usa sentido figurado para indicar frieza emocional, e não o sentido literal das palavras.' },
        { q: 'Qual organela é responsável pela produção de energia (ATP) na célula?', options: ['núcleo', 'mitocôndria', 'ribossomo', 'complexo de Golgi'], correct: 1, explanation: 'A mitocôndria é a organela responsável pela respiração celular e produção de energia na forma de ATP.' },
        { q: 'Qual é a principal diferença entre células procarióticas e eucarióticas?', options: ['procariontes têm núcleo definido e eucariontes não', 'procariontes não possuem núcleo organizado e eucariontes sim', 'ambas são idênticas em estrutura', 'apenas procariontes realizam fotossíntese'], correct: 1, explanation: 'As células procarióticas não possuem núcleo organizado por membrana, ao contrário das células eucarióticas.' },
        { q: 'Na cadeia alimentar, o que caracteriza um consumidor secundário?', options: ['produz seu próprio alimento', 'se alimenta diretamente de produtores', 'se alimenta de consumidores primários', 'decompõe matéria orgânica'], correct: 2, explanation: 'O consumidor secundário se alimenta dos consumidores primários (herbívoros), ficando um nível acima na cadeia alimentar.' },
        { q: 'Qual lei da física afirma que \'para toda ação existe uma reação de igual intensidade e direção oposta\'?', options: ['primeira lei de Newton', 'segunda lei de Newton', 'terceira lei de Newton', 'lei da gravitação universal'], correct: 2, explanation: 'Essa é a definição da terceira lei de Newton, conhecida como lei da ação e reação.' },
        { q: 'O que caracteriza uma reação química, diferenciando-a de uma transformação física?', options: ['apenas muda o estado físico da matéria', 'forma-se uma nova substância com propriedades diferentes', 'a massa desaparece por completo', 'não há qualquer alteração perceptível'], correct: 1, explanation: 'Em uma reação química, ocorre a formação de novas substâncias com propriedades diferentes das originais.' },
        { q: 'Qual foi a principal motivação econômica da Revolução Industrial na Inglaterra no século XVIII?', options: ['a busca por especiarias no Oriente', 'o acúmulo de capital e a necessidade de produção em maior escala', 'a expansão religiosa', 'a unificação política da Europa'], correct: 1, explanation: 'O acúmulo de capital pela burguesia e a necessidade de produzir mais mercadorias impulsionaram a mecanização da produção.' },
        { q: 'O Tratado de Tordesilhas, assinado em 1494, tinha como objetivo:', options: ['dividir as terras descobertas entre Portugal e Espanha', 'encerrar a Segunda Guerra Mundial', 'unificar a Itália', 'estabelecer a independência do Brasil'], correct: 0, explanation: 'O Tratado de Tordesilhas dividiu as terras recém-descobertas entre Portugal e Espanha por meio de uma linha imaginária.' },
        { q: 'O que caracterizou o período conhecido como \'Era Vargas\' no Brasil?', options: ['um curto mandato democrático sem mudanças relevantes', 'um longo período de governo marcado por centralização política e criação de leis trabalhistas', 'o fim da escravidão no Brasil', 'a chegada da família real portuguesa'], correct: 1, explanation: 'A Era Vargas foi marcada por um longo governo com forte centralização do poder e criação de importantes leis trabalhistas.' },
        { q: 'A Inconfidência Mineira, ocorrida em 1789, foi um movimento que:', options: ['buscava a independência do Brasil e contestava a cobrança de impostos por Portugal', 'apoiava a permanência total da coroa portuguesa', 'defendia a manutenção da escravidão a qualquer custo', 'tinha apoio total da Coroa portuguesa'], correct: 0, explanation: 'A Inconfidência Mineira foi um movimento separatista contra os altos impostos cobrados por Portugal, defendendo a independência.' },
        { q: 'Qual foi uma das principais consequências da Guerra Fria para a divisão política mundial?', options: ['unificação de todos os países sob um só governo', 'divisão do mundo em blocos capitalista (liderado pelos EUA) e socialista (liderado pela URSS)', 'fim de todas as guerras no mundo', 'criação da União Europeia como bloco militar'], correct: 1, explanation: 'A Guerra Fria dividiu o mundo em dois blocos ideológicos opostos: o capitalista, liderado pelos Estados Unidos, e o socialista, liderado pela URSS.' },
        { q: 'O que caracteriza o clima temperado, comum em partes da Europa e do sul do Brasil?', options: ['quatro estações bem definidas, com verões e invernos moderados', 'calor constante durante todo o ano', 'chuvas intensas e temperatura elevada o ano inteiro', 'ausência total de chuvas'], correct: 0, explanation: 'O clima temperado apresenta as quatro estações do ano bem definidas, com variações moderadas de temperatura.' },
        { q: 'Qual é a diferença entre tempo e clima em geografia?', options: ['são sinônimos e significam a mesma coisa', 'tempo é a condição atmosférica de curto prazo e clima é o padrão predominante em longo prazo', 'clima muda diariamente e tempo não muda', 'tempo se refere apenas à temperatura do solo'], correct: 1, explanation: 'O tempo atmosférico se refere às condições momentâneas, enquanto o clima é o padrão observado ao longo de muitos anos.' },
        { q: 'O que é o efeito estufa e por que ele é importante para a vida na Terra?', options: ['um fenômeno artificial sem função natural', 'o processo natural de retenção de calor pela atmosfera, que mantém a temperatura adequada à vida, mas que se intensifica pela ação humana', 'um tipo de poluição apenas visual', 'um fenômeno restrito exclusivamente aos polos'], correct: 1, explanation: 'O efeito estufa é um processo natural essencial à vida, mas vem sendo intensificado pela emissão excessiva de gases poluentes.' },
        { q: 'Qual das alternativas explica corretamente o fenômeno das marés?', options: ['são causadas exclusivamente pelo vento', 'resultam principalmente da atração gravitacional da Lua (e também do Sol) sobre os oceanos', 'ocorrem apenas em rios', 'são causadas por terremotos'], correct: 1, explanation: 'As marés são causadas principalmente pela atração gravitacional da Lua, e em menor grau do Sol, sobre as águas dos oceanos.' },
        { q: 'O que caracteriza uma metrópole em termos geográficos?', options: ['uma pequena vila rural', 'uma grande cidade com grande influência econômica, política e populacional sobre uma região', 'um bioma específico', 'um tipo de relevo'], correct: 1, explanation: 'Uma metrópole é uma grande cidade que exerce forte influência econômica, política e populacional sobre uma ampla região ao seu redor.' },
      ],
    },
    medio: {
      normal: [
        { q: 'Qual é o valor de f(x) = 2x + 3 quando x = 5?', options: ['10', '13', '11', '8'], correct: 1, explanation: 'Basta substituir x por 5 na função: 2(5) + 3 = 13.' },
        { q: 'Qual é o coeficiente angular da reta de equação y = 3x - 7?', options: ['3', '-7', '7', '-3'], correct: 0, explanation: 'Na forma y = ax + b, o coeficiente angular é o número que multiplica x, ou seja, 3.' },
        { q: 'Qual é a distância entre os pontos (0,0) e (3,4) no plano cartesiano?', options: ['5', '7', '4', '3'], correct: 0, explanation: 'Pela fórmula da distância, d = √((3-0)² + (4-0)²) = √25 = 5.' },
        { q: 'Qual é o valor de sen(30°)?', options: ['1/2', '√2/2', '√3/2', '1'], correct: 0, explanation: 'O seno de 30° é um valor notável da trigonometria e vale 1/2.' },
        { q: 'Qual é o valor de cos(60°)?', options: ['1/2', '√2/2', '√3/2', '1'], correct: 0, explanation: 'O cosseno de 60° é um valor notável da trigonometria e vale 1/2.' },
        { q: 'Qual é o valor de log₁₀(100)?', options: ['1', '2', '3', '10'], correct: 1, explanation: 'Como 10² = 100, temos log₁₀(100) = 2.' },
        { q: 'Qual é o valor de log₂(8)?', options: ['2', '3', '4', '8'], correct: 1, explanation: 'Como 2³ = 8, temos log₂(8) = 3.' },
        { q: 'Lançando um dado de 6 faces não viciado, qual é a probabilidade de obter um número par?', options: ['1/6', '1/3', '1/2', '2/3'], correct: 2, explanation: 'Existem 3 números pares (2, 4, 6) em 6 possibilidades, logo a probabilidade é 3/6 = 1/2.' },
        { q: 'Qual é o vértice da parábola definida por y = x² - 4x + 3?', options: ['(2,-1)', '(2,1)', '(-2,-1)', '(4,3)'], correct: 0, explanation: 'O vértice tem x = -b/2a = 4/2 = 2, e y = (2)² - 4(2) + 3 = -1.' },
        { q: 'Qual é a área de um círculo de raio 2 cm?', options: ['2π cm²', '4π cm²', '8π cm²', '16π cm²'], correct: 1, explanation: 'A área do círculo é A = πr² = π(2)² = 4π cm².' },
        { q: 'Em uma progressão aritmética (PA) de razão 3, com primeiro termo igual a 2, qual é o quinto termo?', options: ['11', '14', '17', '20'], correct: 1, explanation: 'a5 = a1 + 4r = 2 + 4(3) = 14.' },
        { q: 'Qual é o valor de tan(45°)?', options: ['0', '1', '√2', '√3'], correct: 1, explanation: 'A tangente de 45° é um valor notável da trigonometria e vale 1.' },
        { q: 'Quantos anagramas diferentes podem ser formados com as letras da palavra \'AMOR\' (sem repetição de letras)?', options: ['12', '24', '16', '20'], correct: 1, explanation: 'Com 4 letras distintas, o número de anagramas é 4! = 24.' },
        { q: 'Qual é a equação reduzida da reta que passa pelos pontos (0,2) e (2,6)?', options: ['y = 2x + 2', 'y = x + 2', 'y = 2x - 2', 'y = 4x + 2'], correct: 0, explanation: 'O coeficiente angular é (6-2)/(2-0) = 2, e como a reta passa por (0,2), a equação é y = 2x + 2.' },
        { q: 'Se um número x satisfaz log(x) = 3 (base 10), qual é o valor de x?', options: ['30', '100', '300', '1000'], correct: 3, explanation: 'log(x) = 3 significa que x = 10³ = 1000.' },
        { q: 'Qual é a soma dos ângulos internos de um triângulo?', options: ['90°', '180°', '270°', '360°'], correct: 1, explanation: 'A soma dos ângulos internos de qualquer triângulo é sempre 180°.' },
        { q: 'Machado de Assis é o principal autor do movimento literário conhecido como:', options: ['Romantismo', 'Realismo', 'Parnasianismo', 'Barroco'], correct: 1, explanation: 'Machado de Assis é considerado o maior expoente do Realismo no Brasil.' },
        { q: 'O Modernismo brasileiro foi oficialmente iniciado com qual evento, em 1922?', options: ['Semana de Arte Moderna', 'Inconfidência Mineira', 'Proclamação da República', 'Golpe de 1930'], correct: 0, explanation: 'A Semana de Arte Moderna, realizada em São Paulo em 1922, é o marco inicial do Modernismo brasileiro.' },
        { q: 'Qual figura de linguagem consiste na repetição de uma mesma consoante em uma sequência de palavras?', options: ['Aliteração', 'Metáfora', 'Hipérbole', 'Anáfora'], correct: 0, explanation: 'A aliteração é a repetição de sons consonantais em uma frase ou verso.' },
        { q: '\'Os Sertões\', obra que retrata a Guerra de Canudos, foi escrita por:', options: ['Euclides da Cunha', 'Machado de Assis', 'Graciliano Ramos', 'José de Alencar'], correct: 0, explanation: 'Euclides da Cunha escreveu \'Os Sertões\', obra sobre a Guerra de Canudos.' },
        { q: 'José de Alencar é autor de \'Iracema\', romance indianista associado a qual movimento literário?', options: ['Romantismo', 'Realismo', 'Arcadismo', 'Modernismo'], correct: 0, explanation: '\'Iracema\' é uma obra indianista romântica escrita por José de Alencar.' },
        { q: 'A hipérbole é a figura de linguagem que consiste em:', options: ['exagero intencional', 'comparação direta', 'oposição de ideias', 'repetição de sons'], correct: 0, explanation: 'A hipérbole é o exagero proposital de uma ideia para dar ênfase.' },
        { q: 'Qual é o sujeito da oração \'Choveu muito ontem à noite\'?', options: ['Inexistente (oração sem sujeito)', 'Simples', 'Composto', 'Oculto'], correct: 0, explanation: 'Verbos que indicam fenômenos da natureza, como \'chover\', são impessoais e formam orações sem sujeito.' },
        { q: 'Carlos Drummond de Andrade é um dos principais poetas de qual fase do Modernismo brasileiro?', options: ['Segunda geração modernista', 'Primeira geração modernista', 'Arcadismo', 'Parnasianismo'], correct: 0, explanation: 'Drummond é um dos maiores nomes da segunda geração do Modernismo (geração de 1930).' },
        { q: '\'Vidas Secas\', de Graciliano Ramos, é uma obra representativa de qual movimento?', options: ['Regionalismo da segunda fase do Modernismo', 'Romantismo', 'Barroco', 'Simbolismo'], correct: 0, explanation: '\'Vidas Secas\' é um romance regionalista da segunda fase do Modernismo brasileiro.' },
        { q: 'O Parnasianismo valorizava principalmente:', options: ['a forma e o rigor técnico do poema', 'os sentimentos exacerbados', 'a linguagem coloquial', 'o misticismo'], correct: 0, explanation: 'Os parnasianos priorizavam a perfeição formal, a métrica e a rima em detrimento da emoção.' },
        { q: 'Gregório de Matos é o principal representante de qual movimento literário no Brasil colonial?', options: ['Barroco', 'Arcadismo', 'Romantismo', 'Realismo'], correct: 0, explanation: 'Gregório de Matos é considerado o maior poeta barroco brasileiro.' },
        { q: 'Na oração \'O menino comeu a maçã\', qual é o objeto direto?', options: ['a maçã', 'o menino', 'comeu', 'Não há objeto direto'], correct: 0, explanation: '\'A maçã\' recebe diretamente a ação do verbo \'comeu\', sem necessidade de preposição, sendo o objeto direto.' },
        { q: 'Clarice Lispector é reconhecida por sua prosa introspectiva e psicológica, sendo autora de qual obra?', options: ['A Hora da Estrela', 'Grande Sertão: Veredas', 'Dom Casmurro', 'Memórias Póstumas de Brás Cubas'], correct: 0, explanation: '\'A Hora da Estrela\' é uma das obras mais conhecidas de Clarice Lispector.' },
        { q: 'O Realismo, no Brasil, tem como marco inicial a publicação de qual obra de Machado de Assis?', options: ['Memórias Póstumas de Brás Cubas', 'Iracema', 'O Guarani', 'Os Sertões'], correct: 0, explanation: 'A publicação de \'Memórias Póstumas de Brás Cubas\' em 1881 marca o início do Realismo brasileiro.' },
        { q: 'Qual figura de linguagem ocorre em \'Chorei rios de lágrimas\'?', options: ['Hipérbole', 'Eufemismo', 'Ironia', 'Prosopopeia'], correct: 0, explanation: 'A expressão exagera a quantidade de lágrimas, caracterizando uma hipérbole.' },
        { q: 'Castro Alves ficou conhecido como o poeta dos escravos por escrever sobre qual tema?', options: ['a abolição da escravatura', 'o amor idealizado', 'a natureza brasileira', 'a vida na corte'], correct: 0, explanation: 'Castro Alves escreveu poemas engajados na causa abolicionista, como \'O Navio Negreiro\'.' },
        { q: 'A unidade de medida da força no Sistema Internacional é:', options: ['Newton', 'Joule', 'Watt', 'Pascal'], correct: 0, explanation: 'A força é medida em Newton (N) no Sistema Internacional de Unidades.' },
        { q: 'Qual é a fórmula da segunda lei de Newton?', options: ['F = m.a', 'F = m.v', 'F = m/a', 'F = m.a²'], correct: 0, explanation: 'A segunda lei de Newton estabelece que a força resultante é igual ao produto da massa pela aceleração.' },
        { q: 'A velocidade da luz no vácuo é aproximadamente:', options: ['300.000 km/s', '150.000 km/s', '1.000.000 km/s', '30.000 km/s'], correct: 0, explanation: 'A luz se propaga no vácuo a cerca de 300.000 km/s (3 x 10⁸ m/s).' },
        { q: 'Um objeto em movimento retilíneo uniforme (MRU) apresenta:', options: ['velocidade constante', 'aceleração constante e diferente de zero', 'velocidade variável', 'repouso'], correct: 0, explanation: 'No MRU a velocidade é constante e a aceleração é nula.' },
        { q: 'A unidade de medida de energia no SI é:', options: ['Joule', 'Newton', 'Watt', 'Ampère'], correct: 0, explanation: 'O Joule (J) é a unidade de energia e de trabalho no Sistema Internacional.' },
        { q: 'Segundo a Lei de Ohm, a relação entre tensão (U), corrente (I) e resistência (R) é:', options: ['U = R.I', 'U = R/I', 'U = I/R', 'U = R + I'], correct: 0, explanation: 'A Lei de Ohm estabelece que a tensão é igual ao produto da resistência pela corrente.' },
        { q: 'O fenômeno da reflexão da luz ocorre quando:', options: ['a luz muda de direção ao incidir em uma superfície, voltando ao meio de origem', 'a luz muda de meio e de velocidade', 'a luz é absorvida totalmente', 'a luz se decompõe em cores'], correct: 0, explanation: 'Na reflexão, a luz retorna ao mesmo meio após incidir sobre uma superfície.' },
        { q: 'Qual é a unidade de temperatura usada na escala Kelvin?', options: ['Kelvin', 'Celsius', 'Fahrenheit', 'Joule'], correct: 0, explanation: 'A escala Kelvin (K) é a escala termodinâmica de temperatura utilizada no SI.' },
        { q: 'A Primeira Lei de Newton é também conhecida como:', options: ['Lei da Inércia', 'Lei da Ação e Reação', 'Lei da Gravitação Universal', 'Lei de Ohm'], correct: 0, explanation: 'A Primeira Lei de Newton descreve a tendência dos corpos a manterem seu estado de movimento, sendo chamada de Lei da Inércia.' },
        { q: 'Em um circuito elétrico em série, a corrente elétrica:', options: ['é a mesma em todos os pontos do circuito', 'se divide entre os resistores', 'é maior no resistor de maior resistência', 'é nula'], correct: 0, explanation: 'Em circuitos em série, a corrente elétrica é igual em todos os componentes.' },
        { q: 'A refração da luz ocorre quando ela:', options: ['passa de um meio para outro, mudando de velocidade e direção', 'é totalmente refletida', 'se espalha em todas as direções', 'perde toda sua energia'], correct: 0, explanation: 'A refração ocorre quando a luz muda de meio de propagação, alterando sua velocidade e direção.' },
        { q: 'Qual é a fórmula para calcular a potência elétrica?', options: ['P = U.I', 'P = U/I', 'P = U + I', 'P = U - I'], correct: 0, explanation: 'A potência elétrica é dada pelo produto entre a tensão e a corrente elétrica.' },
        { q: 'O calor é transferido por condução, convecção e:', options: ['irradiação (radiação)', 'fusão', 'ebulição', 'sublimação'], correct: 0, explanation: 'Os três processos de transferência de calor são condução, convecção e irradiação.' },
        { q: 'De acordo com a Terceira Lei de Newton, para toda ação existe uma reação de mesma intensidade, mesma direção e:', options: ['sentido oposto', 'mesmo sentido', 'direção perpendicular', 'intensidade menor'], correct: 0, explanation: 'A Lei da Ação e Reação afirma que as forças têm mesma intensidade e direção, mas sentidos opostos.' },
        { q: 'A energia cinética de um corpo depende de sua massa e de sua:', options: ['velocidade', 'temperatura', 'cor', 'densidade'], correct: 0, explanation: 'A energia cinética é calculada por Ec = mv²/2, dependendo da massa e da velocidade.' },
        { q: 'Um espelho plano forma imagens que são:', options: ['virtuais, direitas e do mesmo tamanho do objeto', 'reais e invertidas', 'reais e ampliadas', 'virtuais e reduzidas'], correct: 0, explanation: 'Espelhos planos sempre formam imagens virtuais, direitas e de mesmo tamanho do objeto.' },
        { q: 'Os elementos químicos são organizados na Tabela Periódica principalmente em ordem crescente de:', options: ['número atômico', 'massa atômica', 'número de nêutrons', 'número de isótopos'], correct: 0, explanation: 'A Tabela Periódica moderna organiza os elementos em ordem crescente de número atômico.' },
        { q: 'Qual é o símbolo químico do sódio?', options: ['Na', 'So', 'Nd', 'S'], correct: 0, explanation: 'O símbolo químico do sódio é Na, derivado do latim \'natrium\'.' },
        { q: 'A ligação química formada pela transferência de elétrons entre um metal e um ametal é chamada de:', options: ['ligação iônica', 'ligação covalente', 'ligação metálica', 'ligação de hidrogênio'], correct: 0, explanation: 'A ligação iônica ocorre pela transferência de elétrons de um metal para um ametal, formando íons.' },
        { q: 'O elemento químico oxigênio pertence a qual família da Tabela Periódica?', options: ['Calcogênios', 'Halogênios', 'Metais alcalinos', 'Gases nobres'], correct: 0, explanation: 'O oxigênio pertence ao grupo 16, conhecido como calcogênios.' },
        { q: 'Qual é a fórmula molecular da água?', options: ['H2O', 'CO2', 'O2', 'H2O2'], correct: 0, explanation: 'A molécula de água é composta por dois átomos de hidrogênio e um de oxigênio: H2O.' },
        { q: 'Em uma ligação covalente, os átomos se unem por meio de:', options: ['compartilhamento de elétrons', 'transferência total de elétrons', 'atração entre íons', 'perda total de prótons'], correct: 0, explanation: 'Na ligação covalente, os átomos compartilham pares de elétrons.' },
        { q: 'O número de Avogadro é utilizado para relacionar:', options: ['quantidade de matéria (mol) e número de partículas', 'massa e volume', 'pressão e temperatura', 'carga e massa'], correct: 0, explanation: 'O número de Avogadro (6,02 x 10²³) indica quantas partículas há em um mol de substância.' },
        { q: 'Qual gás é o principal responsável pelo efeito estufa entre os gases emitidos pela queima de combustíveis fósseis?', options: ['Dióxido de carbono (CO2)', 'Oxigênio (O2)', 'Nitrogênio (N2)', 'Hidrogênio (H2)'], correct: 0, explanation: 'O CO2 liberado pela queima de combustíveis fósseis é o principal gás de efeito estufa de origem humana.' },
        { q: 'Os hidrocarbonetos são compostos orgânicos formados exclusivamente por átomos de:', options: ['carbono e hidrogênio', 'carbono e oxigênio', 'carbono e nitrogênio', 'hidrogênio e oxigênio'], correct: 0, explanation: 'Hidrocarbonetos são compostos formados apenas por carbono e hidrogênio.' },
        { q: 'Qual é o pH aproximado de uma solução neutra, como a água pura, a 25°C?', options: ['7', '0', '14', '10'], correct: 0, explanation: 'A água pura a 25°C tem pH igual a 7, sendo considerada neutra.' },
        { q: 'Os metais alcalinos, como o sódio e o potássio, estão localizados em qual grupo da Tabela Periódica?', options: ['Grupo 1 (IA)', 'Grupo 17 (VIIA)', 'Grupo 18 (VIIIA)', 'Grupo 2 (IIA)'], correct: 0, explanation: 'Os metais alcalinos formam o grupo 1 da Tabela Periódica.' },
        { q: 'Uma reação de combustão completa de um hidrocarboneto produz principalmente:', options: ['gás carbônico e água', 'apenas oxigênio', 'apenas hidrogênio', 'nitrogênio e água'], correct: 0, explanation: 'A combustão completa de um hidrocarboneto na presença de oxigênio suficiente gera CO2 e H2O.' },
        { q: 'O que caracteriza um átomo eletricamente neutro?', options: ['número de prótons igual ao número de elétrons', 'número de prótons igual ao número de nêutrons', 'ausência de elétrons', 'ausência de nêutrons'], correct: 0, explanation: 'Um átomo é neutro quando o número de prótons (carga positiva) se iguala ao número de elétrons (carga negativa).' },
        { q: 'Qual é o nome da força de atração que mantém os átomos unidos em uma molécula?', options: ['ligação química', 'força gravitacional', 'força nuclear forte', 'força elétrica externa'], correct: 0, explanation: 'As ligações químicas são responsáveis por unir os átomos formando moléculas e compostos.' },
        { q: 'Os gases nobres são caracterizados por sua baixa reatividade química porque:', options: ['possuem a camada de valência completa', 'possuem poucos elétrons', 'são metais pesados', 'têm carga elétrica negativa'], correct: 0, explanation: 'Os gases nobres têm a camada de valência completa, tornando-os quimicamente estáveis e pouco reativos.' },
        { q: 'Na tabela periódica, os elementos de um mesmo período (linha horizontal) possuem em comum:', options: ['o mesmo número de camadas eletrônicas', 'o mesmo número de elétrons de valência', 'a mesma massa atômica', 'o mesmo estado físico'], correct: 0, explanation: 'Elementos de um mesmo período possuem o mesmo número de camadas (níveis) eletrônicas.' },
        { q: 'O responsável por carregar a informação genética nas células é:', options: ['o DNA (ácido desoxirribonucleico)', 'o RNA mensageiro apenas', 'a mitocôndria', 'o ribossomo'], correct: 0, explanation: 'O DNA armazena as informações genéticas responsáveis pelas características dos seres vivos.' },
        { q: 'Segundo as Leis de Mendel, um indivíduo heterozigoto para uma característica é representado por:', options: ['dois alelos diferentes (ex: Aa)', 'dois alelos iguais e dominantes', 'dois alelos iguais e recessivos', 'apenas um alelo'], correct: 0, explanation: 'O heterozigoto possui um alelo dominante e um recessivo, como em Aa.' },
        { q: 'A fotossíntese é o processo pelo qual as plantas produzem:', options: ['glicose e oxigênio a partir de gás carbônico e água, usando luz', 'apenas oxigênio a partir da água', 'gás carbônico a partir de glicose', 'apenas água a partir de glicose'], correct: 0, explanation: 'Na fotossíntese, CO2 e água são convertidos em glicose e oxigênio com o uso de energia luminosa.' },
        { q: 'Em um ecossistema, os organismos que produzem seu próprio alimento são chamados de:', options: ['produtores', 'consumidores primários', 'decompositores', 'consumidores secundários'], correct: 0, explanation: 'Os produtores, como as plantas, são organismos autótrofos que fabricam seu próprio alimento.' },
        { q: 'A teoria da evolução por seleção natural foi proposta principalmente por:', options: ['Charles Darwin', 'Gregor Mendel', 'Louis Pasteur', 'Jean-Baptiste Lamarck'], correct: 0, explanation: 'Charles Darwin é o principal responsável pela teoria da evolução por seleção natural.' },
        { q: 'O órgão responsável pela troca gasosa no sistema respiratório humano é:', options: ['o pulmão (alvéolos)', 'o coração', 'o fígado', 'o rim'], correct: 0, explanation: 'As trocas gasosas ocorrem nos alvéolos pulmonares, dentro dos pulmões.' },
        { q: 'As células que não possuem núcleo organizado são chamadas de:', options: ['procariontes', 'eucariontes', 'multicelulares', 'autotróficas'], correct: 0, explanation: 'Células procariontes não possuem núcleo delimitado por membrana.' },
        { q: 'No sistema circulatório humano, o sangue rico em oxigênio é bombeado do coração para o corpo através de qual estrutura?', options: ['aorta (artérias)', 'veia cava', 'veias pulmonares apenas', 'capilares linfáticos'], correct: 0, explanation: 'A artéria aorta conduz o sangue oxigenado do coração para todo o corpo.' },
        { q: 'A biodiversidade de um ecossistema tende a diminuir quando ocorre:', options: ['destruição de habitats naturais', 'aumento da variedade de espécies', 'equilíbrio entre predadores e presas', 'preservação ambiental'], correct: 0, explanation: 'A destruição de habitats reduz o número de espécies e, portanto, a biodiversidade.' },
        { q: 'O processo de divisão celular que origina gametas (células reprodutivas) é chamado de:', options: ['meiose', 'mitose', 'fecundação', 'mutação'], correct: 0, explanation: 'A meiose reduz o número de cromossomos pela metade, originando gametas.' },
        { q: 'Qual estrutura celular é responsável pela produção de energia (ATP) na célula?', options: ['mitocôndria', 'núcleo', 'ribossomo', 'complexo de Golgi'], correct: 0, explanation: 'A mitocôndria é a organela responsável pela respiração celular e produção de ATP.' },
        { q: 'O sistema nervoso central é formado por:', options: ['encéfalo e medula espinhal', 'apenas o cérebro', 'nervos periféricos', 'apenas a medula espinhal'], correct: 0, explanation: 'O sistema nervoso central compreende o encéfalo e a medula espinhal.' },
        { q: 'Uma cadeia alimentar representa:', options: ['a transferência de energia entre organismos', 'apenas a competição entre espécies', 'apenas a reprodução dos seres vivos', 'o ciclo da água'], correct: 0, explanation: 'A cadeia alimentar mostra o fluxo de energia e matéria entre os níveis tróficos de um ecossistema.' },
        { q: 'O termo \'biodiversidade\' refere-se a:', options: ['variedade de espécies e ecossistemas em um ambiente', 'apenas o número de animais em uma floresta', 'quantidade de água disponível', 'tipos de rochas em uma região'], correct: 0, explanation: 'Biodiversidade engloba a variedade genética, de espécies e de ecossistemas de um ambiente.' },
        { q: 'As enzimas digestivas têm a função de:', options: ['acelerar a quebra de moléculas de alimento em substâncias menores', 'produzir hormônios', 'transportar oxigênio no sangue', 'formar o material genético'], correct: 0, explanation: 'As enzimas digestivas catalisam a quebra de macromoléculas dos alimentos em partículas menores absorvíveis.' },
        { q: 'Um exemplo de relação ecológica de mutualismo é:', options: ['a relação entre abelhas e flores', 'a relação entre predador e presa', 'o parasitismo', 'a competição entre espécies'], correct: 0, explanation: 'Abelhas e flores se beneficiam mutuamente: as abelhas obtêm néctar e as flores são polinizadas.' },
        { q: 'A Proclamação da Independência do Brasil ocorreu em qual ano?', options: ['1822', '1808', '1889', '1500'], correct: 0, explanation: 'A Independência do Brasil foi proclamada por Dom Pedro I em 7 de setembro de 1822.' },
        { q: 'A Revolução Francesa, marco da Idade Contemporânea, teve início em qual ano?', options: ['1789', '1776', '1804', '1815'], correct: 0, explanation: 'A Revolução Francesa teve início em 1789, com a queda da Bastilha.' },
        { q: 'O sistema de trabalho predominante no Brasil colonial, baseado na exploração de mão de obra africana, foi:', options: ['a escravidão', 'o trabalho assalariado', 'a servidão feudal', 'o trabalho voluntário'], correct: 0, explanation: 'A economia colonial brasileira dependeu fortemente do trabalho escravo de africanos.' },
        { q: 'A Proclamação da República no Brasil ocorreu em:', options: ['1889', '1822', '1500', '1930'], correct: 0, explanation: 'A República foi proclamada em 15 de novembro de 1889, encerrando o período monárquico.' },
        { q: 'A Segunda Guerra Mundial teve início em qual ano, com a invasão da Polônia pela Alemanha nazista?', options: ['1939', '1914', '1945', '1929'], correct: 0, explanation: 'A Segunda Guerra Mundial começou em 1939 com a invasão alemã à Polônia.' },
        { q: 'O processo histórico conhecido como Revolução Industrial teve início em qual país?', options: ['Inglaterra', 'França', 'Alemanha', 'Estados Unidos'], correct: 0, explanation: 'A Revolução Industrial teve início na Inglaterra, no século XVIII.' },
        { q: 'A Era Vargas, no Brasil, foi marcada pelo governo de:', options: ['Getúlio Vargas', 'Juscelino Kubitschek', 'Dom Pedro II', 'Fernando Collor'], correct: 0, explanation: 'A Era Vargas corresponde aos períodos em que Getúlio Vargas governou o Brasil.' },
        { q: 'O Tratado de Tordesilhas, assinado em 1494, dividia as terras descobertas entre quais países?', options: ['Portugal e Espanha', 'França e Inglaterra', 'Holanda e Espanha', 'Portugal e Holanda'], correct: 0, explanation: 'O Tratado de Tordesilhas dividiu as terras do Novo Mundo entre Portugal e Espanha.' },
        { q: 'A Guerra Fria foi caracterizada pela disputa ideológica e política entre:', options: ['Estados Unidos e União Soviética', 'Brasil e Argentina', 'Inglaterra e França', 'Alemanha e Itália'], correct: 0, explanation: 'A Guerra Fria opôs o bloco capitalista, liderado pelos EUA, ao bloco socialista, liderado pela URSS.' },
        { q: 'A abolição da escravatura no Brasil ocorreu em 1888 por meio de qual lei?', options: ['Lei Áurea', 'Lei do Ventre Livre', 'Lei dos Sexagenários', 'Lei de Terras'], correct: 0, explanation: 'A Lei Áurea, assinada pela Princesa Isabel em 1888, aboliu a escravidão no Brasil.' },
        { q: 'O período do Regime Militar no Brasil teve início em qual ano?', options: ['1964', '1954', '1974', '1985'], correct: 0, explanation: 'O Regime Militar brasileiro teve início com o golpe de 1964.' },
        { q: 'A Revolução Russa de 1917 resultou na ascensão de qual sistema político?', options: ['socialismo/comunismo liderado pelos bolcheviques', 'capitalismo liberal', 'monarquia absolutista', 'fascismo'], correct: 0, explanation: 'A Revolução Russa de 1917 levou os bolcheviques ao poder, instaurando um regime socialista.' },
        { q: 'Quem foi o navegador responsável pela chegada dos portugueses ao Brasil, em 1500?', options: ['Pedro Álvares Cabral', 'Cristóvão Colombo', 'Vasco da Gama', 'Fernão de Magalhães'], correct: 0, explanation: 'Pedro Álvares Cabral comandou a expedição portuguesa que chegou ao Brasil em 1500.' },
        { q: 'O Iluminismo, movimento filosófico do século XVIII, defendia principalmente:', options: ['a razão, a liberdade individual e a crítica ao absolutismo', 'o retorno ao feudalismo', 'o fortalecimento da Igreja Católica', 'a monarquia absoluta como forma ideal de governo'], correct: 0, explanation: 'Os iluministas defendiam o uso da razão, a liberdade e criticavam o absolutismo monárquico.' },
        { q: 'A Inconfidência Mineira, ocorrida em 1789 em Minas Gerais, tinha como principal objetivo:', options: ['a independência da região em relação a Portugal', 'a abolição da escravatura', 'a criação da república federativa', 'a expulsão dos jesuítas'], correct: 0, explanation: 'A Inconfidência Mineira foi um movimento que buscava a independência de Minas Gerais frente a Portugal.' },
        { q: 'O fenômeno climático conhecido como El Niño está relacionado ao aquecimento anormal das águas de qual oceano?', options: ['Oceano Pacífico', 'Oceano Atlântico', 'Oceano Índico', 'Oceano Ártico'], correct: 0, explanation: 'O El Niño é caracterizado pelo aquecimento anormal das águas superficiais do Oceano Pacífico equatorial.' },
        { q: 'O processo de urbanização acelerada e desordenada, comum em países em desenvolvimento, frequentemente resulta em:', options: ['formação de favelas e problemas de infraestrutura urbana', 'redução da população urbana', 'aumento da atividade agrícola nas cidades', 'diminuição do trânsito'], correct: 0, explanation: 'A urbanização desordenada gera ocupações irregulares e sobrecarrega a infraestrutura das cidades.' },
        { q: 'O bioma predominante na região Norte do Brasil é:', options: ['Floresta Amazônica', 'Caatinga', 'Cerrado', 'Pampa'], correct: 0, explanation: 'A Floresta Amazônica é o bioma predominante na região Norte do país.' },
        { q: 'A Zona Econômica Exclusiva (ZEE) de um país corresponde a uma faixa marítima de até:', options: ['200 milhas náuticas a partir da costa', '12 milhas náuticas', '500 milhas náuticas', '50 milhas náuticas'], correct: 0, explanation: 'Pela Convenção da ONU sobre o Direito do Mar, a ZEE se estende até 200 milhas náuticas da costa.' },
        { q: 'O efeito estufa é um fenômeno natural intensificado pela ação humana, principalmente por meio da emissão de:', options: ['gases como o CO2 proveniente da queima de combustíveis fósseis', 'oxigênio das florestas', 'vapor de água dos oceanos', 'nitrogênio da atmosfera'], correct: 0, explanation: 'A queima de combustíveis fósseis libera CO2, intensificando o efeito estufa.' },
        { q: 'O Mercosul é um bloco econômico formado principalmente por países da:', options: ['América do Sul', 'América Central', 'Europa', 'Ásia'], correct: 0, explanation: 'O Mercosul é um bloco econômico formado principalmente por países sul-americanos, como Brasil e Argentina.' },
        { q: 'A desertificação é um processo de degradação ambiental associado principalmente a:', options: ['uso inadequado do solo e desmatamento em áreas semiáridas', 'excesso de chuvas', 'aumento da biodiversidade', 'resfriamento global'], correct: 0, explanation: 'A desertificação ocorre principalmente pelo manejo inadequado do solo em regiões semiáridas.' },
        { q: 'O clima predominante na região Nordeste do Brasil, caracterizado por baixos índices de chuva, é o:', options: ['semiárido', 'equatorial', 'temperado', 'subtropical'], correct: 0, explanation: 'O clima semiárido, com baixa pluviosidade, predomina no interior do Nordeste brasileiro.' },
        { q: 'As grandes cidades que exercem forte influência econômica, cultural e política em escala global são chamadas de:', options: ['cidades globais (ou metrópoles mundiais)', 'cidades médias', 'cidades satélites', 'cidades-dormitório'], correct: 0, explanation: 'Cidades globais, como Nova York e Londres, concentram poder econômico e influência mundial.' },
        { q: 'O Protocolo de Kyoto e o Acordo de Paris são exemplos de acordos internacionais voltados para:', options: ['redução das emissões de gases de efeito estufa', 'comércio internacional', 'controle de fronteiras', 'direitos autorais'], correct: 0, explanation: 'Ambos os acordos visam reduzir as emissões de gases causadores do efeito estufa em escala global.' },
        { q: 'A hidrografia brasileira é marcada pela presença de uma das maiores bacias hidrográficas do mundo, a bacia:', options: ['Amazônica', 'do Rio Nilo', 'do Rio Danúbio', 'do Rio Mississippi'], correct: 0, explanation: 'A Bacia Amazônica é a maior bacia hidrográfica do mundo em volume de água.' },
        { q: 'O processo migratório campo-cidade, muito comum no Brasil a partir do século XX, é chamado de:', options: ['êxodo rural', 'imigração internacional', 'diáspora', 'nomadismo'], correct: 0, explanation: 'O êxodo rural é a migração da população do campo para as cidades.' },
        { q: 'A camada de gases que envolve a Terra e protege contra a radiação ultravioleta excessiva é a camada de:', options: ['ozônio', 'nitrogênio', 'metano', 'hidrogênio'], correct: 0, explanation: 'A camada de ozônio filtra grande parte da radiação ultravioleta proveniente do Sol.' },
        { q: 'O relevo brasileiro é formado predominantemente por:', options: ['planaltos e planícies', 'montanhas altas e vulcões ativos', 'desertos extensos', 'geleiras permanentes'], correct: 0, explanation: 'O território brasileiro é composto majoritariamente por planaltos e planícies, sem grandes cadeias montanhosas.' },
        { q: 'A globalização é um processo caracterizado principalmente por:', options: ['integração econômica, política e cultural entre países em escala mundial', 'isolamento entre nações', 'fim do comércio internacional', 'redução da tecnologia'], correct: 0, explanation: 'A globalização promove maior integração econômica, cultural e política entre os países do mundo.' },
      ],
      hard: [
        { q: 'Qual é a soma da progressão geométrica infinita 1 + 1/2 + 1/4 + 1/8 + ...?', options: ['1', '1,5', '2', '4'], correct: 2, explanation: 'A soma de uma PG infinita é S = a1/(1-q) = 1/(1-1/2) = 2.' },
        { q: 'A circunferência de equação x² + y² - 4x + 2y - 4 = 0 tem centro e raio, respectivamente, iguais a:', options: ['(2,-1) e r=3', '(2,1) e r=3', '(-2,1) e r=2', '(2,-1) e r=9'], correct: 0, explanation: 'Completando os quadrados, obtém-se (x-2)² + (y+1)² = 9, logo centro (2,-1) e raio 3.' },
        { q: 'Se sen(x) = 3/5 e x está no primeiro quadrante, qual é o valor de cos(x)?', options: ['4/5', '3/4', '1/5', '2/5'], correct: 0, explanation: 'Usando a relação fundamental sen²+cos²=1 (triângulo 3-4-5), obtém-se cos(x) = 4/5.' },
        { q: 'Quantas comissões de 3 pessoas podem ser formadas a partir de um grupo de 7 pessoas?', options: ['21', '35', '42', '210'], correct: 1, explanation: 'Como a ordem não importa, usa-se combinação: C(7,3) = 7!/(3!4!) = 35.' },
        { q: 'O Parnasianismo brasileiro, marcado pelo rigor formal e pela busca da perfeição estética, seguiu o modelo de qual movimento europeu?', options: ['Parnasianismo francês', 'Romantismo alemão', 'Naturalismo russo', 'Surrealismo espanhol'], correct: 0, explanation: 'O Parnasianismo brasileiro foi diretamente influenciado pelo Parnasianismo francês (Le Parnasse contemporain).' },
        { q: 'Em \'Grande Sertão: Veredas\', de Guimarães Rosa, a obra é narrada em primeira pessoa por qual personagem, que relata sua vida de jagunço?', options: ['Riobaldo', 'Diadorim', 'Zé Bebelo', 'Medeiro Vaz'], correct: 0, explanation: 'Riobaldo é o narrador-protagonista que conta sua trajetória de jagunço na obra.' },
        { q: 'Classifique a oração em destaque: \'Espero que você chegue cedo.\'', options: ['Subordinada substantiva objetiva direta', 'Subordinada adjetiva restritiva', 'Subordinada adverbial condicional', 'Subordinada substantiva subjetiva'], correct: 0, explanation: 'A oração \'que você chegue cedo\' completa o sentido do verbo \'espero\', funcionando como objeto direto.' },
        { q: 'Um corpo é lançado verticalmente para cima com velocidade inicial de 20 m/s. Desprezando a resistência do ar e considerando g = 10 m/s², qual é o tempo total que o corpo leva para retornar ao ponto de lançamento?', options: ['2 s', '4 s', '6 s', '8 s'], correct: 1, explanation: 'O tempo de subida é v/g = 2 s; como a subida e a descida são simétricas, o tempo total é 4 s.' },
        { q: 'Dois resistores de 4Ω e 6Ω estão associados em paralelo. Qual é a resistência equivalente do conjunto?', options: ['2,4 Ω', '5,0 Ω', '10 Ω', '24 Ω'], correct: 0, explanation: 'Em paralelo, Req = (R1.R2)/(R1+R2) = (4x6)/(4+6) = 2,4 Ω.' },
        { q: 'Um objeto de massa 2 kg se move com velocidade de 3 m/s. Qual é sua energia cinética?', options: ['6 J', '9 J', '12 J', '18 J'], correct: 1, explanation: 'Ec = (m.v²)/2 = (2 x 3²)/2 = 9 J.' },
        { q: 'Em um espelho côncavo, um objeto colocado além do centro de curvatura forma uma imagem:', options: ['real, invertida e menor que o objeto', 'virtual e direita', 'real e maior que o objeto', 'virtual e maior'], correct: 0, explanation: 'Quando o objeto está além do centro de curvatura em um espelho côncavo, a imagem formada é real, invertida e menor.' },
        { q: 'Qual é a massa molar aproximada do gás carbônico (CO2), considerando C=12 g/mol e O=16 g/mol?', options: ['28 g/mol', '32 g/mol', '44 g/mol', '60 g/mol'], correct: 2, explanation: 'A massa molar do CO2 é 12 + 2(16) = 44 g/mol.' },
        { q: 'Quantos mols de moléculas existem em 88 g de CO2 (massa molar 44 g/mol)?', options: ['1 mol', '2 mols', '4 mols', '0,5 mol'], correct: 1, explanation: 'n = massa/massa molar = 88/44 = 2 mols.' },
        { q: 'Em uma reação de neutralização entre um ácido forte e uma base forte, o produto formado é:', options: ['sal e água', 'apenas sal', 'apenas água', 'gás e sal'], correct: 0, explanation: 'A reação de neutralização entre ácido e base forte produz sal e água.' },
        { q: 'No cruzamento entre dois indivíduos heterozigotos (Aa x Aa), qual é a proporção genotípica esperada na descendência?', options: ['1 AA : 2 Aa : 1 aa', '1 AA : 1 Aa : 1 aa', '3 AA : 1 aa', '1 AA : 3 aa'], correct: 0, explanation: 'O cruzamento Aa x Aa gera a proporção genotípica clássica de 1:2:1 (1 AA, 2 Aa, 1 aa).' },
        { q: 'Na respiração celular aeróbica, a etapa que ocorre na matriz mitocondrial e produz a maior parte do NADH é:', options: ['Ciclo de Krebs', 'Glicólise', 'Cadeia respiratória', 'Fermentação'], correct: 0, explanation: 'O Ciclo de Krebs ocorre na matriz mitocondrial e é responsável pela maior produção de NADH na respiração celular.' },
        { q: 'O daltonismo é uma característica genética ligada ao cromossomo X e recessiva. Por que ele é mais comum em homens do que em mulheres?', options: ['homens possuem apenas um cromossomo X, bastando um alelo recessivo para manifestar a condição', 'mulheres não possuem cromossomo X', 'o gene do daltonismo está no cromossomo Y', 'homens têm mais cromossomos X que mulheres'], correct: 0, explanation: 'Como o homem tem apenas um cromossomo X, um único alelo recessivo já é suficiente para manifestar o daltonismo.' },
        { q: 'Qual mecanismo evolutivo explica o aumento da frequência de bactérias resistentes a antibióticos em uma população após uso indiscriminado desses medicamentos?', options: ['seleção natural', 'deriva genética apenas', 'mutação induzida diretamente pelo antibiótico', 'herança de caracteres adquiridos'], correct: 0, explanation: 'O uso de antibióticos seleciona as bactérias já resistentes, que sobrevivem e se reproduzem mais, caracterizando seleção natural.' },
        { q: 'O Congresso de Viena (1814-1815), realizado após as Guerras Napoleônicas, teve como principal objetivo:', options: ['reorganizar o mapa político europeu e restaurar o equilíbrio de poder entre as monarquias', 'unificar a Itália e a Alemanha', 'abolir a escravidão na Europa', 'criar a União Europeia'], correct: 0, explanation: 'O Congresso de Viena buscou restabelecer o equilíbrio de poder e reorganizar as fronteiras europeias após Napoleão.' },
        { q: 'A Política do Café com Leite, durante a República Velha no Brasil, caracterizava-se pela:', options: ['alternância de poder entre as oligarquias de São Paulo e Minas Gerais', 'aliança entre operários e camponeses', 'centralização total do poder pelo imperador', 'disputa entre Norte e Nordeste pelo governo federal'], correct: 0, explanation: 'A Política do Café com Leite representava o revezamento no poder entre as oligarquias paulista e mineira.' },
        { q: 'O processo de descolonização da África, intensificado após a Segunda Guerra Mundial, teve como uma de suas principais causas:', options: ['o enfraquecimento das potências europeias e o fortalecimento dos movimentos nacionalistas africanos', 'a anexação da África pelos Estados Unidos', 'o fim do comércio de especiarias', 'a expansão do Império Otomano'], correct: 0, explanation: 'O enfraquecimento econômico e político das potências coloniais europeias, aliado ao crescimento dos nacionalismos africanos, impulsionou a descolonização.' },
        { q: 'O conceito de \'ilha de calor urbana\' refere-se ao fenômeno em que:', options: ['as áreas urbanas apresentam temperaturas mais altas que as áreas rurais ao redor, devido à impermeabilização do solo e concentração de construções', 'as cidades litorâneas são mais frias que o interior', 'ilhas oceânicas registram temperaturas mais altas que continentes', 'regiões polares aquecem mais rápido que o equador'], correct: 0, explanation: 'A impermeabilização do solo e a concentração de edifícios e asfalto elevam a temperatura das cidades em relação às áreas rurais vizinhas.' },
        { q: 'A Organização dos Países Exportadores de Petróleo (OPEP) tem como principal objetivo:', options: ['coordenar as políticas de produção e preços do petróleo entre os países-membros', 'promover a produção de energias renováveis', 'regular o comércio de produtos agrícolas', 'controlar fronteiras marítimas'], correct: 0, explanation: 'A OPEP foi criada para coordenar e unificar as políticas de produção e preços de petróleo entre seus membros.' },
        { q: 'O fenômeno da \'inversão térmica\', comum em grandes centros urbanos durante o inverno, contribui para:', options: ['a concentração de poluentes próximos à superfície, piorando a qualidade do ar', 'a dispersão rápida de poluentes na atmosfera', 'o aumento das chuvas na região', 'a formação de furacões'], correct: 0, explanation: 'Na inversão térmica, uma camada de ar quente impede a ascensão do ar frio poluído próximo ao solo, concentrando poluentes.' },
        { q: 'A Cordilheira dos Andes, a mais extensa cadeia montanhosa do mundo, foi formada principalmente pelo processo de:', options: ['colisão e subducção entre as placas tectônicas de Nazca e Sul-Americana', 'erosão eólica intensa', 'atividade vulcânica isolada sem relação com placas tectônicas', 'deposição de sedimentos fluviais'], correct: 0, explanation: 'Os Andes se formaram pela subducção da placa de Nazca sob a placa Sul-Americana, processo que ainda gera atividade sísmica e vulcânica na região.' },
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
    if (state === STATE.QUIZ) return;
    state = STATE.QUIZ;
    quiz.mode = 'lifeline';
    quiz.pool = sampleQuestions(gradeTier, 'normal', 5);
    quiz.index = 0;
    quiz.correct = 0;
    quizTitle.textContent = '📚 Hora do Quiz!';
    quizScreen.classList.remove('hidden');
    showQuizQuestion();
  }

  function startPhaseQuiz() {
    state = STATE.QUIZ;
    quiz.mode = 'phase';
    quiz.pool = sampleQuestions(gradeTier, 'hard', 1);
    quiz.index = 0;
    quiz.correct = 0;
    quizTitle.textContent = '⭐ Desafio da Fase!';
    quizScreen.classList.remove('hidden');
    showQuizQuestion();
  }

  function showQuizQuestion() {
    const q = quiz.pool[quiz.index];
    quizProgress.textContent = quiz.mode === 'phase'
      ? 'Acerte a pergunta e escolha uma nova habilidade'
      : `Pergunta ${quiz.index + 1}/${quiz.pool.length} • Vidas ganhas: ${quiz.correct}`;
    quizQuestion.textContent = q.q;
    quizFeedback.textContent = '';
    quizExplanation.textContent = '';
    quizContinueBtn.classList.add('hidden');
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
    const q = quiz.pool[quiz.index];
    const correctText = q.options[q.correct];
    Array.from(quizOptions.children).forEach(b => {
      b.disabled = true;
      if (b.textContent === correctText) b.classList.add('correct');
    });
    if (!isCorrect) btn.classList.add('wrong');
    if (isCorrect) {
      quiz.correct += 1;
      quizFeedback.textContent = '✅ Certinho!';
    } else {
      quizFeedback.textContent = `❌ Errou! A resposta certa era "${correctText}".`;
    }
    quizExplanation.textContent = q.explanation || '';

    if (quiz.mode === 'phase') {
      quizContinueBtn.textContent = 'Continuar';
      quizContinueBtn.classList.remove('hidden');
      quizContinueBtn.onclick = () => finishPhaseQuiz(isCorrect);
      return;
    }

    const isLast = quiz.index + 1 >= quiz.pool.length;
    quizContinueBtn.textContent = isLast ? 'Ver resultado' : 'Continuar';
    quizContinueBtn.classList.remove('hidden');
    quizContinueBtn.onclick = () => {
      quiz.index += 1;
      if (quiz.index < quiz.pool.length) {
        showQuizQuestion();
      } else {
        finishLifelineQuiz();
      }
    };
  }

  function finishPhaseQuiz(isCorrect) {
    quizOptions.innerHTML = '';
    quizQuestion.textContent = '';
    quizProgress.textContent = '';
    quizExplanation.textContent = '';
    quizContinueBtn.classList.remove('hidden');
    if (isCorrect) {
      quizFeedback.textContent = '🎉 Isso! Agora escolha sua nova habilidade.';
      quizContinueBtn.textContent = 'Escolher habilidade';
      quizContinueBtn.onclick = () => {
        quizContinueBtn.classList.add('hidden');
        quizScreen.classList.add('hidden');
        openAbilitySelection(false);
      };
    } else {
      quizFeedback.textContent = '📉 Não foi dessa vez! Sem habilidade nova nesta fase, mas o jogo continua.';
      quizContinueBtn.textContent = 'Continuar jogando';
      quizContinueBtn.onclick = () => {
        quizContinueBtn.classList.add('hidden');
        quizScreen.classList.add('hidden');
        advanceWave();
        state = STATE.PLAYING;
        updateHud();
      };
    }
  }

  function finishLifelineQuiz() {
    quizOptions.innerHTML = '';
    quizQuestion.textContent = '';
    quizProgress.textContent = '';
    quizExplanation.textContent = '';
    quizContinueBtn.classList.remove('hidden');
    if (quiz.correct > 0) {
      const livesWord = quiz.correct === 1 ? 'vida' : 'vidas';
      quizFeedback.textContent = `🎉 Você acertou ${quiz.correct}/5! Ganhou ${quiz.correct} ${livesWord}. Escolha uma habilidade para recomeçar a onda!`;
      player.lives = Math.min(player.maxLives, quiz.correct);
      player.invuln = 1.5;
      player.ammo = player.maxAmmo;
      enemyBullets = [];
      bullets = [];
      quizContinueBtn.textContent = 'Continuar';
      quizContinueBtn.onclick = () => {
        quizContinueBtn.classList.add('hidden');
        quizScreen.classList.add('hidden');
        openAbilitySelection(true);
        updateHud();
      };
    } else {
      quizFeedback.textContent = '📉 Você não acertou nenhuma. Não foi dessa vez...';
      quizContinueBtn.textContent = 'OK';
      quizContinueBtn.onclick = () => {
        quizContinueBtn.classList.add('hidden');
        quizScreen.classList.add('hidden');
        endGame();
      };
    }
  }

  const WAVES_PER_PHASE = 5;

  function phaseForWave(w) {
    return Math.floor((w - 1) / WAVES_PER_PHASE) + 1;
  }

  function playerMinY() { return 76; }
  function playerMaxY() { return H - GROUND_MARGIN - player.h - 6; }

  function resetPlayer() {
    player.x = W / 2 - player.w / 2;
    player.y = playerMaxY();
    player.tilt = 0;
    player.lives = 5;
    player.maxLives = 10;
    player.invuln = 0;
    player.fireCooldown = 0;
    player.ammo = player.maxAmmo;
    player.slowTimer = 0;
    player.slowFx = 0;
    player.speed = BASE_SPEED;
    player.shotPattern = 'single';
    player.shieldHp = 0;
    player.plowShields = 0;
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
      { side: 'left', yFrac: 0.88, growth: 0, ripe: false },
      { side: 'right', yFrac: 0.32, growth: 0, ripe: false },
      { side: 'right', yFrac: 0.68, growth: 0, ripe: false },
      { side: 'right', yFrac: 0.88, growth: 0, ripe: false },
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
    // the bubble shield unlocks after phase 3 and recharges fully every wave
    player.shieldHp = phase >= 4 ? player.shieldMax : 0;
    // difficulty (count, speed, toughness) is tied only to the phase, so all
    // waves inside the same phase feel the same and the ramp-up only happens
    // when a new phase begins
    const cols = Math.min(6, 4 + Math.floor((phase - 1) / 2));
    const rows = Math.min(4, 2 + Math.floor((phase - 1) / 2));
    const marginX = 30;
    const spacingX = (W - marginX * 2) / cols;
    const spacingY = 46;
    const startY = 50;
    const speedBoost = 1 + (phase - 1) * 0.08;
    const hp = Math.min(1 + Math.floor((phase - 1) / 2), 3);

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const baseX = marginX + c * spacingX + spacingX / 2 - 13.2;
        enemies.push({
          baseX,
          x: baseX,
          y: startY + r * spacingY,
          w: 26.4, h: 23.1,
          alive: true,
          hp,
          shootCooldown: Math.random() * 3 + 1,
          type: r % 3,
          speedBoost,
          waveAmp: Math.random() * 10 + 8,
          phaseOffset: Math.random() * Math.PI * 2,
          diving: false,
          diveCooldown: Math.random() * 5 + 4,
          duststunned: 0,
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
        w: 18.2, h: 16.5,
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

  function startGame() {
    score = 0;
    wave = 1;
    phase = phaseForWave(wave);
    bullets = [];
    enemyBullets = [];
    particles = [];
    hearts = [];
    powerups = [];
    activePowerUp = null;
    powerupLabel = '';
    powerupPersistent = false;
    powerupLabelTimer = 0;
    grasshoppers = [];
    grasshopperSpawnTimer = 4;
    powerupSpawnTimer = Math.random() * 10 + 14;
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
    livesEl.textContent = `Vidas: ❤️ ${Math.max(player.lives, 0)}/${player.maxLives}`;
    ammoEl.textContent = `🌽 ${player.ammo}/${player.maxAmmo}`;
    ammoEl.classList.toggle('empty', player.ammo === 0);
    powerupEl.textContent = powerupLabel;
    if (player.shieldHp > 0 || player.plowShields > 0) {
      const parts = [];
      if (player.shieldHp > 0) parts.push(`🛡️ ${player.shieldHp}/${player.shieldMax}`);
      if (player.plowShields > 0) parts.push(`🔄 x${player.plowShields}`);
      shieldInfoEl.textContent = parts.join(' ');
    } else {
      shieldInfoEl.textContent = '';
    }
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
  function spawnKernelAt(x, y, vx, vy) {
    bullets.push({
      x: x - 3.5,
      y,
      w: 7, h: 10,
      vx: vx || 0,
      vy: vy === undefined ? -620 : vy,
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

  function plowShieldPositions() {
    const list = [];
    const n = player.plowShields;
    if (n <= 0) return list;
    const cx = player.x + player.w / 2, cy = player.y + player.h / 2;
    const radius = player.w * 0.85;
    for (let i = 0; i < n; i++) {
      const angle = plowAngle + i * (Math.PI * 2 / n);
      list.push({
        x: cx + Math.cos(angle) * radius - 10,
        y: cy + Math.sin(angle) * radius - 10,
        w: 20, h: 20,
        angle,
      });
    }
    return list;
  }

  function spawnEnemyBullet(enemy) {
    enemyBullets.push({
      x: enemy.x + enemy.w / 2 - 3,
      y: enemy.y + enemy.h,
      w: 6, h: 9,
      speed: 260 + (phase - 1) * 16,
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
    bullets.forEach(b => { b.x += b.vx * dt; b.y += b.vy * dt; });
    bullets = bullets.filter(b => b.y + b.h > 0 && b.y < H + 30 && b.x > -30 && b.x < W + 30);

    // enemy bullets
    enemyBullets.forEach(b => b.y += b.speed * dt);
    enemyBullets = enemyBullets.filter(b => b.y < H);

    // plow shields: rotate around the harvester and reflect crow pecks back up
    plowAngle += dt * 1.8;
    if (player.plowShields > 0) {
      const shields = plowShieldPositions();
      for (const b of enemyBullets) {
        if (b.dead) continue;
        for (const s of shields) {
          if (rectsOverlap(b, s)) {
            b.dead = true;
            spawnKernelAt(s.x + s.w / 2, s.y, 0, -550);
            spawnExplosion(s.x + s.w / 2, s.y + s.h / 2, '#c9d3d8', 10);
            break;
          }
        }
      }
      enemyBullets = enemyBullets.filter(b => !b.dead);
    }

    // hearts (extra-life pickups)
    for (const h of hearts) {
      h.y += h.speed * dt;
      h.x += Math.sin(elapsed * 2 + h.wobble) * 18 * dt;
    }
    hearts = hearts.filter(h => h.y < H + 30);

    // combat bonus power-ups (💥✈️🧨)
    powerupSpawnTimer -= dt;
    if (powerupSpawnTimer <= 0) {
      spawnPowerupItem();
      powerupSpawnTimer = Math.random() * 18 + 24;
    }
    for (const p of powerups) {
      p.y += p.speed * dt;
      p.x += Math.sin(elapsed * 1.6 + p.wobble) * 14 * dt;
    }
    powerups = powerups.filter(p => p.y < H + 30);

    if (!powerupPersistent && powerupLabelTimer > 0) {
      powerupLabelTimer -= dt;
      if (powerupLabelTimer <= 0) powerupLabel = '';
    }

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

    // crow formation + organic swim movement (speed only ramps up between
    // phases, so every wave inside a phase moves at the same pace)
    let hitEdge = false;
    const aliveEnemies = enemies.filter(e => e.alive);
    const formSpeed = 34 + (phase - 1) * 7;
    const descendSpeed = 12 + (phase - 1) * 2.2;

    for (const e of aliveEnemies) {
      if (e.duststunned > 0) e.duststunned -= dt;
      const stunMul = e.duststunned > 0 ? 0.35 : 1;

      if (phase >= 2 && !e.diving) {
        e.diveCooldown -= dt;
        if (e.diveCooldown <= 0) {
          e.diving = true;
        }
      }

      if (e.diving) {
        const targetCx = player.x + player.w / 2;
        e.x += (targetCx - (e.x + e.w / 2)) * Math.min(1, dt * 1.5) * stunMul;
        e.y += descendSpeed * 2 * stunMul * dt;
      } else {
        e.baseX += enemyDir * formSpeed * e.speedBoost * stunMul * dt;
        e.x = e.baseX + Math.sin(elapsed * 2 + e.phaseOffset) * e.waveAmp;
        e.y += descendSpeed * stunMul * dt;
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
      if (e.duststunned <= 0) { // stunned by the crop duster: no shooting
        e.shootCooldown -= dt;
        if (e.shootCooldown <= 0) {
          spawnEnemyBullet(e);
          e.shootCooldown = Math.random() * (4.5 - Math.min((phase - 1) * 0.5, 3)) + 1.5;
        }
      }
      if (e.y + e.h >= groundY && state === STATE.PLAYING) {
        startLifelineQuiz();
      }
    }
    if (state !== STATE.PLAYING) { updateHud(); return; }

    // corn kernels cancel out crow pecks when they collide midair
    for (const b of bullets) {
      if (b.dead) continue;
      for (const e of enemyBullets) {
        if (e.dead) continue;
        if (rectsOverlap(b, e)) {
          b.dead = true;
          e.dead = true;
          spawnExplosion((b.x + e.x) / 2, (b.y + e.y) / 2, '#ffe27a', 8);
          break;
        }
      }
    }
    bullets = bullets.filter(b => !b.dead);
    enemyBullets = enemyBullets.filter(e => !e.dead);

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
            if (activePowerUp === 'rojao') explodeCrow(e);
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
        player.lives = Math.min(player.maxLives, player.lives + 1);
        spawnExplosion(h.x + h.w / 2, h.y + h.h / 2, '#ff6b81', 10);
      }
    }
    hearts = hearts.filter(h => !h.dead);

    // pickups: harvester drives over a combat bonus -> activate it (replaces any previous one)
    for (const p of powerups) {
      if (rectsOverlap(player, p)) {
        p.dead = true;
        activatePowerUp(p.type);
      }
    }
    powerups = powerups.filter(p => !p.dead);

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

    // collisions: crow pecks vs harvester (absorbed by the bubble shield first, if any)
    if (player.invuln <= 0) {
      for (const b of enemyBullets) {
        if (rectsOverlap(b, player)) {
          b.dead = true;
          if (player.shieldHp > 0) {
            player.shieldHp -= 1;
            spawnExplosion(player.x + player.w / 2, player.y + player.h / 2, '#7ec8e3', 10);
          } else {
            hitPlayer();
          }
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

    // wave clear -> a phase transition asks a hard question before the ability choice
    if (enemies.length === 0) {
      const willChangePhase = phaseForWave(wave + 1) !== phase;
      if (willChangePhase) {
        startPhaseQuiz();
      } else {
        openAbilitySelection(false);
      }
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

    // dazed swirl above a crow stunned by the crop duster
    if (e.duststunned > 0) {
      ctx.save();
      ctx.translate(e.x + w / 2, e.y - h * 0.15);
      ctx.font = `${w * 0.55}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.rotate(Math.sin(elapsed * 6) * 0.3);
      ctx.fillText('💫', 0, 0);
      ctx.restore();
    }
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

  function drawBubbleShield() {
    if (player.shieldHp <= 0) return;
    const cx = player.x + player.w / 2, cy = player.y + player.h / 2;
    const r = Math.max(player.w, player.h) * 0.72;
    ctx.save();
    ctx.globalAlpha = 0.2 + 0.15 * player.shieldHp;
    ctx.strokeStyle = '#7ec8e3';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#7ec8e3';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function drawPlowShield(s) {
    ctx.save();
    ctx.translate(s.x + s.w / 2, s.y + s.h / 2);
    ctx.rotate(s.angle + Math.PI / 2);
    ctx.shadowColor = '#c9d3d8';
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#c9d3d8';
    ctx.strokeStyle = '#5c6a6f';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -10);
    ctx.lineTo(8, 8);
    ctx.lineTo(0, 4);
    ctx.lineTo(-8, 8);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function drawPowerup(p) {
    ctx.save();
    const pulse = 1 + Math.sin(elapsed * 3 + p.wobble) * 0.08;
    ctx.font = `${(p.h + 10) * pulse}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = '#ff9d4d';
    ctx.shadowBlur = 14;
    ctx.fillText(POWERUP_ICONS[p.type], p.x + p.w / 2, p.y + p.h / 2);
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
      drawBubbleShield();
      for (const s of plowShieldPositions()) drawPlowShield(s);

      // crows + grasshoppers
      for (const e of enemies) drawCrow(e);
      for (const g of grasshoppers) drawGrasshopper(g);

      // hearts + power-ups
      for (const h of hearts) drawHeart(h);
      for (const p of powerups) drawPowerup(p);

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
