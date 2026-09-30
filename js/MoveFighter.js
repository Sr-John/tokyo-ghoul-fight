import { SpriteFighter } from './SpriteFighter.js';

/**
 * Lutador com golpes a sério: uma tabela de golpes (ver kanekiMoves.js) diz
 * o que cada um anima, como se mexe, o que faz ao acertar e para que outros
 * pode encadear, e esta classe executa-a tick a tick.
 *
 * É a parte do MUGEN que o jogo precisa para os golpes se portarem como no
 * original, e só essa: cada golpe é um estado com tempo próprio, impulsos
 * marcados para certos ticks, e regras de encadeamento que lêem as teclas.
 *
 * As medidas da tabela são as do MUGEN; aqui passam para o ecrã
 * multiplicadas pela ampliação da arte (`unit`).
 */

/** Ticks em que uma tecla premida ainda conta, para os combos não exigirem o tick exacto. */
const BUFFER_TICKS = 8;

/** Intervalo máximo entre os dois toques de uma corrida. */
const DOUBLE_TAP_TICKS = 12;

/** Os botões: uma pressão fica guardada uns ticks. As direcções não. */
const BUTTONS = ['a', 'b', 'c', 'i', 's', 'jump'];

/** De quantos em quantos ticks a corrida larga pó e um golpe larga rasto. */
const DASH_DUST_EVERY = 4;
const TRAIL_EVERY = 3;
/** De quantos em quantos ticks a corrida larga uma cópia desfocada. */
const SPEED_GHOST_EVERY = 2;

/** Dano (nas medidas do MUGEN) a partir do qual um golpe é pesado, e racha o chão. */
const HEAVY_DAMAGE = 25;
const GROUND_BREAK_DAMAGE = 33;

/** Quantas direcções premidas se guardam para reconhecer os comandos. */
const DIRECTION_LOG_SIZE = 8;

const NO_INPUT = Object.freeze({
  left: false,
  right: false,
  up: false,
  down: false,
  jump: false,
  dash: false,
  a: false,
  b: false,
  c: false,
  i: false,
  s: false,
});

export class MoveFighter extends SpriteFighter {
  constructor({
    moveSet = {},
    commands = { ground: [], air: [] },
    constants,
    ...options
  }) {
    super(options);

    this.moveSet = moveSet;
    this.commands = commands;
    this.constants = constants;

    /** Pixels de ecrã por pixel da arte: a escala das medidas do MUGEN. */
    this.unit = this.spriteScale ?? 1;
    this.gravity = constants.gravity * this.unit;

    /** Energia para correr a meio de um combo e, mais tarde, para os especiais. */
    this.power = 0;
    this.maxPower = constants.maxPower;

    /** O adversário, para os golpes que o procuram. Quem o define é o jogo. */
    this.opponent = null;

    // O golpe em curso: a entrada da tabela, o seu número, o do estado de
    // onde se veio (0 = livre) e há quantos ticks dura.
    this.move = null;
    this.moveId = 0;
    this.prevMoveId = 0;
    this.moveTime = 0;
    this.physics = 'S';
    this.wasAirborne = false;

    // O que o golpe em curso já fez: se acertou, quantas vezes, e com que
    // `hit` está armado neste momento.
    this.moveHit = false;
    this.activeHit = null;
    this.hitCount = 0;

    // Teclas: o estado deste tick, e as premidas há pouco (nome -> ticks que
    // ainda valem).
    this.input = NO_INPUT;
    this.buffer = {};
    this.clock = 0;
    this.lastTap = { direction: 0, at: -Infinity };
    this.dashDirection = 1;

    // As últimas direcções premidas ('F' frente, 'B' trás, 'D' baixo, 'U'
    // cima) e quando, para os comandos em sequência.
    this.directionLog = [];

    /** Pedido de cena (o ultimate): quem a corre é o jogo. */
    this.requestCutscene = null;

    /** Modo de treino: o que exige energia sai sem ela. Liga-se pela consola. */
    this.training = false;

    this.airJumpsLeft = 0;
    this.airDashesLeft = 0;

    /** Partes do golpe que vivem fora do corpo, como a kagune que sai do chão. */
    this.helpers = [];

    /** Quem larga os efeitos (um KanekiFx). Quem o define é o jogo. */
    this.fx = null;

    /** O golpe em curso já rachou o chão. */
    this.hasBrokenGround = false;

    this.sounds = { ...this.sounds, ...this.moveSounds() };
  }

