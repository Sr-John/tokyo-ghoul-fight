/**
 * O contador de combo: "5 HITS" do lado de quem o está a fazer, enquanto o
 * adversário não recupera. Acabado o combo, o número fica mais um pouco e
 * apaga-se. Só aparece a partir de dois golpes.
 *
 * Lê o `comboHits` e o `isInCombo` de quem leva os golpes (em Fighter.js).
 */

const DESIGN_WIDTH = 1280;

/** Onde fica, em cada lado, no ecrã de 1280×720 do HUD. */
const SIDES = [
  { x: 40, align: 'left' },
  { x: DESIGN_WIDTH - 40, align: 'right' },
];
const TOP = 200;

/** Ticks que o número fica depois de o combo acabar, e os últimos a apagar-se. */
const LINGER_TICKS = 60;
const FADE_TICKS = 15;
/** Ticks do "salto" do número a cada golpe novo. */
const POP_TICKS = 6;

export class ComboCounter {
  /** `fighters` são os dois lutadores, pela ordem do HUD; `width` a do canvas. */
  constructor({ fighters, width }) {
    this.scale = width / DESIGN_WIDTH;
    // Um por lado: o combo que esse lado está a fazer ao outro.
    this.sides = fighters.map((attacker, index) => ({
      defender: fighters[1 - index],
      hits: 0,
      linger: 0,
      pop: 0,
    }));
  }

  update() {
    for (const side of this.sides) {
      const { defender } = side;
      if (defender.comboHits !== side.hits && defender.isInCombo) {
        side.hits = defender.comboHits;
        side.pop = POP_TICKS;
      }
      if (side.pop > 0) side.pop -= 1;

      if (defender.isInCombo) side.linger = LINGER_TICKS;
      else if (side.linger > 0) side.linger -= 1;
      else side.hits = 0;
    }
  }

  draw(ctx) {
    this.sides.forEach((side, index) => {
      if (side.hits < 2 || side.linger <= 0) return;

      const { x, align } = SIDES[index];
      const alpha = Math.min(1, side.linger / FADE_TICKS);
      const grow = 1 + 0.35 * (side.pop / POP_TICKS);

      ctx.save();
      ctx.scale(this.scale, this.scale);
      ctx.globalAlpha = alpha;
      ctx.textAlign = align;
      ctx.textBaseline = 'alphabetic';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#0c0d11';

      // O número, grande, a "saltar" a cada golpe, e o HITS por baixo.
      ctx.save();
      ctx.translate(x, TOP);
      ctx.scale(grow, grow);
      ctx.font = 'italic 900 72px sans-serif';
      ctx.lineWidth = 9;
      const gradient = ctx.createLinearGradient(0, -60, 0, 0);
      gradient.addColorStop(0, '#fff6c9');
      gradient.addColorStop(1, '#ffb21e');
      ctx.fillStyle = gradient;
      ctx.strokeText(String(side.hits), 0, 0);
      ctx.fillText(String(side.hits), 0, 0);
      ctx.restore();

      ctx.font = 'italic 900 30px sans-serif';
      ctx.lineWidth = 6;
      ctx.fillStyle = '#ffffff';
      ctx.strokeText('HITS', x, TOP + 34);
      ctx.fillText('HITS', x, TOP + 34);
      ctx.restore();
    });
  }
}
