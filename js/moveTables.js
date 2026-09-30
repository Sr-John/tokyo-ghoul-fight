/**
 * Junta tabelas de golpes de um lutador: a principal e as que vivem noutros
 * ficheiros (os especiais, os supers…). Cada uma é { moves, commands }, com
 * os comandos em { motions, ground, air }.
 *
 * Os comandos das extra ficam antes dos da principal, e pela ordem em que
 * vêm: um comando mais comprido (↓→↓→ + botão) tem de ser visto antes do
 * que ele contém (↓→ + botão), e os dois antes do botão sozinho.
 */
export function combineMoves(base, ...extras) {
  const tables = [...extras, base];
  const moves = Object.assign({}, ...tables.map((table) => table.moves));

  const commands = {};
  for (const key of ['motions', 'ground', 'air']) {
    commands[key] = tables.flatMap((table) => table.commands?.[key] ?? []);
  }
  // A principal ganha a uma extra que traga um golpe com o mesmo número.
  Object.assign(moves, base.moves);
  return { moves, commands };
}
