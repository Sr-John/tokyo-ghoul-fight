import { Announcer } from './Announcer.js';
import { Arena } from './Arena.js';
import { Camera } from './Camera.js';
import { ComboCounter } from './ComboCounter.js';
import { EnemyAi } from './EnemyAi.js';
import { resolveHits, resolvePush } from './combat.js';
import { EffectLayer, loadPicture } from './Effects.js';
import { CharacterAtlas } from './CharacterAtlas.js';
import { Fighter } from './Fighter.js';
import { Kaneki } from './Kaneki.js';
import { KanekiFx } from './kanekiFx.js';
import { Menu } from './Menu.js';
import { createUltimate } from './kanekiUltimate.js';
import { HealthBar } from './HealthBar.js';
import { Hud } from './Hud.js';
import { InputHandler } from './InputHandler.js';
import { PowerBar } from './PowerBar.js';
import { Tanjiro } from './Tanjiro.js';
import { TANJIRO_MAX_HEALTH } from './tanjiroMoves.js';

const CANVAS_WIDTH = 1024;
const CANVAS_HEIGHT = 576;

/** Linha onde os lutadores assentam os pés. Abaixo disto é o chão da arena. */
const GROUND_Y = 472;

// Velocidades dos lutadores sem golpes próprios; o Kaneki traz as dele.
const MOVE_SPEED = 5;
const JUMP_FORCE = -16;

// Disposição do HUD: duas barras simétricas com uma folga central, reservada
// para o contador de tempo do round.
const HUD_MARGIN = 32;
const HUD_TOP = 32;
const HUD_CENTER_GAP = 96;
const HUD_BAR_WIDTH = (CANVAS_WIDTH - HUD_MARGIN * 2 - HUD_CENTER_GAP) / 2;

const canvas = document.querySelector('#game');
const ctx = canvas.getContext('2d');

canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;

const arena = new Arena({
  width: CANVAS_WIDTH,
  height: CANVAS_HEIGHT,
  groundY: GROUND_Y,
});

// Os lutadores só precisam de saber onde são as paredes e o chão.
const bounds = {
  width: CANVAS_WIDTH,
  height: CANVAS_HEIGHT,
  groundY: arena.groundY,
};

// As setas fazem scroll à página por omissão; travá-las evita que o ringue
// salte no ecrã enquanto se joga.
const input = new InputHandler({
  preventDefaultFor: ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'],
});

// O personagem inteiro (sprites, animações, caixas de colisão) carrega antes
// de o combate começar. Se falhar, o Kaneki fica com o boneco de reserva.
const kanekiCharacter = await CharacterAtlas.load('assets/kaneki').catch((error) => {
  console.warn(`[sprites] ${error.message}. O Kaneki fica com o desenho de reserva.`);
  return null;
});

// Os efeitos do ultimate são sprites grandes, guardados à parte. Sem eles a
// cena corre na mesma, só com os corpos.
const kanekiUltimateFx = await CharacterAtlas.load('assets/kaneki/fx-ultimate')
  .catch(() => null);

// A fotografia de fundo da arena. É só pôr outra com este nome para a
// trocar; sem ela, o cenário é a cidade desenhada a código.
arena.backdrop = (await loadPicture('assets/arena-bg.jpg').catch(() => null))?.image ?? null;

// A fotografia que serve de fundo à transformação do ultimate. É só pôr
// outra com este nome para a trocar; sem ela, o fundo fica branco.
const ultimateBackdrop = await loadPicture('assets/ultimate-bg.jpg').catch(() => null);

// A do Tanjiro ao ligar a Dança do Deus do Fogo (↓ + 1), com a câmara nele.
const tanjiroHinokamiBackdrop = await loadPicture(
  'assets/1e86b0d4fdc92e11a2dc4f279c31a658.jpg',
).catch(() => null);

// As do Tanjiro, uma para cada ultimate dele: a dos quatro cortes (↓ + 5) e a
// do dragão de água (↓ + 6). Sem elas, ficam com a arena.
const tanjiroCutsBackdrop = await loadPicture(
  'assets/b0942d7754ac3ac7bfef92481275167e.jpg',
).catch(() => null);
const tanjiroDragonBackdrop = await loadPicture(
  encodeURI('assets/Demon Slayer_ Mugen Train Arc.jpg'),
).catch(() => null);

