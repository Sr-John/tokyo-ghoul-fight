/**
 * Monta as animações de um lutador a partir do seu CharacterAtlas: as de
 * estar e reagir (uma tabela nome -> { action, loop }) e as dos golpes (a
 * tabela de golpes, em que cada um fica com o nome `move:<número>`).
 */

/**
 * `form` soma-se ao número de cada acção, para os personagens que têm uma
 * segunda forma com as mesmas animações noutra numeração. O que a forma não
 * tiver vem da normal.
 */
export function buildAnimations(character, actions, moves, form = 0) {
  const inForm = (action) => (
    typeof action === 'number' && character.has(action + form) ? action + form : action
  );

  const animations = {};
  for (const [name, { action, loop }] of Object.entries(actions)) {
    const animation = character.animation(inForm(action), { name, loop });
    if (animation) animations[name] = animation;
  }

  for (const [id, move] of Object.entries(moves)) {
    const name = `move:${id}`;
    const animation = character.animation(inForm(move.action), { name, loop: Boolean(move.loop) });
    if (animation) animations[name] = animation;

    // O que sai do chão a meio de um golpe é uma animação à parte do corpo.
    for (const action of [move.spike?.action, move.spike?.endAction]) {
      if (action === undefined) continue;
      const helperName = `helper:${action}`;
      const helper = character.animation(action, {
        name: helperName,
        loop: action === move.spike.action,
      });
      if (helper) animations[helperName] = helper;
    }

    // Os projécteis: a animação principal repete, a de desaparecer não.
    for (const spec of move.projectiles ?? []) {
      for (const [action, loop] of [[spec.action, true], [spec.endAction, false]]) {
        if (action === undefined) continue;
        const helperName = `helper:${action}`;
        const helper = character.animation(action, { name: helperName, loop });
        if (helper) animations[helperName] = helper;
      }
    }
  }

  return animations;
}

/** Os sons com hora marcada de uma tabela de animações, pelo nome de cada uma. */
export function pickSounds(actions) {
  return Object.fromEntries(
    Object.entries(actions)
      .filter(([, { sounds }]) => sounds)
      .map(([name, { sounds }]) => [name, sounds]),
  );
}