  // ------------------------------------------------------------------ teclas

  /**
   * Recebe as teclas deste tick: as direcções (left, right, up, down), os
   * botões de ataque (a, b, c, i), jump, dash e s (carregar).
   * Chama-se uma vez por tick, antes do update.
   */
  control(input) {
    const previous = this.input;
    this.input = { ...NO_INPUT, ...input };
    this.clock += 1;

    // Durante a pausa de um impacto as teclas guardadas não gastam tempo:
    // é o que deixa carregar no botão seguinte a meio do golpe e o combo sair.
    if (this.hitPause === 0) {
      for (const name of Object.keys(this.buffer)) {
        if (this.buffer[name] > 0) this.buffer[name] -= 1;
      }
    }

    for (const button of BUTTONS) {
      if (this.input[button] && !previous[button]) this.buffer[button] = BUFFER_TICKS;
    }

    this.logDirections(previous);
    this.detectMotions(previous);

    // O botão de corrida: para o lado que se estiver a segurar, ou em frente.
    if (this.input.dash && !previous.dash) {
      const held = (this.input.right ? 1 : 0) - (this.input.left ? 1 : 0);
      this.buffer.dash = BUFFER_TICKS;
      this.dashDirection = held || this.facing;
    }

    // Dois toques seguidos na mesma direcção também correm.
    for (const [key, direction] of [['left', -1], ['right', 1]]) {
      if (!this.input[key] || previous[key]) continue;

      const isDoubleTap = this.lastTap.direction === direction
        && this.clock - this.lastTap.at <= DOUBLE_TAP_TICKS;
      if (isDoubleTap) {
        this.buffer.dash = BUFFER_TICKS;
        this.dashDirection = direction;
      }
      this.lastTap = { direction, at: this.clock };
    }
  }

  /** Regista as direcções acabadas de premir, em relação ao lado para onde olha. */
  logDirections(previous) {
    const forward = this.facing === 1 ? 'right' : 'left';
    const backward = this.facing === 1 ? 'left' : 'right';

    for (const [key, direction] of [[forward, 'F'], [backward, 'B'], ['down', 'D'], ['up', 'U']]) {
      if (!this.input[key] || previous[key]) continue;
      this.directionLog.push({ direction, at: this.clock });
      if (this.directionLog.length > DIRECTION_LOG_SIZE) this.directionLog.shift();
    }
  }

  /**
   * Comandos em sequência (meia-lua e afins): as direcções, por ordem e
   * dentro do tempo, seguidas do botão. Quando um sai, fica premido com o
   * nome dele, como se fosse uma tecla.
   */
  detectMotions(previous) {
    for (const motion of this.commands.motions ?? []) {
      if (!this.input[motion.button] || previous[motion.button]) continue;

      let next = motion.sequence.length - 1;
      for (let i = this.directionLog.length - 1; i >= 0 && next >= 0; i--) {
        const entry = this.directionLog[i];
        if (this.clock - entry.at > motion.window) break;
        if (entry.direction === motion.sequence[next]) next -= 1;
      }

      if (next < 0) this.buffer[motion.name] = BUFFER_TICKS;
    }
  }

  /** Gasta uma tecla premida há pouco. Devolve se havia. */
  take(name) {
    if (!(this.buffer[name] > 0)) return false;
    this.buffer[name] = 0;
    return true;
  }

  /** A segurar a corrida: a direcção para onde olha, ou o botão de correr. */
  get isHoldingForward() {
    return this.input.dash || (this.facing === 1 ? this.input.right : this.input.left);
  }

  /**
   * Põe o lutador junto de outro: `dx` para a frente dele e `dy` acima dos
   * pés (negativo = mais alto), nas medidas do MUGEN. Com dy a null, no chão.
   */
  jumpTo(target, dx = 0, dy = null) {
    const targetX = target.position.x + target.width / 2;
    this.position.x = targetX + dx * this.facing * this.unit - this.width / 2;
    this.position.y = dy === null
      ? this.groundY
      : target.position.y + target.height - this.height + dy * this.unit;
  }

  // ------------------------------------------------------------------ medidas

  /** Velocidade para a frente, nas medidas do MUGEN. */
  get forwardSpeed() {
    return (this.velocity.x * this.facing) / this.unit;
  }

