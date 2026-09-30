/**
 * Uma cena com guião: o combate pára e os lutadores passam a ser actores.
 *
 * É uma lista de fases. Cada fase dura um número de ticks e tem
 * acontecimentos marcados para certos ticks — { at, run }, ou
 * { at, every, until, run } para os que se repetem —, um `tick` para o que
 * corre sempre e, se quiser, um `draw` para desenhar por cima de tudo. A
 * cena pode ter ainda um `overlay`, desenhado por cima em todas as fases.
 */
export class Cutscene {
  constructor(phases, { onFinish = null, overlay = null } = {}) {
    this.phases = phases;
    this.onFinish = onFinish;
    this.overlay = overlay;
    this.index = 0;
    this.time = 0;
    this.finished = phases.length === 0;
  }

  get phase() {
    return this.phases[this.index] ?? null;
  }

  update() {
    if (this.finished) return;

    const { phase, time } = this;

    for (const event of phase.events ?? []) {
      const repeats = event.every
        && time > event.at
        && (time - event.at) % event.every === 0
        && (event.until === undefined || time <= event.until);
      if (time === event.at || repeats) event.run(time);
    }
    phase.tick?.(time);

    this.time += 1;
    if (this.time < phase.duration) return;

    this.index += 1;
    this.time = 0;
    if (this.index >= this.phases.length) {
      this.finished = true;
      this.onFinish?.();
    }
  }

  /** O que a fase actual desenha por cima dos lutadores e dos efeitos. */
  draw(ctx) {
    if (this.finished) return;
    this.phase.draw?.(ctx, this.time);
    this.overlay?.(ctx);
  }
}
