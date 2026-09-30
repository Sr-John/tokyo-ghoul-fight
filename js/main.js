import { Arena } from './Arena.js';
import { Fighter } from './Fighter.js';
import { Kaneki, KANEKI_ANIMATIONS } from './Kaneki.js';
import { HealthBar } from './HealthBar.js';
import { InputHandler } from './InputHandler.js';

const CANVAS_WIDTH = 1024;
const CANVAS_HEIGHT = 576;

/** Linha onde os lutadores assentam os pés. Abaixo disto é o chão da arena. */
const GROUND_Y = 472;

const MOVE_SPEED = 5;
const JUMP_FORCE = -16;

// Disposição do HUD: duas barras simétricas com uma folga central, reservada
// para o contador de tempo do round.
const HUD_MARGIN = 32;
const HUD_TOP = 32;
const HUD_CENTER_GAP = 96;
const HUD_BAR_WIDTH = (CANVAS_WIDTH - HUD_MARGIN * 2 - HUD_CENTER_GAP) / 2;

const canvas = document.querySelector('#game');
const ctx = canvas.getContext('2d');

canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;

const arena = new Arena({
  width: CANVAS_WIDTH,
  height: CANVAS_HEIGHT,
  groundY: GROUND_Y,
});

// Os lutadores só precisam de saber onde são as paredes e o chão.
const bounds = {
  width: CANVAS_WIDTH,
  height: CANVAS_HEIGHT,
  groundY: arena.groundY,
};

// As setas fazem scroll à página por omissão; travá-las evita que o ringue
// salte no ecrã enquanto se joga.
const input = new InputHandler({
  preventDefaultFor: ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'],
});

const player1 = new Kaneki({
  x: 200,
  y: 0,
  color: '#2f6fed',
  facing: 1,
  bounds,
  animations: KANEKI_ANIMATIONS,
  // A arte tem 55 px de altura; 165 = 3x exactos, o que mantém os pixels
  // todos do mesmo tamanho. A escala é calculada a partir daqui.
  height: 165,
  width: 50,
});

const player2 = new Fighter({
  x: 800,
  y: 0,
  color: '#e03a3a',
  facing: -1,
  bounds,
});

const healthBars = [
  new HealthBar({
    fighter: player1,
    x: HUD_MARGIN,
    y: HUD_TOP,
    width: HUD_BAR_WIDTH,
    label: 'KANEKI',
  }),
  new HealthBar({
    fighter: player2,
    x: CANVAS_WIDTH - HUD_MARGIN - HUD_BAR_WIDTH,
    y: HUD_TOP,
    width: HUD_BAR_WIDTH,
    label: 'INIMIGO',
    mirrored: true,
  }),
];

const CONTROLS = [
  {
    fighter: player1,
    left: 'KeyA',
    right: 'KeyD',
    jump: 'KeyW',
    attack: 'Space',
  },
  {
    fighter: player2,
    left: 'ArrowLeft',
    right: 'ArrowRight',
    jump: 'ArrowUp',
    attack: 'ArrowDown',
  },
];

function handleInput() {
  for (const { fighter, left, right, jump, attack } of CONTROLS) {
    // A velocidade horizontal é recalculada a cada frame: sem tecla premida,
    // o lutador pára de imediato (resposta seca, como nos jogos de luta).
    fighter.velocity.x = 0;

    // Durante o ataque o lutador fica plantado, como é regra nos jogos de
    // luta: o golpe compromete, e é isso que dá peso às trocas.
    if (!fighter.isAttacking) {
      if (input.isPressed(left)) {
        fighter.velocity.x = -MOVE_SPEED;
      } else if (input.isPressed(right)) {
        fighter.velocity.x = MOVE_SPEED;
      }

      if (input.isPressed(jump)) {
        fighter.jump(JUMP_FORCE);
      }
    }

    if (input.isPressed(attack)) {
      fighter.attack?.();
    }
  }
}

/**
 * Vira os lutadores um para o outro, como em qualquer jogo de luta: quem
 * está à esquerda olha para a direita, e vice-versa.
 */
function updateFacing() {
  const player1IsLeft =
    player1.position.x + player1.width / 2
    <= player2.position.x + player2.width / 2;

  player1.facing = player1IsLeft ? 1 : -1;
  player2.facing = player1IsLeft ? -1 : 1;
}

function animate() {
  requestAnimationFrame(animate);

  // A arena preenche o canvas todo, por isso faz também de limpeza do frame.
  arena.draw(ctx);

  handleInput();
  updateFacing();

  player1.update(ctx);
  player2.update(ctx);

  // O HUD é desenhado por último para ficar sobre os lutadores.
  for (const bar of healthBars) {
    bar.update(ctx);
  }
}

animate();

// Atalho temporário de teste: enquanto os ataques não tiram vida, é por aqui
// que se vê a barra a esvaziar (na consola do browser).
//   game.player2.takeDamage(20)
window.game = { player1, player2, arena };
