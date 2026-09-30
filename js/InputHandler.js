/**
 * Regista as teclas actualmente premidas.
 *
 * Guardar o estado (em vez de reagir directamente ao evento) permite que o
 * game loop consulte o input a cada frame, o que dá movimento contínuo
 * enquanto a tecla está em baixo.
 */
export class InputHandler {
  constructor({ preventDefaultFor = [] } = {}) {
    this.keys = new Set();
    this.preventDefaultFor = new Set(preventDefaultFor);

    window.addEventListener('keydown', (event) => {
      if (this.preventDefaultFor.has(event.code)) {
        event.preventDefault();
      }

      this.keys.add(event.code);
    });

    window.addEventListener('keyup', (event) => {
      this.keys.delete(event.code);
    });

    // Evita que o estado fique "preso" se a janela perder o foco a meio de
    // um salto ou de um ataque.
    window.addEventListener('blur', () => {
      this.keys.clear();
    });
  }

  isPressed(code) {
    return this.keys.has(code);
  }
}
