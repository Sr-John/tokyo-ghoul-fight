import { Fighter } from './Fighter.js';
import { Animator } from './SpriteAnimation.js';

/**
 * Lutador desenhado a partir de spritesheets.
 *
 * Escolhe a animação a partir do estado físico que o Fighter já calcula
 * (parado, a andar, no ar) e do ataque em curso. Enquanto as imagens não
 * carregarem — ou se faltarem — cai no desenho de reserva, o que permite
 * jogar antes de a arte estar pronta.
 */

const SHADOW_COLOR = 'rgba(0, 0, 0, 0.32)';

export class SpriteFighter extends Fighter {
  constructor({ animations = {}, spriteScale = null, ...fighterOptions }) {
    super(fighterOptions);

    this.animator = new Animator(animations);

    /**
     * Ampliação da arte. Por omissão, o sprite é esticado até à altura do
     * lutador; em pixel art convém antes um valor inteiro (2, 3, 4…) para os
     * pixels não saírem tortos.
     */
    this.spriteScale = spriteScale;

    this.isAttacking = false;

    this.animator.play('idle');
  }

  /** Dispara o ataque. Ignorado se já houver um a decorrer. */
  attack() {
    if (this.isAttacking) return;
    if (!this.animator.animations.has('attack')) return;

    this.isAttacking = true;
    this.animator.play('attack', { restart: true });
  }

  /** Nome da animação que corresponde ao estado actual. */
  resolveAnimationName() {
    if (this.isAttacking) return 'attack';
    if (!this.isOnGround && this.animator.animations.has('jump')) return 'jump';
    if (this.velocity.x !== 0) return 'walk';
    return 'idle';
  }

  update(ctx) {
    // O ataque manda em tudo o resto até o último frame passar.
    if (this.isAttacking && this.animator.isFinished) {
      this.isAttacking = false;
    }

    this.animator.play(this.resolveAnimationName());
    this.animator.update();

    super.update(ctx);
  }

  draw(ctx) {
    this.drawGroundShadow(ctx);

    const animation = this.animator.current;

    if (!animation || !animation.ready) {
      this.drawFallback(ctx);
      return;
    }

    const scale = this.spriteScale ?? this.height / animation.frameHeight;
    const width = animation.frameWidth * scale;
    const height = animation.frameHeight * scale;

    // Âncora nos pés: o sprite assenta no fundo da hitbox e fica centrado
    // nela. A hitbox não muda de tamanho com a arte.
    const x = this.position.x + this.width / 2 + animation.offsetX;
    const y = this.position.y + this.height - height / 2 + animation.offsetY;

    ctx.save();
    // Pixel art: sem interpolação, senão os pixels saem esborratados.
    ctx.imageSmoothingEnabled = false;
    ctx.translate(x, y);
    ctx.scale(this.facing, 1);
    animation.drawFrame(
      ctx,
      this.animator.frameIndex,
      -width / 2,
      -height / 2,
      width,
      height,
    );
    ctx.restore();
  }

  /**
   * Desenho usado enquanto não há sprites. Por omissão, o retângulo colorido
   * do Fighter; as subclasses substituem-no por algo melhor.
   */
  drawFallback(ctx) {
    super.draw(ctx);
  }

  /**
   * Sombra no chão, não aos pés: fica onde o lutador aterraria e encolhe com
   * a altura do salto, o que dá a leitura de quão alto ele está.
   */
  drawGroundShadow(ctx) {
    const groundY = this.bounds.groundY ?? this.bounds.height;
    const centerX = this.position.x + this.width / 2;
    const airGap = Math.max(0, groundY - (this.position.y + this.height));
    const closeness = Math.max(0, 1 - airGap / 220);

    ctx.save();
    ctx.fillStyle = SHADOW_COLOR;
    ctx.globalAlpha = 0.25 + closeness * 0.6;
    ctx.beginPath();
    ctx.ellipse(
      centerX,
      groundY - 4,
      26 * (0.5 + closeness * 0.5),
      6,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    ctx.restore();
  }
}
