import { Arena } from './Arena.js';
import { Camera } from './Camera.js';
import { EnemyAi } from './EnemyAi.js';
import { resolveHits, resolvePush } from './combat.js';
import { EffectLayer, loadPicture } from './Effects.js';
import { CharacterAtlas } from './CharacterAtlas.js';
import { Fighter } from './Fighter.js';
import { Kaneki } from './Kaneki.js';
import { KanekiFx } from './kanekiFx.js';
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

// O que pertence a um combate, refeito de cada vez que ele recomeça.
let player1;
let player2;
let enemyAi;
let hud;
let healthBars;
let powerBar;

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

/**
 * Se a máquina joga pelo jogador 2. Desligado: o Tanjiro só se mexe com as
 * teclas dele. Com `true`, é a máquina que o controla.
 */
const PLAYER2_AI = false;

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

/** Quem ganhou o combate, ou null enquanto ele decorre. */
let winner = null;

/** Ticks desde que o combate acabou, e quantos passam até se poder recomeçar. */
let ticksSinceEnd = 0;
const RETRY_DELAY = 240;

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
  ctx.fillText('Pressione Enter', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 34);
  ctx.restore();
}

/**
 * Fim do combate: quando um lutador fica sem vida, o outro faz a pose de
 * vitória e a câmara fecha nele.
 */
function updateVictory() {
  if (!winner) {
    if (player2.isDefeated) winner = player1;
    else if (player1.isDefeated) winner = player2;
    winner?.celebrate?.();
  }

  if (winner) camera.focusOn(winner);
}

/**
 * Destaque a meio do combate: um lutador com `spotlightTicks` (o Tanjiro a
 * ligar a Dança do Deus do Fogo) tem a câmara em cima dele; acabado o tempo,
 * ela volta ao ringue inteiro.
 */
let spotlit = null;

function updateSpotlight() {
  if (introStep || winner) {
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
  // Durante a apresentação e depois do fim ninguém se mexe.
  const frozen = Boolean(introStep || winner);

  for (const controls of CONTROLS) {
    const { left, right, jump, attack } = controls;
    const fighter = controls.player === 1 ? player1 : player2;

    // Quem tem golpes próprios recebe as teclas e decide o que fazer.
    if (fighter.control) {
      const held = readActions(controls);

      if (controls.player === 2 && PLAYER2_AI) {
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

/** Escurece o último frame e escreve o aviso por cima. */
function drawPauseScreen() {
  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 44px sans-serif';
  ctx.fillText('PAUSADO', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 16);
  ctx.font = '18px sans-serif';
  ctx.fillStyle = '#c9cad2';
  ctx.fillText('Esc para continuar', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 34);
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

function animate() {
  requestAnimationFrame(animate);

  // Em pausa nada avança: nem lutadores, nem cenas, nem efeitos.
  updatePause();
  if (paused) return;

  if (cutscene) {
    // As cenas são pensadas para o ringue inteiro.
    camera.reset();
    camera.jumpToTarget();
    cutscene.update();
  } else {
    updateIntro();
    updateVictory();
    updateSpotlight();
    handleInput();
    updateFacing();
  }
  camera.update();
  effects.update();

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

  const confirmed = readConfirm();

  if (introStep) {
    drawSkipHint();
    if (confirmed) skipIntro();
  }

  // Acabado o combate, a pose de vitória tem o seu tempo e depois pergunta-se.
  if (winner && !cutscene) {
    ticksSinceEnd += 1;
    if (ticksSinceEnd > RETRY_DELAY) {
      drawRetryScreen();
      if (confirmed) startFight();
    }
  }
}

/**
 * O browser só deixa tocar som depois de o jogador mexer na página, por isso
 * o combate — e a entrada, que tem som logo no primeiro instante — espera
 * por uma tecla ou um clique.
 */
function waitForStart() {
  arena.draw(ctx);

  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 28px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Pressione qualquer tecla para começar', CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
  ctx.restore();

  return new Promise((resolve) => {
    const start = () => {
      window.removeEventListener('keydown', start);
      window.removeEventListener('pointerdown', start);
      resolve();
    };
    window.addEventListener('keydown', start);
    window.addEventListener('pointerdown', start);
  });
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
const game = { arena, camera, effects, restart: startFight };
window.game = game;

startFight();
await waitForStart();
startMusic();
animate();