// Os efeitos grandes dos especiais e dos supers, cada grupo no seu atlas.
// Os golpes que os usam dizem de qual (`atlas` na tabela); sem eles, os
// golpes saem na mesma, sem esses efeitos.
const loadFx = (path) => CharacterAtlas.load(path).catch(() => null);
const kanekiFxAtlases = {
  specials: await loadFx('assets/kaneki/fx-specials'),
  supers: await loadFx('assets/kaneki/fx-supers'),
  superpause: await loadFx('assets/kaneki/fx-superpause'),
};
const tanjiroFxAtlases = {
  extra: await loadFx('assets/tanjiro/fx-extra'),
};

// Poeira, faíscas e o chão a rachar: sprites pequenos, usados o combate
// todo. Sem eles o jogo corre na mesma, sem esses efeitos.
const kanekiCommonFx = await CharacterAtlas.load('assets/kaneki/fx-common')
  .catch(() => null);

// O adversário. Se falhar, fica um retângulo que anda mas não ataca.
const tanjiroCharacter = await CharacterAtlas.load('assets/tanjiro').catch((error) => {
  console.warn(`[sprites] ${error.message}. O adversário fica sem arte.`);
  return null;
});

// A arte das barras de vida e de energia. Sem ela, o HUD é o simples.
const hudAtlas = await CharacterAtlas.load('assets/hud').catch(() => null);

// "Round 1", "Fight", "K.O." e as vozes deles. Sem eles, os anúncios são só texto.
const announcerAtlas = await CharacterAtlas.load('assets/hud/announcer').catch(() => null);

// O que pertence a um combate, refeito de cada vez que ele recomeça.
let player1;
let player2;
let enemyAi;
let hud;
let healthBars;
let powerBar;
let comboCounter;

function createFighters() {
  player1 = new Kaneki({
  x: 200,
  // Já assente no chão: a entrada começa com ele sentado, e a cair do topo
  // do ecrã não fazia sentido.
  y: GROUND_Y - 165,
  color: '#2f6fed',
  facing: 1,
  bounds,
  character: kanekiCharacter,
  // A arte parada tem 55 px de altura; 165 = 3x exactos. A escala é fixa
  // para os pixels ficarem todos do mesmo tamanho, seja qual for a animação.
  spriteScale: 3,
  height: 165,
  width: 50,
  });

  player2 = new Tanjiro({
    x: 800,
    y: GROUND_Y - 150,
    color: '#e03a3a',
    facing: -1,
    bounds,
    character: tanjiroCharacter,
    ultimateBackdrops: { cuts: tanjiroCutsBackdrop, dragon: tanjiroDragonBackdrop },
    hinokamiBackdrop: tanjiroHinokamiBackdrop,
    maxHealth: TANJIRO_MAX_HEALTH,
    spriteScale: 3,
    height: 150,
    width: 50,
  });

  // Os golpes que procuram o adversário precisam de saber quem ele é.
  player1.opponent = player2;
  player2.opponent = player1;

  // Quem joga pelo Tanjiro.
  enemyAi = new EnemyAi({ fighter: player2, target: player1 });

  // Os retratos são os grandes de cada personagem; `top` é a altura da
  // faixa que aparece na janela (0 = o cimo do retrato).
  hud = hudAtlas && new Hud({
    atlas: hudAtlas,
    width: CANVAS_WIDTH,
    players: [
      {
        fighter: player1,
        name: 'KANEKI',
        portrait: { atlas: kanekiCharacter, sprite: '9000,1', top: 0.27 },
      },
      {
        fighter: player2,
        name: 'TANJIRO',
        portrait: { atlas: tanjiroCharacter, sprite: '9000,1', top: 0.3 },
      },
    ],
  });

  comboCounter = new ComboCounter({ fighters: [player1, player2], width: CANVAS_WIDTH });

  powerBar = new PowerBar({
    fighter: player1,
    x: HUD_MARGIN,
    y: CANVAS_HEIGHT - 30,
    width: 300,
  });

  healthBars = [
    new HealthBar({
      fighter: player1,
      x: HUD_MARGIN,
      y: HUD_TOP,
      width: HUD_BAR_WIDTH,
      label: 'KANEKI',
    }),
    new HealthBar({
      fighter: player2,
      x: CANVAS_WIDTH - HUD_MARGIN - HUD_BAR_WIDTH,
      y: HUD_TOP,
      width: HUD_BAR_WIDTH,
      label: 'TANJIRO',
      mirrored: true,
    }),
  ];
}

