/**
 * Golpes a acertar.
 *
 * Cada lutador diz o que tem a bater neste tick (as caixas de ataque e o que
 * o golpe faz) e onde pode ser atingido (caixas de corpo). Aqui cruzam-se
 * umas com as outras; ao primeiro toque, quem apanha leva o que o golpe
 * define e o golpe fica a saber que acertou.
 */

/** O centro da zona onde duas caixas se sobrepõem: o ponto do impacto. */
function overlapCenter(a, b) {
  const left = Math.max(a.x, b.x);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const top = Math.max(a.y, b.y);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  return { x: (left + right) / 2, y: (top + bottom) / 2 };
}

function overlaps(a, b) {
  return a.x < b.x + b.width
    && a.x + a.width > b.x
    && a.y < b.y + b.height
    && a.y + a.height > b.y;
}

/**
 * Os lutadores não se atravessam: se os corpos de dois se sobrepõem, cada um
 * recua metade do que entrou no outro. Sem isto, uma investida passava pelo
 * adversário e deixava quem a deu de costas para ele.
 *
 * Quem está no ar por cima do outro passa (é assim que se salta por cima
 * dele), e quem está derrubado não estorva.
 */
export function resolvePush(fighters) {
  for (let i = 0; i < fighters.length; i++) {
    for (let j = i + 1; j < fighters.length; j++) {
      const a = fighters[i];
      const b = fighters[j];
      if ([a, b].some((f) => f.hidden || f.isDefeated || f.isFalling || f.downTicks > 0)) continue;

      const overlapsVertically = a.position.y < b.position.y + b.height
        && a.position.y + a.height > b.position.y;
      if (!overlapsVertically) continue;

      const centerA = a.position.x + a.width / 2;
      const centerB = b.position.x + b.width / 2;
      const overlap = (a.width + b.width) / 2 - Math.abs(centerA - centerB);
      if (overlap <= 0) continue;

      // Cada um para o seu lado; encostado à parede, o outro recua por ele.
      const side = centerA <= centerB ? -1 : 1;
      const move = (fighter, amount) => {
        const before = fighter.position.x;
        fighter.position.x = Math.max(
          0,
          Math.min(before + amount, fighter.bounds.width - fighter.width),
        );
        return fighter.position.x - before;
      };
      const movedA = move(a, (side * overlap) / 2);
      const movedB = move(b, (-side * overlap) / 2);
      const left = overlap - Math.abs(movedA) - Math.abs(movedB);
      if (left > 0.01) {
        move(a, side * left);
        move(b, -side * left);
      }
    }
  }
}

export function resolveHits(fighters) {
  for (const attacker of fighters) {
    for (const attack of attacker.getAttacks()) {
      for (const defender of fighters) {
        if (defender === attacker) continue;

        const hurtBoxes = defender.getHurtBoxes();
        let point = null;
        for (const hit of attack.boxes) {
          const hurt = hurtBoxes.find((box) => overlaps(hit, box));
          if (hurt) {
            point = overlapCenter(hit, hurt);
            break;
          }
        }
        if (!point) continue;

        // O empurrão vai para o lado para onde o golpe está virado.
        defender.receiveHit({ ...attack.hit, direction: attack.facing });
        attack.onHit({ point, defender });
        break;
      }
    }
  }
}