  set forwardSpeed(value) {
    this.velocity.x = value * this.facing * this.unit;
  }

  /** `x` é para a frente do lutador; o que não vier fica como está. */
  setVelocity({ x, y }) {
    if (x !== undefined) this.forwardSpeed = x;
    if (y !== undefined) this.velocity.y = y * this.unit;
  }

  setPhysics(physics) {
    this.physics = physics;
    this.gravity = physics === 'N' ? 0 : this.constants.gravity * this.unit;
  }

  addPower(amount) {
    this.power = Math.max(0, Math.min(this.maxPower, this.power + amount));
  }

  get powerRatio() {
    return this.power / this.maxPower;
  }

  moveAnimation(id) {
    return this.animator.animations.get(`move:${id}`) ?? null;
  }

  /** Tick do golpe em que começa o frame `elem` (o primeiro é o 1). */
  elemStart(elem, id = this.moveId) {
    return elem <= 1 ? 0 : this.moveAnimation(id)?.frameEnds[elem - 2] ?? 0;
  }

  /** Tick do golpe a que um acontecimento da tabela se refere. */
  eventTime(event, id = this.moveId) {
    return (event.time ?? this.elemStart(event.elem, id)) + (event.offset ?? 0);
  }

  /** Os sons dos golpes, na forma que o SpriteFighter toca. */
  moveSounds() {
    const sounds = {};
    for (const [id, move] of Object.entries(this.moveSet)) {
      if (!move.sounds || !this.moveAnimation(id)) continue;
      // O tick 0 do golpe é o primeiro tick da animação.
      sounds[`move:${id}`] = move.sounds.map(
        (cue) => ({ ...cue, at: this.eventTime(cue, id) + 1 }),
      );
    }
    return sounds;
  }

  // ------------------------------------------------------------------ estados

  /**
   * Fora de controlo: a fazer a entrada, a apanhar, ou já em pose de
   * vitória. Quem ganha a meio de um golpe acaba-o primeiro.
   */
  get isLocked() {
    return this.oneShot !== null
      || this.hitStun > 0
      || this.isFalling
      || this.downTicks > 0
      || this.isDefeated
      || (this.isVictorious && !this.move);
  }

  get isBusy() {
    return super.isBusy || this.move !== null;
  }

  think() {
    if (this.isLocked) {
      if (this.move) this.finishMove();
      if (this.isOnGround) this.velocity.x = 0;
      return;
    }

    if (this.move) this.updateMove();
    else this.updateFree();
  }

  /** Livre: andar, saltar e começar golpes. */
  updateFree() {
    const { input, constants } = this;
    const direction = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const grounded = this.isOnGround;

    if (grounded) {
      this.airJumpsLeft = constants.airJump.count;
      this.airDashesLeft = constants.airDashes;
    }

    for (const command of grounded ? this.commands.ground : this.commands.air) {
      if (command.down && !input.down) continue;
      if (command.up && !input.up) continue;
      if (command.forward && !input.left && !input.right) continue;
      if (command.power && this.power < command.power) continue;
      if (command.unlessFullPower && this.power >= this.maxPower) continue;
      if (command.airDash && this.airDashesLeft <= 0) continue;
      if (command.when && !command.when(this)) continue;
      if (!this.moveAnimation(command.to)) continue;
      if (!this.take(command.input)) continue;

      if (command.airDash) this.airDashesLeft -= 1;
      if (command.input === 'dash') this.facing = this.dashDirection;
      this.startMove(command.to);
      return;
    }

    if ((grounded || this.airJumpsLeft > 0) && this.take('jump')) {
      this.leap(direction);
      return;
    }

    // No ar não se muda de rumo: o salto leva a velocidade com que saiu.
    if (!grounded) return;

    if (direction) this.facing = direction;
    this.velocity.x = input.down ? 0 : direction * constants.walk * this.unit;
  }

  // ------------------------------------------------------------------ efeitos

  // Os momentos do combate que largam efeitos, com os que são iguais para
  // todos: poeira, faíscas, o chão a rachar, o rasto. Sem `fx` não fazem nada.

  /** Saiu do chão (ou deu o salto duplo). `direction` é para onde vai. */
  onLeap(grounded, direction) {
    if (grounded) this.fx?.jump(this, direction !== 0);
  }

  /** Tocou no chão vindo do ar. */
  onLand() {
    this.fx?.land(this);
  }