// O `player` diz de quem são as teclas; o lutador em si muda a cada combate.
const CONTROLS = [
  {
    player: 1,
    // Cada acção pode ter mais do que uma tecla. W e S não fazem nada
    // sozinhas (S agacha): escolhem a variante do golpe.
    left: ['KeyA'],
    right: ['KeyD'],
    up: ['KeyW'],
    down: ['KeyS'],
    a: ['KeyJ'],      // soco
    jump: ['KeyK'],
    dash: ['KeyL'],
    b: ['KeyO'],      // golpe pesado
    c: ['KeyU'],      // kagune
    i: ['KeyI'],      // especial
    s: ['KeyQ'],      // carregar energia
  },
  {
    player: 2,
    // O Tanjiro: as setas e os números (os de cima ou os do teclado
    // numérico). Não partilha nenhuma tecla com o jogador 1.
    left: ['ArrowLeft'],
    right: ['ArrowRight'],
    up: ['ArrowUp'],
    down: ['ArrowDown'],
    a: ['Digit1', 'Numpad1'],      // soco (combo A)
    jump: ['Digit2', 'Numpad2'],
    dash: ['Digit3', 'Numpad3'],
    c: ['Digit4', 'Numpad4'],      // espada (combo C)
    i: ['Digit5', 'Numpad5'],      // especial
    b: ['Digit6', 'Numpad6'],      // golpe pesado (combo B)
    s: ['Digit9', 'Numpad9'],      // carregar a respiração
  },
];

const camera = new Camera({ width: CANVAS_WIDTH, height: CANVAS_HEIGHT });

/** Auras, salpicos e clarões: tudo o que se desenha à volta dos lutadores. */
const effects = new EffectLayer({ width: CANVAS_WIDTH, height: CANVAS_HEIGHT });

/**
 * A cena que está a correr (o ultimate), ou null. Enquanto houver uma, o
 * combate pára: ninguém recebe teclas nem se mexe por si, é a cena que põe
 * os lutadores onde quer.
 */
let cutscene = null;

function requestCutscene(name) {
  if (cutscene || name !== 'ultimate') return;

  cutscene = createUltimate({
    kaneki: player1,
    enemy: player2,
    effects,
    fx: kanekiUltimateFx,
    stage: { width: CANVAS_WIDTH, height: CANVAS_HEIGHT, groundY: arena.groundY },
    shake: (amplitude, ticks) => camera.shake(amplitude, ticks),
    backdrop: ultimateBackdrop,
    onFinish: () => { cutscene = null; },
  });
}

/** No máximo, quanto tempo a câmara fica no inimigo durante a entrada dele. */
const INTRO_ENEMY_TICKS = 240;

/**
 * Apresentação antes do combate: a câmara abre no jogador 1 enquanto ele faz
 * a entrada, passa para o inimigo e só depois abre para o ringue inteiro.
 * `introStep` diz em que ponto vai; null = a luta já começou.
 */
let introStep = 'player1';
let introTimer = 0;

function updateIntro() {
  if (introStep === 'player1') {
    camera.focusOn(player1);
    if (!player1.isBusy) {
      introStep = 'player2';
      introTimer = INTRO_ENEMY_TICKS;
      // A entrada do adversário começa quando a câmara lá chega.
      player2.playOnce?.('intro');
    }
  } else if (introStep === 'player2') {
    camera.focusOn(player2);
    // Fica nele até a entrada acabar; o tempo é só um limite, para quem não a tem.
    introTimer -= 1;
    if (!player2.isBusy || introTimer <= 0) {
      introStep = null;
      player2.skipIntro?.();
      camera.reset();
    }
  }
}

/** Quem ganhou o round, ou null enquanto ele decorre (ou se foi empate). */
let winner = null;

