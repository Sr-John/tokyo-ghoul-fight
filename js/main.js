import { Fighter } from './Fighter.js';
import { InputHandler } from './InputHandler.js';

const CANVAS_WIDTH = 1024;
const CANVAS_HEIGHT = 576;

const MOVE_SPEED = 5;
const JUMP_FORCE = -16;

const canvas = document.querySelector('#game');
const ctx = canvas.getContext('2d');

canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;

const bounds = { width: CANVAS_WIDTH, height: CANVAS_HEIGHT };

// As setas fazem scroll à página por omissão; travá-las evita que o ringue
// salte no ecrã enquanto se joga.
const input = new InputHandler({
  preventDefaultFor: ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'],
});

const player1 = new Fighter({
  x: 200,
  y: 0,
  color: '#2f6fed',
  bounds,
});

const player2 = new Fighter({
  x: 800,
  y: 0,
  color: '#e03a3a',
  bounds,
});

const CONTROLS = [
  { fighter: player1, left: 'KeyA', right: 'KeyD', jump: 'KeyW' },
  { fighter: player2, left: 'ArrowLeft', right: 'ArrowRight', jump: 'ArrowUp' },
];

function handleInput() {
  for (const { fighter, left, right, jump } of CONTROLS) {
    // A velocidade horizontal é recalculada a cada frame: sem tecla premida,
    // o lutador pára de imediato (resposta seca, como nos jogos de luta).
    fighter.velocity.x = 0;

    if (input.isPressed(left)) {
      fighter.velocity.x = -MOVE_SPEED;
    } else if (input.isPressed(right)) {
      fighter.velocity.x = MOVE_SPEED;
    }

    if (input.isPressed(jump)) {
      fighter.jump(JUMP_FORCE);
    }
  }
}

function animate() {
  requestAnimationFrame(animate);

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  handleInput();

  player1.update(ctx);
  player2.update(ctx);
}

animate();