  /** Começou um golpe. */
  onMoveStart() {
    this.hasBrokenGround = false;
    if (this.move.dash === 'ground') this.fx?.dashStart(this);
    if (this.move.dash === 'air') this.fx?.airDash(this);
  }

  /** Um tick de um golpe em curso. */
  onMoveTick() {
    const { move, moveTime } = this;
    if (move.dash === 'ground' && moveTime % DASH_DUST_EVERY === 0) this.fx?.dashTrail(this);
    if (move.dash) {
      // A correr, o corpo fica desfocado e vai largando cópias para trás.
      this.startSpeedBlur();
      if (moveTime % SPEED_GHOST_EVERY === 0) this.fx?.speedGhost(this);
    }
    if (move.trail && moveTime % TRAIL_EVERY === 0) this.fx?.ghost(this);
  }

  /** Um golpe acertou: { point, defender, hit }, com o `hit` da tabela. */
  onHitLanded({ point, defender, hit }) {
    if (!this.fx) return;
    // Os toques que só seguram o adversário, sem lhe tirar vida, não faíscam.
    if (!hit.damage && !hit.ratio) return;

    // O golpe pode dizer que faísca quer; senão, vai pelo tipo e pela força.
    const byForce = hit.damage >= HEAVY_DAMAGE ? 'heavy' : 'punch';
    const kind = hit.spark ?? (this.move?.trail || hit.slash ? 'slash' : byForce);
    this.fx.hit(point, kind, this.facing);

    // Os golpes que levantam o adversário, e os mais fortes, racham o chão
    // debaixo dele; os de vários toques só o racham uma vez.
    const breaksGround = (hit.push[1] < 0 || hit.damage >= GROUND_BREAK_DAMAGE) && hit.damage > 0;
    if (breaksGround && !this.hasBrokenGround && defender.isOnGround) {
      this.hasBrokenGround = true;
      const groundY = this.bounds.groundY ?? this.bounds.height;
      this.fx.groundBreak(defender.position.x + defender.width / 2, groundY, this.facing);
    }
  }

  /** A kagune (ou o que for) rebentou do chão no ponto x. */
  onSpike(x) {
    const groundY = this.bounds.groundY ?? this.bounds.height;
    this.fx?.groundBreak(x, groundY, this.facing);
  }

  /**
   * Salta; no ar, gasta o salto duplo. `direction` é o lado para onde se
   * está a segurar: vira o lutador e, se o salto tiver velocidade
   * horizontal, leva-o para lá.
   */
  leap(direction) {
    const { jump, airJump } = this.constants;
    const grounded = this.isOnGround;

    if (!grounded) this.airJumpsLeft -= 1;
    if (direction) this.facing = direction;
    this.onLeap(grounded, direction);
    this.velocity.y = jump.y * this.unit;
    this.velocity.x = direction * (grounded ? jump.x : airJump.x) * this.unit;
  }

  startMove(id) {
    const move = this.moveSet[id];
    const animation = this.moveAnimation(id);
    if (!move || !animation) return false;

    this.prevMoveId = this.moveId;
    this.moveId = id;
    this.move = move;
    this.moveTime = 0;
    this.wasAirborne = !this.isOnGround;

    this.moveHit = false;
    this.activeHit = null;
    this.hitCount = 0;
    this.hasHit = false;
    this.isAttacking = false;
    this.currentMove = null;

    // Os golpes de uma sequência viram-se para o adversário antes de bater.
    if (move.turn && this.opponent) {
      const gap = (this.opponent.position.x + this.opponent.width / 2)
        - (this.position.x + this.width / 2);
      this.facing = Math.sign(gap) || this.facing;
    }

    this.animator.play(`move:${id}`, { restart: true });
    this.setPhysics(move.physics ?? 'S');
    if (move.stop) this.setVelocity({ x: 0, y: 0 });

    const power = typeof move.power === 'function' ? move.power(this.prevMoveId, this) : move.power;
    this.addPower(power ?? 0);

    this.runMoveEvents();
    this.onMoveStart(id);
    return true;
  }

  /** Acaba o golpe e devolve o controlo. */
  finishMove() {
    this.move = null;
    this.moveId = 0;
    this.activeHit = null;
    this.isAttacking = false;
    this.currentMove = null;
    this.setPhysics('S');
  }