/** Ticks desde que a partida acabou, e quantos passam até se poder recomeçar. */
let ticksSinceEnd = 0;
const RETRY_DELAY = 240;

// ----------------------------------------------------------------- partida

/** Rounds que é preciso ganhar (melhor de 3), e quanto dura cada round. */
const WINS_NEEDED = 2;
const ROUND_SECONDS = 99;
const TICKS_PER_SECOND = 60;
/** Depois do K.O. ou do fim do tempo, quanto dura a pose até ao round seguinte. */
const ROUND_END_TICKS = 210;

/** Os nomes de cada lado, para anunciar quem venceu. */
const NAMES = ['KANEKI', 'TANJIRO'];

/**
 * A partida: o modo ('cpu' contra o computador, '2p' a dois), os rounds
 * ganhos por cada lado e o round em que vai. `phase` diz em que ponto está o
 * round: a apresentação dos lutadores ('intro', só no primeiro), o anúncio
 * ('announce'), a luta ('fight') ou o fim ('end'). `timeLeft` são os ticks
 * que faltam no relógio.
 */
const match = {
  mode: null,
  wins: [0, 0],
  round: 1,
  phase: 'intro',
  phaseTicks: 0,
  timeLeft: 0,
  over: false,
};

const announcer = new Announcer({ atlas: announcerAtlas, width: CANVAS_WIDTH });

/** O que está no ecrã: o menu inicial ou a partida. */
let screen = 'menu';
const menu = new Menu({ input, width: CANVAS_WIDTH, height: CANVAS_HEIGHT });

function setPhase(phase) {
  match.phase = phase;
  match.phaseTicks = 0;
}

/** Começa uma partida nova no modo escolhido, com a apresentação. */
function startMatch(mode) {
  screen = 'match';
  Object.assign(match, { mode, wins: [0, 0], round: 1, over: false });
  startRound({ intro: true });
}

/**
 * Prepara um round: lutadores novos no sítio, o relógio cheio. O primeiro
 * abre com as entradas; os outros vão direitos ao anúncio, e a energia passa
 * de um round para o seguinte.
 */
function startRound({ intro = false } = {}) {
  const power = intro ? null : [player1.power, player2.power];
  if (!intro) match.round += 1;

  startFight();
  match.timeLeft = ROUND_SECONDS * TICKS_PER_SECOND;
  if (hud) {
    hud.wins = match.wins;
    hud.winsNeeded = WINS_NEEDED;
  }

  if (intro) {
    setPhase('intro');
    return;
  }
  skipIntro();
  camera.jumpToTarget();
  [player1.power, player2.power] = power;
  beginAnnounce();
}

/** "Round 1" (ou "Final Round", no que decide); o "Fight" vem a seguir. */
function beginAnnounce() {
  setPhase('announce');
  const decisive = match.wins.every((wins) => wins === WINS_NEEDED - 1) || match.round > 3;
  announcer.show(decisive ? 'finalRound' : `round${match.round}`);
}

/**
 * O K.O. em câmara lenta: durante estes frames (meio segundo e pouco), o
 * jogo só avança um em cada SLOW_EVERY, a um quarto da velocidade.
 */
const KO_SLOW_FRAMES = 40;
const SLOW_EVERY = 4;
let slowFrames = 0;

/**
 * Fecha o round: `side` é quem o ganhou (0 ou 1), ou null num empate;
 * `reason` é 'ko' ou 'time'.
 */
function endRound(side, reason) {
  setPhase('end');
  winner = side === null ? null : [player1, player2][side];
  winner?.celebrate?.();
  if (side !== null) match.wins[side] += 1;
  match.over = match.wins.some((wins) => wins >= WINS_NEEDED);
  ticksSinceEnd = 0;

  if (reason === 'ko') {
    announcer.show(side === null ? 'draw' : 'ko', { text: side === null ? 'DOUBLE K.O.' : null });
    slowFrames = KO_SLOW_FRAMES;
  } else {
    announcer.show(side === null ? 'draw' : 'timeOver');
  }
}

/**
 * O round a decorrer: das entradas ao anúncio, do anúncio à luta, e da luta
 * ao fim — por K.O. ou por o tempo acabar (ganha quem tiver mais vida).
 */
