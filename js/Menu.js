/**
 * O menu inicial: escolher entre jogar contra o computador ou a dois. Anda-se
 * com W/S ou com as setas e confirma-se com Enter (quem confirma é o main.js,
 * que é quem lê o Enter).
 */

export const MENU_OPTIONS = [
  { mode: 'cpu', label: '1 JOGADOR', detail: 'Kaneki contra o Tanjiro do computador' },
  { mode: '2p', label: '2 JOGADORES', detail: 'Kaneki contra Tanjiro, no mesmo teclado' },
];

const UP_KEYS = ['KeyW', 'ArrowUp'];
const DOWN_KEYS = ['KeyS', 'ArrowDown'];

export class Menu {
  constructor({ input, width, height }) {
    this.input = input;
    this.width = width;
    this.height = height;
    this.selected = 0;
    // Só conta o momento em que a tecla vai abaixo, não enquanto está premida.
    this.held = { up: false, down: false };
  }

  /** O modo que está escolhido: 'cpu' ou '2p'. */
  get mode() {
    return MENU_OPTIONS[this.selected].mode;
  }

  update() {
    for (const [direction, keys, step] of [['up', UP_KEYS, -1], ['down', DOWN_KEYS, 1]]) {
      const down = keys.some((code) => this.input.isPressed(code));
      if (down && !this.held[direction]) {
        this.selected = (this.selected + step + MENU_OPTIONS.length) % MENU_OPTIONS.length;
      }
      this.held[direction] = down;
    }
  }

  draw(ctx) {
    const { width, height } = this;
    const centerX = width / 2;

    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, 0, width, height);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';

    // O título.
    ctx.font = 'italic 900 64px sans-serif';
    ctx.lineWidth = 8;
    ctx.strokeStyle = '#0c0d11';
    ctx.fillStyle = '#ffffff';
    ctx.strokeText('KANEKI  VS  TANJIRO', centerX, height * 0.27);
    ctx.fillText('KANEKI  VS  TANJIRO', centerX, height * 0.27);

    // As opções, a escolhida com a faixa por trás.
    MENU_OPTIONS.forEach((option, index) => {
      const y = height * 0.5 + index * 78;
      const active = index === this.selected;

      if (active) {
        const gradient = ctx.createLinearGradient(centerX - 260, 0, centerX + 260, 0);
        gradient.addColorStop(0, 'rgba(224, 23, 51, 0)');
        gradient.addColorStop(0.5, 'rgba(224, 23, 51, 0.85)');
        gradient.addColorStop(1, 'rgba(224, 23, 51, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(centerX - 260, y - 30, 520, 60);
      }

      ctx.font = `italic 900 ${active ? 36 : 30}px sans-serif`;
      ctx.fillStyle = active ? '#ffffff' : '#9a9cab';
      ctx.fillText(option.label, centerX, y - 6);
      ctx.font = '15px sans-serif';
      ctx.fillStyle = active ? '#f1d4da' : '#6f7180';
      ctx.fillText(option.detail, centerX, y + 19);
    });

    ctx.font = '15px sans-serif';
    ctx.fillStyle = '#c9cad2';
    ctx.fillText('W / S ou ↑ / ↓ para escolher  ·  Enter para começar', centerX, height * 0.88);
    ctx.restore();
  }
}