  updateMove() {
    const { move } = this;
    this.moveTime += 1;

    // Um golpe aéreo acaba quando os pés voltam ao chão.
    if (!this.isOnGround) {
      this.wasAirborne = true;
    } else if (this.wasAirborne && this.physics === 'A' && this.velocity.y >= 0) {
      // Alguns continuam no chão com outro golpe (`landsInto`).
      if (move.landsInto !== undefined) this.startMove(move.landsInto);
      else this.endMoveIntoFree();
      return;
    }

    const over = move.duration
      ? this.moveTime >= move.duration
      : !move.loop && this.moveTime >= this.moveAnimation(this.moveId).totalTicks;
    const interrupted = move.interruptAt
      && this.moveTime >= move.interruptAt
      && Object.values(this.input).some(Boolean);
    if (over) {
      // No último tick o golpe ainda pode passar a outro por si (os que se
      // seguem a um golpe que acertou decidem-no no `tick`).
      move.tick?.(this);
      if (this.move !== move) return;
    }
    if (over && move.next !== undefined) {
      // Um golpe que se segue a outro sem esperar por tecla.
      this.startMove(move.next);
      return;
    }
    if (over || interrupted) {
      this.endMoveIntoFree();
      return;
    }

    this.runMoveEvents();

    if (this.moveHit && move.onHitHold) this.setVelocity(move.onHitHold);
    if (this.physics === 'S') this.velocity.x *= this.constants.friction;
    if (move.drag && !move.dragUnless?.(this.prevMoveId)) this.applyDrag(move.drag);

    move.tick?.(this);
    // O tick do golpe pode tê-lo trocado por outro.
    if (this.move !== move) return;
    this.onMoveTick();

    this.checkChains();
  }

  endMoveIntoFree() {
    this.finishMove();
    if (!this.isLocked) this.updateFree();
  }

  /** O que a tabela marca para este tick: impulsos, trocas de física, golpes a armar. */
  runMoveEvents() {
    const { move, moveTime: time, prevMoveId: previous } = this;

    for (const event of move.velocity ?? []) {
      if (this.eventTime(event) !== time) continue;
      if (event.from && !event.from(previous)) continue;
      if (event.unlessHit && this.moveHit) continue;
      this.setVelocity(event);
    }

    for (const event of move.physicsAt ?? []) {
      if (this.eventTime(event) === time) this.setPhysics(event.physics);
    }

    if (move.hit && time === 0) this.arm(move.hit);
    for (const hit of move.hits ?? []) {
      if (this.eventTime(hit) === time) this.arm(hit);
    }

    if (move.spike && this.eventTime(move.spike) === time) this.spawnSpike(move.spike);
    for (const spec of move.projectiles ?? []) {
      if (this.eventTime(spec) === time) this.spawnProjectile(spec);
    }
  }

  /** Travagem no ar: [no x, a cair, a subir], nas medidas do MUGEN. */
  applyDrag([x, falling, rising]) {
    const forward = this.forwardSpeed;
    if (forward > 1) this.forwardSpeed = forward - x;
    else if (forward < -1) this.forwardSpeed = forward + x;

    const vertical = this.velocity.y / this.unit;
    if (vertical > -1) this.velocity.y -= falling * this.unit;
    else this.velocity.y += rising * this.unit;
  }

  checkChains() {
    const { move } = this;

    for (const chain of move.chains ?? []) {
      // 'hit' e 'contact' só diferem quando há defesa, que o jogo não tem.
      if (chain.on && !this.moveHit) continue;
      if (chain.minTime && this.moveTime < chain.minTime) continue;
      if (chain.minElem && this.moveTime < this.elemStart(chain.minElem)) continue;
      if (chain.down && !this.input.down) continue;
      if (chain.power && this.power < chain.power) continue;
      if (!this.take(chain.input)) continue;

      if (chain.input === 'dash') this.facing = this.dashDirection;

      if (chain.to === 'jump') {
        this.finishMove();
        this.leap((this.input.right ? 1 : 0) - (this.input.left ? 1 : 0));
      } else {
        this.startMove(typeof chain.to === 'function' ? chain.to(this.prevMoveId) : chain.to);
      }
      return;
    }
  }

  // ------------------------------------------------------------------ acertar

