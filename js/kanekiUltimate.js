import { Cutscene } from './Cutscene.js';

/**
 * A cena do ultimate do Kaneki, Rinkaku Kakuja - Full Kill, transcrita dos
 * estados 3005 a 3031 (e 3050 a 3057, os do adversário) do Kaneki.cns.
 *
 * Começa depois de o golpe de abertura (o estado 3000, em kanekiMoves.js)
 * acertar. São seis tempos: a transformação sobre o ecrã branco, duas
 * passagens em kakuja, a perseguição, a chuva de golpes no ar e o golpe
 * final. O adversário fica travado do princípio ao fim e só perde vida no
 * golpe final: um terço da que tem no máximo.
 *
 * As posições e velocidades são as do MUGEN: x é a distância ao centro do
 * ecrã, positiva para a frente do Kaneki; y a altura em relação ao chão,
 * negativa para cima.
 *
 * Duas coisas não são como no original. As barras de cinema da primeira
 * parte são desenhadas à mão, em vez de com os sprites dele. E o adversário
 * não sai do ecrã: o original atira-o para fora dele mais de uma vez, o que
 * aqui só dava um ecrã vazio.
 */

/** Marcas dos efeitos, para os tirar de cena pelo nome. */
const TAG = 'ultimate';

/**
 * Limites em que o adversário é mantido à vista, nas medidas do MUGEN. A
 * altura é a que o deixa no ar sem o meter por baixo das barras de vida.
 */
const ENEMY_MAX_X = 140;
const ENEMY_MAX_HEIGHT = -55;

/** Altura das barras de cinema, em fracção do ecrã, e ticks que levam a entrar. */
const BAR_HEIGHT = 0.13;
const BAR_TICKS = 15;

/**
 * Opacidade da fotografia de fundo da transformação, sobre o branco. Abaixo
 * de 1 fica mais clara, que é o que deixa o Kaneki ler-se por cima dela.
 */
const BACKDROP_ALPHA = 0.6;

/** Quantos ticks dura o clarão de ecrã de um impacto. */
const FLASH_TICKS = 2;
const FLASH_WHITE = '#ffffff';
const FLASH_RED = '#e01733';

/** O tremor do golpe final: amplitude nas medidas do MUGEN, e duração. */
const FINAL_SHAKE = { amplitude: 12, ticks: 45 };

/**
 * A chuva de golpes no ar: em cada rajada, a kakuja atravessa o adversário
 * vinda de várias direcções ao mesmo tempo. Quantas passagens por rajada, a
 * velocidade delas e de quão longe começam (medidas do MUGEN).
 */
const BARRAGE_STRIKES = 3;
const BARRAGE_SPEED = 14;
const BARRAGE_REACH = 84;
/** Quanto cada direcção pode fugir da repartição certa à volta dele, em graus. */
const BARRAGE_JITTER = 25;

const SLASH_SOUNDS = [[10, 75], [10, 77], [10, 79], [10, 137], [10, 80]];
const RUSH_SOUNDS = [[5, 43], [40, 3], [10, 19]];

/**
 * `fx` é o CharacterAtlas dos efeitos (assets/kaneki/fx-ultimate); sem ele a
 * cena corre só com os corpos. `stage` dá o tamanho do ecrã e a linha do
 * chão, `shake` faz o ecrã tremer — (amplitude em px, ticks) — e `backdrop`
 * é a fotografia (uma Picture) que serve de fundo à transformação.
 */