function updateRound() {
  match.phaseTicks += 1;

  if (match.phase === 'intro' && !introStep) beginAnnounce();

  // Quando o "Round" sai, entra o "Fight" e as teclas passam a contar.
  if (match.phase === 'announce' && !announcer.isShowing) {
    announcer.show('fight');
    setPhase('fight');
  }

  if (match.phase === 'fight') {
    match.timeLeft -= 1;
    const [down1, down2] = [player1.isDefeated, player2.isDefeated];
    if (down1 || down2) {
      endRound(down1 && down2 ? null : down2 ? 0 : 1, 'ko');
    } else if (match.timeLeft <= 0) {
      // Em fracção, porque o Tanjiro tem mais vida do que o Kaneki.
      const [life1, life2] = [player1.healthRatio, player2.healthRatio];
      endRound(life1 === life2 ? null : life1 > life2 ? 0 : 1, 'time');
    }
  }

  if (match.phase === 'end') {
    if (winner) camera.focusOn(winner);
    if (!match.over && match.phaseTicks > ROUND_END_TICKS) startRound();
  }

  if (hud) hud.time = Math.ceil(Math.max(0, match.timeLeft) / TICKS_PER_SECOND);
}

/** Teclas que aceitam o "tentar novamente" e saltam a apresentação. */
const CONFIRM_KEYS = ['Enter', 'NumpadEnter'];

// O Enter só conta no momento em que é premido: senão, o mesmo toque que
// recomeça o combate saltava logo a apresentação a seguir. Começa como
// premido para o toque do ecrã inicial também não contar.
let confirmHeld = true;

function readConfirm() {
  const down = CONFIRM_KEYS.some((code) => input.isPressed(code));
  const pressed = down && !confirmHeld;
  confirmHeld = down;
  return pressed;
}

/** Salta a apresentação: o Kaneki fica pronto e a câmara abre. */
function skipIntro() {
  player1.skipIntro?.();
  player2.skipIntro?.();
  introStep = null;
  camera.reset();
}

function drawSkipHint() {
  ctx.save();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.font = '14px sans-serif';
  // Ao meio, entre as barras de energia, para não tapar nenhuma.
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('Enter: pular', CANVAS_WIDTH / 2, CANVAS_HEIGHT - 16);
  ctx.restore();
}

/** Põe tudo como no início: lutadores novos, e a apresentação outra vez. */
function startFight() {
  createFighters();
  player1.requestCutscene = requestCutscene;
  player1.fxAtlases = kanekiFxAtlases;
  player2.fxAtlases = tanjiroFxAtlases;
  for (const fighter of [player1, player2]) {
    fighter.fx = new KanekiFx({
      effects,
      atlas: kanekiCommonFx,
      unit: fighter.unit,
      shake: (amplitude, ticks) => camera.shake(amplitude, ticks),
    });
  }
  game.ai = enemyAi;
  game.player1 = player1;
  game.player2 = player2;

  cutscene = null;
  winner = null;
  spotlit = null;
  ticksSinceEnd = 0;
  introStep = 'player1';
  introTimer = 0;
  effects.clear();
  camera.focusOn(player1, { snap: true });
}

/** Quem ganhou a partida, em baixo, depois do "K.O.". */
function drawMatchWinner() {
  const side = match.wins.findIndex((wins) => wins >= WINS_NEEDED);
  if (side < 0) return;

  const text = `${NAMES[side]} VENCE`;
  ctx.save();
  ctx.font = 'italic 900 44px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 7;
  ctx.strokeStyle = '#0c0d11';
  ctx.fillStyle = '#ffffff';
  ctx.strokeText(text, CANVAS_WIDTH / 2, CANVAS_HEIGHT * 0.8);
  ctx.fillText(text, CANVAS_WIDTH / 2, CANVAS_HEIGHT * 0.8);
  ctx.restore();
}

/** Tecla que, no fim da partida, volta ao menu inicial. */
const MENU_KEY = 'Backspace';