  /** Passa um `hit` da tabela para o que o resto do jogo entende. */
  toGameHit(hit) {
    const [pushX, pushY] = hit.push;
    // `ratio` tira uma fracção da vida máxima do adversário, seja ela qual for.
    const share = (hit.ratio ?? 0) * (this.opponent?.maxHealth ?? 0);

    return {
      damage: hit.damage * this.constants.damageScale + share,
      // Na tabela, x negativo afasta o adversário.
      knockback: -pushX * this.unit,
      // Só levanta; o y positivo (atirar ao chão) não tem efeito em quem já lá está.
      launch: Math.min(0, pushY) * this.unit,
      fall: Boolean(hit.fall),
      stun: hit.stun,
      pause: hit.pause[1],
      sounds: hit.sounds ?? [],
    };
  }

  arm(hit) {
    this.activeHit = hit;
    this.hitCount = 0;
    this.hasHit = false;
    this.isAttacking = true;
    this.currentMove = this.toGameHit(hit);
  }

  registerHit(impact) {
    super.registerHit(impact);

    if (impact) this.onHitLanded({ ...impact, hit: this.activeHit });
    this.moveHit = true;

    // O que o golpe faz a quem o dá, no instante em que acerta: um impulso
    // e, em alguns, vida de volta.
    if (this.move?.onHit) this.setVelocity(this.move.onHit);
    if (this.move?.heal) this.heal(this.move.heal * this.constants.damageScale);
    this.hitCount += 1;
    // O impacto segura o Kaneki uns ticks, como quem o dá.
    this.hitPause = this.activeHit.pause[0];
    // Os golpes de vários toques voltam a armar-se.
    if (this.hitCount < (this.activeHit.max ?? 1)) this.hasHit = false;
  }

  /**
   * Larga um projéctil: uma parte do golpe que vive fora do corpo, com
   * animação, posição e caixas de ataque próprias, e que continua mesmo
   * depois de o golpe acabar. `spec` é uma entrada de `projectiles` da
   * tabela:
   *
   *   action, endAction  a animação, e a que toca ao desaparecer
   *   at                 [x, y] a partir dos pés de quem o larga
   *   bound              anda agarrado a quem o largou
   *   velocity           [x, y] por tick, se andar sozinho
   *   scale              ampliação, além da da arte
   *   lifetime           ticks que dura
   *   hit                o que faz ao acertar (como o `hit` de um golpe)
   *   every              volta a poder acertar de tantos em tantos ticks
   *   armAfter           só começa a acertar passados tantos ticks
   *   finalHit           um último golpe, ao acabar, durante `finalTicks`
   *   sounds             sons ao aparecer
   */
  spawnProjectile(spec, origin = {}) {
    const animation = this.animator.animations.get(`helper:${spec.action}`);
    if (!animation) return null;

    const [dx, dy] = spec.at ?? [0, 0];
    const velocity = spec.velocity ?? [0, 0];
    const helper = {
      x: origin.x ?? this.position.x + this.width / 2 + dx * this.facing * this.unit,
      y: origin.y ?? this.position.y + this.height + dy * this.unit,
      bound: spec.bound ? [dx, dy] : null,
      velocity: [velocity[0] * this.facing * this.unit, velocity[1] * this.unit],
      facing: this.facing,
      scale: spec.scale ?? 1,
      tick: 0,
      animation,
      endAnimation: this.animator.animations.get(`helper:${spec.endAction}`) ?? null,
      lifetime: spec.lifetime,
      hit: spec.hit ? this.toGameHit(spec.hit) : null,
      source: spec.hit ?? null,
      hasHit: false,
      lastHit: -Infinity,
      every: spec.every ?? 0,
      armAfter: spec.armAfter ?? 0,
      final: spec.finalHit
        ? { hit: this.toGameHit(spec.finalHit), source: spec.finalHit, ticks: spec.finalTicks ?? 10 }
        : null,
    };
    this.helpers.push(helper);

    for (const cue of spec.sounds ?? []) this.playSound?.(cue.sound, cue);
    return helper;
  }

  /** A kagune que sai do chão: aparece ao pé do adversário e acerta sozinha. */
  spawnSpike(spike) {
    const centerX = this.position.x + this.width / 2;

    let offset = spike.fallback;
    if (this.opponent) {
      const opponentX = this.opponent.position.x + this.opponent.width / 2;
      const distance = ((opponentX - centerX) * this.facing) / this.unit;
      if (distance >= -10 && distance <= spike.reach(this.prevMoveId)) {
        offset = distance + spike.lead;
      }
    }

    const helper = this.spawnProjectile(spike, {
      x: centerX + offset * this.facing * this.unit,
      y: this.bounds.groundY ?? this.bounds.height,
    });
    if (helper) this.onSpike(helper.x);
  }