export function createUltimate({
  kaneki, enemy, effects, fx, stage, shake, backdrop = null, onFinish,
}) {
  const unit = kaneki.unit;
  const side = kaneki.facing;
  const centerX = stage.width / 2;
  const { groundY } = stage;

  // Os dois actores, nas medidas do MUGEN.
  const hero = { x: 0, y: 0, vx: 0, vy: 0, visible: true, friction: 1 };
  const foe = { x: 0, y: 0, vx: 0, vy: 0, visible: true, friction: 1 };

  /**
   * A trava da cena: o adversário deixa de ter movimento, atordoamento ou
   * pausas próprias. Daqui até ao fim só está onde a cena o puser, e só
   * perde vida no golpe final.
   */
  function lock(fighter) {
    fighter.finishMove?.();
    fighter.oneShot = null;
    fighter.isFalling = false;
    fighter.downTicks = 0;
    fighter.velocity.x = 0;
    fighter.velocity.y = 0;
    fighter.knockback = 0;
    fighter.hitStun = 0;
    fighter.hitPause = 0;
  }
  lock(enemy);
  lock(kaneki);

  // O clarão de ecrã em curso: a cor e os ticks que ainda dura.
  const flash = { color: FLASH_WHITE, ticks: 0 };
  function screenFlash(color = FLASH_WHITE) {
    flash.color = color;
    flash.ticks = FLASH_TICKS;
  }

  const worldX = (x) => centerX + x * side * unit;
  const worldY = (y) => groundY + y * unit;

  function place(fighter, actor) {
    fighter.hidden = !actor.visible;
    fighter.position.x = worldX(actor.x) - fighter.width / 2;
    fighter.position.y = worldY(actor.y) - fighter.height;
  }

  /** Avança os actores um tick e põe os lutadores onde eles estão. */
  function step() {
    for (const actor of [hero, foe]) {
      actor.x += actor.vx;
      actor.y += actor.vy;
      actor.vx *= actor.friction;
    }

    foe.x = Math.max(-ENEMY_MAX_X, Math.min(ENEMY_MAX_X, foe.x));
    foe.y = Math.max(ENEMY_MAX_HEIGHT, foe.y);

    place(kaneki, hero);
    place(enemy, foe);
    kaneki.animator.update();

    // O adversário não corre por si durante a cena: é aqui que a pose dele
    // acompanha onde está, e que o clarão de apanhar se apaga.
    enemy.animator?.play(foe.y < -2 ? 'hurtAir' : 'hurt');
    enemy.animator?.update();
    if (enemy.hitFlash > 0) enemy.hitFlash -= 1;
  }

  const sound = ([group, item], volume = 1) => kaneki.playSound?.([group, item], { volume });
  const sounds = (list) => list.forEach((entry) => sound(entry));

  const fxAnimation = (action, loop = false) => fx?.animation(action, { loop }) ?? null;
  const bodyAnimation = (action, loop = false) => (
    kaneki.character?.animation(action, { loop }) ?? null
  );

  /** Larga um efeito junto a um actor. `scale` e `velocity` nas medidas do MUGEN. */
  function spawnAt(actor, animation, {
    dx = 0, dy = 0, scale = [1, 1], velocity = [0, 0], ...options
  } = {}) {
    return effects.spawn({
      animation,
      x: worldX(actor.x + dx),
      y: worldY(actor.y + dy),
      scale: [scale[0] * unit, scale[1] * unit],
      velocity: [velocity[0] * side * unit, velocity[1] * unit],
      facing: side,
      tag: TAG,
      ...options,
    });
  }

  /** Um efeito esticado ao ecrã inteiro. */
  const cover = (animation, options = {}) => effects.spawn({
    animation, cover: true, tag: TAG, ...options,
  });

  /** A aura roxa da kakuja. */
  const aura = (actor, scale, options = {}) => spawnAt(actor, fxAnimation(3007, true), {
    scale, blend: { alpha: 0.5, additive: true }, layer: 'front', ...options,
  });

  /** O chão a brilhar por baixo da acção. */
  const floorGlow = (action = 3033) => effects.spawn({
    animation: fxAnimation(action, true),
    x: centerX,
    y: worldY(25),
    // Largo o bastante para atravessar o ecrã, seja qual for o sítio.
    scale: [5 * unit, unit],
    layer: 'back',
    blend: { additive: true },
    hold: true,
    tag: `${TAG}:glow`,
  });

  /**
   * Um golpe da kakuja a acertar no adversário: salpico de sangue, o
   * adversário a acender e um clarão branco no ecrã inteiro.
   */
  function impact({ dy = -30, scale = 0.5 } = {}) {
    spawnAt(foe, fxAnimation(3044), { dy, scale: [scale, scale], layer: 'front' });
    enemy.hitFlash = 6;
    screenFlash();
  }

  /**
   * Uma passagem da kakuja pelo adversário, na direcção `angle` (graus, 0 é
   * para a frente do Kaneki e 90 para cima): começa atrás dele, atravessa-o
   * e desaparece do outro lado, com o corpo inclinado para onde vai.
   */
  function strike(angle) {
    const radians = (angle * Math.PI) / 180;
    const dx = Math.cos(radians);
    // No MUGEN o y cresce para baixo. Se viesse de debaixo do chão, vem
    // antes de cima, na mesma inclinação.
    let dy = -Math.sin(radians);
    if (foe.y - 5 - dy * BARRAGE_REACH > 0) dy = -dy;
    const forward = dx >= 0 ? 1 : -1;

    spawnAt(foe, bodyAnimation(3022), {
      dx: -dx * BARRAGE_REACH,
      dy: -5 - dy * BARRAGE_REACH,
      velocity: [dx * BARRAGE_SPEED, dy * BARRAGE_SPEED],
      facing: side * forward,
      // O ângulo conta a partir da frente do efeito, já virado.
      angle: (Math.atan2(-dy, Math.abs(dx)) * 180) / Math.PI,
      layer: 'front',
    });
  }

  function drawFlash(ctx) {
    if (flash.ticks <= 0) return;

    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = flash.color;
    ctx.fillRect(0, 0, stage.width, stage.height);
    ctx.restore();

    // Conta pelos frames desenhados, para durar exactamente os que diz.
    flash.ticks -= 1;
  }

  function drawBars(ctx, time) {
    const height = stage.height * BAR_HEIGHT * Math.min(1, time / BAR_TICKS);
    ctx.save();
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, stage.width, height);
    ctx.fillRect(0, stage.height - height, stage.width, height);
    ctx.restore();
  }

  const phases = [
    // 3005 — o ecrã fica branco e o Kaneki transforma-se, em grande plano.
    {
      duration: 160,
      draw: drawBars,
      events: [
        {
          at: 0,
          run() {
            effects.clear(TAG);
            // Sem fotografia (ou sem os efeitos), o fundo é o do original: branco.

            // O Kaneki a sério sai de cena; o que se vê é uma cópia ampliada.
            hero.visible = false;
            hero.x = -5;
            hero.y = (stage.height * 0.74 - groundY) / unit;
            hero.vx = -0.25;
            foe.visible = false;

            cover(fxAnimation(3051), { layer: 'front' });
            cover(fxAnimation(3032, true), { layer: 'back', hold: true, tag: `${TAG}:white` });
            // A fotografia por cima do branco; sai com ele quando a fase acaba.
            if (backdrop) {
              cover(backdrop, {
                layer: 'back', hold: true, tag: `${TAG}:white`, blend: { alpha: BACKDROP_ALPHA },
              });
            }
            spawnAt(hero, bodyAnimation(3005, true), {
              scale: [2.1, 2.1], velocity: [-0.25, 0], layer: 'front', duration: 155,
            });

            sound([0, 53]);
            sound([0, 210]);
          },
        },
        { at: 72, run: () => aura(hero, [2, 1.5], { duration: 75 }) },
        {
          at: 74,
          run: () => spawnAt(hero, bodyAnimation(3006, true), {
            scale: [2.1, 2.1], layer: 'front', duration: 59,
          }),
        },
        { at: 75, run: () => sounds([[0, 203], [5, 75], [500, 7]]) },
        { at: 130, run: () => sounds(RUSH_SOUNDS) },
        { at: 133, run: () => { hero.vx = 25; } },
      ],
      tick: step,
    },

    // 3010 — primeira passagem: atravessa o ecrã atrás do adversário.
    {
      duration: 125,
      events: [
        {
          at: 0,
          run() {
            effects.clear(`${TAG}:white`);

            kaneki.pose(3010);
            Object.assign(hero, { x: -250, y: 0, vx: 0, vy: 0, visible: true, friction: 1 });
            Object.assign(foe, { x: -120, y: 0, vx: 0, vy: 0, visible: true });

            cover(fxAnimation(3034, true), { layer: 'front', hold: true, tag: `${TAG}:dark` });
            floorGlow();
            aura(hero, [1.25, 0.5], { duration: 150 });
          },
        },
        { at: 10, run: () => { foe.vx = 20; } },
        {
          at: 25,
          run() {
            hero.vx = 22.5;
            sounds(RUSH_SOUNDS);
          },
        },
        { at: 30, run: () => sound([0, 89]) },
        { at: 35, run: () => { foe.vx = 0.25; hero.friction = kaneki.constants.friction; } },
        { at: 50, run: () => sound([10, 65]) },
        { at: 55, run: () => { impact(); sounds(SLASH_SOUNDS); } },
        { at: 65, run: () => sounds(SLASH_SOUNDS) },
        { at: 70, run: () => impact() },
        {
          at: 75,
          run() {
            Object.assign(hero, { vx: 25, vy: 10, friction: 1 });
            Object.assign(foe, { y: 0, vx: 0.5, vy: -1.5 });
            sounds([[10, 74], [10, 32]]);
          },
        },
      ],
      tick: step,
    },

    // 3015 — segunda passagem: sobe por baixo e corta para trás.
    {
      duration: 100,
      events: [
        {
          at: 0,
          run() {
            effects.clear(`${TAG}:glow`);

            kaneki.pose(3015);
            Object.assign(hero, { x: -150, y: 100, vx: 0, vy: 0 });
            sound([0, 211]);
          },
        },
        {
          at: 1,
          run() {
            Object.assign(hero, { vx: 5, vy: -10 });
            aura(hero, [0.625, 0.25], { duration: 150 });
            floorGlow();
          },
        },
        { at: 20, run: () => sounds([[0, 7], [10, 65]]) },
        {
          at: 25,
          run() {
            // O adversário é apanhado à altura do Kaneki.
            Object.assign(foe, { x: foe.x - 15, y: hero.y, vx: 0, vy: 0 });
            impact({ dy: -5, scale: 0.4 });
            sounds(SLASH_SOUNDS);
          },
        },
        { at: 35, run: () => sounds(SLASH_SOUNDS) },
        { at: 40, run: () => impact({ dy: -5, scale: 0.4 }) },
        { at: 45, run: () => { hero.vx = -15; sounds([[10, 74], [10, 32]]); } },
        { at: 50, run: () => { foe.vx = 10; } },
      ],
      tick: step,
    },

    // 3020 — perseguição: a kakuja passa a rasar e acerta-lhe em cheio.
    {
      duration: 72,
      events: [
        {
          at: 0,
          run() {
            effects.clear(`${TAG}:glow`);
            hero.visible = false;
            Object.assign(hero, { x: -50, y: foe.y, vx: 0, vy: 0 });

            const streak = { x: -160, y: 30, vx: 0, vy: 0 };
            spawnAt(streak, bodyAnimation(3020, true), {
              scale: [1.5, 1.5], velocity: [25, 0], blend: { alpha: 0.4, additive: true },
              layer: 'front', duration: 50,
            });
            aura(streak, [1.24, 0.5], { velocity: [25, 0] });
            floorGlow();

            sounds([[0, 90], ...RUSH_SOUNDS]);
          },
        },
        { at: 50, run: () => sounds([[0, 91], ...RUSH_SOUNDS]) },
        {
          at: 61,
          run() {
            spawnAt(foe, bodyAnimation(3020, true), {
              dx: -240, velocity: [25, 0], layer: 'front', duration: 50,
            });
            aura(foe, [0.625, 0.25], { dx: -245, velocity: [25, 0] });
          },
        },
        // O adversário pára ao centro à espera do golpe.
        { at: 65, run: () => Object.assign(foe, { x: 0, vx: 0 }) },
        {
          at: 71,
          run() {
            impact({ dy: -25 });
            sounds([...SLASH_SOUNDS, [10, 74]]);
            // E é atirado ao ar.
            foe.vy = -9;
          },
        },
      ],
      tick: step,
    },

    // 3025 — o adversário fica no ar e a kakuja atravessa-o sem parar.
    {
      duration: 225,
      events: [
        { at: 0, run: () => sound([0, 212]) },
        {
          at: 40,
          run() {
            foe.vy = -0.75;
            effects.clear(`${TAG}:dark`);
            effects.clear(`${TAG}:glow`);
            floorGlow(3037);
            sound([0, 95]);
          },
        },
        {
          at: 40,
          every: 5,
          run() {
            // Várias passagens de uma vez, repartidas à volta dele e de cada
            // vez rodadas ao acaso: acerta-lhe de todos os lados.
            const start = Math.random() * 360;
            for (let i = 0; i < BARRAGE_STRIKES; i += 1) {
              const spread = (360 / BARRAGE_STRIKES) * i;
              strike(start + spread + (Math.random() * 2 - 1) * BARRAGE_JITTER);
            }
            // O sangue a saltar num ponto ao acaso do corpo.
            spawnAt(foe, fxAnimation(3044), {
              dx: Math.random() * 30 - 15,
              dy: -20 - Math.random() * 25,
              scale: [0.25, 0.25],
              layer: 'front',
            });
            // Um clarão curto por golpe: se durasse os 5 ticks até ao
            // seguinte, o adversário ficava branco o tempo todo.
            enemy.hitFlash = 2;
          },
        },
        { at: 40, every: 8, run: () => sounds(SLASH_SOUNDS) },
        { at: 214, run: () => sound([0, 54]) },
      ],
      tick() {
        // O Kaneki anda escondido em cima do adversário.
        Object.assign(hero, { x: foe.x, y: foe.y });
        step();
      },
    },

    // 3030 — o golpe final, com a kakuja toda aberta.
    {
      duration: 200,
      events: [
        {
          at: 0,
          run() {
            kaneki.pose(3025);
            hero.visible = true;
            // O adversário sai por baixo e volta a subir contra o Kaneki.
            Object.assign(foe, { visible: false, vx: 0, vy: 0 });
            aura(hero, [1.25, 0.75], { hold: true });
            sound([0, 213]);
          },
        },
        {
          at: 25,
          run: () => Object.assign(foe, { visible: true, x: hero.x, y: 60, vy: -14 }),
        },
        {
          at: 60,
          run() {
            Object.assign(foe, { y: hero.y, vy: 0 });
            spawnAt(hero, fxAnimation(3044), { dy: -30, scale: [0.75, 0.75], layer: 'front' });
            cover(fxAnimation(3042, true), { layer: 'front', hold: true });
            enemy.hitFlash = 10;
            // O golpe final: clarão vermelho e o ecrã a tremer.
            screenFlash(FLASH_RED);
            shake?.(FINAL_SHAKE.amplitude * unit, FINAL_SHAKE.ticks);
            sounds([[10, 143], [10, 145], [10, 76], [10, 80]]);
          },
        },
        {
          at: 63,
          run: () => spawnAt(hero, bodyAnimation(3026, true), {
            scale: [1.8, 1.8], blend: { alpha: 0.5, additive: true }, layer: 'back', duration: 175,
          }),
        },
        { at: 70, run: () => { foe.visible = false; } },
        {
          at: 155,
          every: 5,
          until: 175,
          run: () => cover(fxAnimation(3038, true), { layer: 'front', hold: true }),
        },
      ],
      tick: step,
    },

    // 3031 — o ecrã abre: o Kaneki de pé e o adversário no chão.
    {
      duration: 50,
      events: [
        {
          at: 0,
          run() {
            effects.clear(TAG);
            effects.clear(`${TAG}:glow`);
            effects.clear(`${TAG}:dark`);

            const x = Math.max(-100, Math.min(60, hero.x));
            Object.assign(hero, { x, y: 0, vx: 0, vy: 0, visible: true });
            Object.assign(foe, { x: x + 50, y: 0, vx: 0, vy: 0, visible: true });
            kaneki.pose(0, { loop: true });

            cover(fxAnimation(3039), { layer: 'front', tag: null });
            cover(fxAnimation(3043), { layer: 'front', tag: null });

            // O dano da cena inteira, de uma vez: um terço da vida.
            enemy.takeDamage(enemy.maxHealth / 3);
            enemy.hitFlash = 10;

            // A poça de sangue aos pés do adversário, se o golpe o matou.
            if (enemy.isDefeated) {
              spawnAt(foe, fxAnimation(3045, true), {
                dy: 3, scale: [0.2, 0.15], layer: 'back', duration: 600, tag: null,
              });
            }
          },
        },
      ],
      tick: step,
    },
  ];

  return new Cutscene(phases, {
    overlay: drawFlash,
    onFinish() {
      kaneki.hidden = false;
      enemy.hidden = false;
      // Sai da cena sem restos dela: parado, no chão, pronto a continuar.
      lock(enemy);
      lock(kaneki);
      onFinish?.();
    },
  });
}