/** O ecrã de fim de combate, por cima de tudo. */
function drawRetryScreen() {
  // Surge aos poucos, para não cortar a pose de vitória.
  const fade = Math.min(1, (ticksSinceEnd - RETRY_DELAY) / 30);

  ctx.save();
  ctx.globalAlpha = fade;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 44px sans-serif';
  ctx.fillText('Tentar novamente?', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 16);
  ctx.font = '18px sans-serif';
  ctx.fillStyle = '#c9cad2';
  ctx.fillText('Enter: revanche  ·  Backspace: menu', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 34);
  ctx.restore();
}

/**
 * Destaque a meio do combate: um lutador com `spotlightTicks` (o Tanjiro a
 * ligar a Dança do Deus do Fogo) tem a câmara em cima dele; acabado o tempo,
 * ela volta ao ringue inteiro.
 */
let spotlit = null;

function updateSpotlight() {
  if (match.phase !== 'fight') {
    spotlit = null;
    return;
  }
  const lit = [player1, player2].find((fighter) => fighter.spotlightTicks > 0) ?? null;
  if (lit) camera.focusOn(lit);
  else if (spotlit) camera.reset();
  spotlit = lit;
}

const ACTIONS = ['left', 'right', 'up', 'down', 'a', 'b', 'jump', 'dash', 'c', 'i', 's'];

/** As acções que o jogador tem premidas neste tick. */
function readActions(controls) {
  const held = {};
  for (const action of ACTIONS) {
    held[action] = (controls[action] ?? []).some((code) => input.isPressed(code));
  }
  return held;
}

function handleInput() {
  // Só se luta na luta: na apresentação, nos anúncios e no fim ninguém se mexe.
  const frozen = match.phase !== 'fight';

  for (const controls of CONTROLS) {
    const { left, right, jump, attack } = controls;
    const fighter = controls.player === 1 ? player1 : player2;

    // Quem tem golpes próprios recebe as teclas e decide o que fazer.
    if (fighter.control) {
      const held = readActions(controls);

      // Contra o computador, o Tanjiro é dele e as teclas do jogador 2 não contam.
      if (controls.player === 2 && match.mode === 'cpu') {
        fighter.control(frozen ? {} : enemyAi.next());
        continue;
      }

      fighter.control(frozen ? {} : held);
      continue;
    }

    if (frozen) {
      fighter.velocity.x = 0;
      continue;
    }

    // A velocidade horizontal é recalculada a cada frame: sem tecla premida,
    // o lutador pára de imediato (resposta seca, como nos jogos de luta).
    fighter.velocity.x = 0;

    // Durante o ataque o lutador fica plantado, como é regra nos jogos de
    // luta: o golpe compromete, e é isso que dá peso às trocas. O mesmo vale
    // para a animação de entrada.
    if (!fighter.isBusy) {
      if (input.isPressed(left)) {
        fighter.velocity.x = -MOVE_SPEED;
      } else if (input.isPressed(right)) {
        fighter.velocity.x = MOVE_SPEED;
      }

      if (input.isPressed(jump)) {
        fighter.jump(JUMP_FORCE);
      }
    }

    if (input.isPressed(attack)) {
      fighter.attack?.();
    }
  }
}

/**
 * Cada lutador olha para onde anda, e fica virado para esse lado quando
 * pára — não se vira sozinho para o adversário. Os golpes saem para o lado
 * para onde ele estiver virado.
 */
function updateFacing() {
  for (const fighter of [player1, player2]) {
    // Quem recebe as teclas trata do seu próprio lado.
    if (fighter.control) continue;
    if (fighter.velocity.x !== 0) fighter.facing = Math.sign(fighter.velocity.x);
  }
}

/** Tecla que pára e retoma o jogo. */
const PAUSE_KEY = 'Escape';

let paused = false;
// Como o Enter, só conta no momento em que é premida.
let pauseHeld = false;

/** A música de fundo, para a pausa a poder calar. */
let music = null;