  /** Verdadeiro enquanto o projéctil ainda pode acertar (a fase principal ou a do golpe final). */
  isHelperActive(helper) {
    const end = helper.lifetime + (helper.final?.ticks ?? 0);
    return helper.tick < end;
  }

  /** A animação e o frame que um projéctil mostra neste tick, ou null se já acabou. */
  helperFrame(helper) {
    if (this.isHelperActive(helper)) {
      return { animation: helper.animation, index: helper.animation.frameAt(helper.tick) };
    }

    const endTick = helper.tick - helper.lifetime - (helper.final?.ticks ?? 0);
    if (!helper.endAnimation || endTick >= helper.endAnimation.totalTicks) return null;
    return { animation: helper.endAnimation, index: helper.endAnimation.frameAt(endTick) };
  }

  updateHelpers() {
    for (const helper of this.helpers) {
      helper.tick += 1;

      if (helper.bound) {
        helper.facing = this.facing;
        helper.x = this.position.x + this.width / 2 + helper.bound[0] * this.facing * this.unit;
        helper.y = this.position.y + this.height + helper.bound[1] * this.unit;
      } else {
        helper.x += helper.velocity[0];
        helper.y += helper.velocity[1];
      }

      // Acabada a fase principal, arma-se o golpe final.
      if (helper.final && helper.tick === helper.lifetime) {
        helper.hit = helper.final.hit;
        helper.source = helper.final.source;
        helper.hasHit = false;
        helper.every = 0;
        for (const cue of helper.hit.sounds) this.playSound?.(cue.sound, cue);
      }
    }

    this.helpers = this.helpers.filter((helper) => this.helperFrame(helper));
  }

  getAttacks() {
    const attacks = super.getAttacks();

    for (const helper of this.helpers) {
      if (!helper.hit || !this.isHelperActive(helper) || helper.tick < helper.armAfter) continue;

      // Os que acertam várias vezes voltam a armar-se passado o intervalo.
      const rearmed = helper.every > 0 && helper.tick - helper.lastHit >= helper.every;
      if (helper.hasHit && !rearmed) continue;

      const { animation, index } = this.helperFrame(helper);
      const boxes = this.toWorldBoxes(animation.frames[index].hit, {
        x: helper.x,
        y: helper.y,
        facing: helper.facing,
        scale: helper.scale,
      });
      if (boxes.length === 0) continue;

      attacks.push({
        boxes,
        hit: helper.hit,
        facing: helper.facing,
        onHit: (impact) => {
          helper.hasHit = true;
          helper.lastHit = helper.tick;
          this.moveHit = true;
          if (impact) this.onHitLanded({ ...impact, hit: helper.source });
          for (const cue of helper.hit.sounds) this.playSound?.(cue.sound, cue);
        },
      });
    }

    return attacks;
  }

  /** Apanhar desfaz o que o lutador trazia agarrado a si. */
  receiveHit(hit) {
    super.receiveHit(hit);
    this.helpers = this.helpers.filter((helper) => !helper.bound);
  }

  // ------------------------------------------------------------------ ciclo

  resolveAnimationName() {
    if (this.move && !this.isLocked) return `move:${this.moveId}`;

    const crouching = !this.isLocked
      && this.isOnGround
      && this.input.down
      && this.animator.has('crouch');
    if (crouching) return 'crouch';

    return super.resolveAnimationName();
  }

  update(ctx) {
    const wasAirborne = !this.isOnGround;

    // Durante a pausa do impacto nada avança, nem os golpes.
    if (this.hitPause === 0) {
      this.think();
      this.updateHelpers();
    }

    super.update(ctx);

    if (wasAirborne && this.isOnGround) this.onLand();
  }

  draw(ctx) {
    super.draw(ctx);

    for (const helper of this.helpers) {
      const frame = this.helperFrame(helper);
      if (!frame) continue;

      ctx.save();
      ctx.imageSmoothingEnabled = false;
      ctx.translate(helper.x, helper.y);
      ctx.scale(helper.facing * helper.scale, helper.scale);
      frame.animation.draw(ctx, frame.index, this.unit);
      if (this.showBoxes) frame.animation.drawBoxes?.(ctx, frame.index, this.unit);
      ctx.restore();
    }
  }
}