/** A lista de comandos de cada lado, que a pausa mostra: [teclas, o que faz]. */
const COMMAND_LISTS = [
  {
    title: 'KANEKI  ·  JOGADOR 1',
    color: '#ff4d6d',
    commands: [
      ['A / D', 'andar'],
      ['K', 'saltar (duas vezes: salto duplo)'],
      ['L', 'correr · no ar, investida'],
      ['J', 'soco · W+J gancho · S+J avanço'],
      ['O', 'pesado · S+O kagune do chão'],
      ['U', 'kagune · W+U leque · S+U chicote'],
      ['I', 'especial · W+I especial 2 (1 nível)'],
      ['S,D + J/O/U', 'especiais (1 nível)'],
      ['S,A + J/O/U', 'especiais (1 nível)'],
      ['S,D,S,D + J/O/U', 'SUPERS (1,5 a 2 níveis)'],
      ['S + I', 'ULTIMATE (barra cheia)'],
      ['Q (segurar)', 'carregar a energia'],
    ],
  },
  {
    title: 'TANJIRO  ·  JOGADOR 2',
    color: '#4da3ff',
    commands: [
      ['← / →', 'andar · 2 saltar · 3 correr'],
      ['1 / 6 / 4', 'soco · pesado · espada · 9 carregar'],
      ['↓ + 1', 'Dança do Deus do Fogo (1 nível)'],
      ['5 · ↑+5 · →+5', 'especiais (1 nível)'],
      ['↑+6 · →+6', 'especiais (1 nível)'],
      ['→+4 · ↓+4', 'roda de água · agarrão'],
      ['↑ + 4', 'super (2 níveis)'],
      ['↓+5 · ↓+6', 'ULTIMATES (barra cheia)'],
      ['↑ + 1', 'o reforço (1 nível)'],
      ['→+5 no ar', 'o corte em queda (1 nível)'],
      ['com o fogo', 'os mesmos botões dão os golpes de fogo'],
      ['fogo: ↓ + 9', 'atira a espada (4 ao pé dela apanha-a)'],
    ],
  },
];

/** Escurece o último frame e escreve por cima o aviso e os comandos. */
function drawPauseScreen() {
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.78)';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'italic 900 44px sans-serif';
  ctx.fillText('PAUSADO', CANVAS_WIDTH / 2, 62);

  // Uma coluna por jogador, cada uma com as teclas à esquerda.
  COMMAND_LISTS.forEach((list, index) => {
    const left = 70 + index * (CANVAS_WIDTH / 2);
    ctx.textAlign = 'left';
    ctx.font = 'italic 900 20px sans-serif';
    ctx.fillStyle = list.color;
    ctx.fillText(list.title, left, 125);

    list.commands.forEach(([keys, action], row) => {
      const y = 160 + row * 29;
      ctx.font = 'bold 15px sans-serif';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(keys, left, y);
      ctx.font = '15px sans-serif';
      ctx.fillStyle = '#c9cad2';
      ctx.fillText(action, left + 150, y);
    });
  });

  ctx.textAlign = 'center';
  ctx.font = '17px sans-serif';
  ctx.fillStyle = '#c9cad2';
  ctx.fillText('Esc para continuar  ·  M liga e desliga a música', CANVAS_WIDTH / 2, CANVAS_HEIGHT - 36);
  ctx.restore();
}

/** Lê a tecla de pausa e, se foi premida agora, pára ou retoma o jogo. */
function updatePause() {
  const down = input.isPressed(PAUSE_KEY);
  const pressed = down && !pauseHeld;
  pauseHeld = down;
  if (!pressed) return;

  paused = !paused;
  if (paused) {
    // O ecrã fica como estava: o aviso desenha-se uma vez só, por cima.
    drawPauseScreen();
    music?.pause();
  } else {
    music?.play().catch(() => {});
  }
}

/** O menu inicial, por cima da arena. */
function updateMenu() {
  menu.update();
  arena.draw(ctx);
  menu.draw(ctx);
  if (readConfirm()) startMatch(menu.mode);
}

function animate() {
  requestAnimationFrame(animate);

  if (screen === 'menu') {
    updateMenu();
    return;
  }

  // Em pausa nada avança: nem lutadores, nem cenas, nem efeitos.
  updatePause();
  if (paused) return;

  // Em câmara lenta, os frames que não avançam deixam o anterior no ecrã.
  if (slowFrames > 0) {
    slowFrames -= 1;
    if (slowFrames % SLOW_EVERY !== 0) return;
  }

  if (cutscene) {
    // As cenas são pensadas para o ringue inteiro.
    camera.reset();
    camera.jumpToTarget();
    cutscene.update();
  } else {
    updateIntro();
    updateRound();
    updateSpotlight();
    handleInput();
    updateFacing();
  }
  camera.update();
  effects.update();
  announcer.update();

  // Quando o ecrã treme, a arena sai uns pixels do sítio; o preto tapa a
  // faixa que ela deixa a descoberto.
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Tudo o que pertence ao ringue desenha-se através da câmara.
  ctx.save();
  camera.apply(ctx);
  // A arena preenche o canvas todo, por isso faz também de limpeza do frame.
  arena.draw(ctx);
  ctx.restore();

  // As fotografias de fundo tapam o ecrã inteiro, com ou sem zoom: essas
  // desenham-se fora da câmara, entre a arena e o resto.
  effects.draw(ctx, 'backdrop');

  ctx.save();
  camera.apply(ctx);
  effects.draw(ctx, 'back');

  if (cutscene) {
    // Numa cena os lutadores só se desenham: quem os mexe é ela.
    player1.draw(ctx);
    player2.draw(ctx);
  } else {
    player1.update(ctx);
    player2.update(ctx);
  }

  effects.draw(ctx, 'front');
  ctx.restore();

  if (cutscene) {
    cutscene.draw(ctx);
  } else {
    resolvePush([player1, player2]);
    resolveHits([player1, player2]);
  }

  // O HUD é desenhado por último para ficar sobre os lutadores.
  if (hud) {
    hud.update();
    hud.draw(ctx);
  } else {
    for (const bar of healthBars) {
      bar.update(ctx);
    }
    powerBar.draw(ctx);
  }

  comboCounter.update();
  comboCounter.draw(ctx);
  announcer.draw(ctx);

  const confirmed = readConfirm();

  if (introStep) {
    drawSkipHint();
    if (confirmed) skipIntro();
  }

  // Acabada a partida, a pose de vitória tem o seu tempo e depois pergunta-se.
  if (match.over && !cutscene) {
    ticksSinceEnd += 1;
    if (!announcer.isShowing && ticksSinceEnd <= RETRY_DELAY) drawMatchWinner();
    if (ticksSinceEnd > RETRY_DELAY) {
      drawRetryScreen();
      if (confirmed) startMatch(match.mode);
      else if (input.isPressed(MENU_KEY)) screen = 'menu';
    }
  }
}

/**
 * O browser só deixa tocar som depois de o jogador mexer na página: a música
 * começa na primeira tecla (ou clique), que é sempre no menu, antes do combate.
 */
function startMusicOnFirstInput() {
  const start = () => {
    window.removeEventListener('keydown', start);
    window.removeEventListener('pointerdown', start);
    startMusic();
  };
  window.addEventListener('keydown', start);
  window.addEventListener('pointerdown', start);
}

/** Volume da música de fundo, de 0 a 1. Baixo, para não tapar os golpes. */
const MUSIC_VOLUME = 0.35;

/**
 * Música de fundo: toca em ciclo o ficheiro assets/music.mp3, se existir.
 * A tecla M liga e desliga.
 */
function startMusic() {
  music = new Audio('assets/music.mp3');
  music.loop = true;
  music.volume = MUSIC_VOLUME;
  // Sem o ficheiro, o jogo segue em silêncio.
  music.play().catch(() => {});

  window.addEventListener('keydown', (event) => {
    if (event.code === 'KeyM' && !event.repeat) music.muted = !music.muted;
  });
}

// Atalhos de teste, na consola do browser:
//   game.player1.training = true      modo de treino: o ultimate sai sem energia
//   game.player2.takeDamage(20)       a barra de vida a esvaziar
//   game.player1.playAction(405)      qualquer animação do Kaneki, pelo número
//   game.player1.character.actionNumbers   os números que existem
//   game.player1.showBoxes = true     as caixas de colisão
//   game.player1.character.playSound(0, 43)   um som do personagem
//   game.match                        o estado da partida (rounds, relógio)
const game = { arena, camera, effects, match, restart: () => startMatch(match.mode ?? '2p') };
window.game = game;

startMusicOnFirstInput();
animate();
