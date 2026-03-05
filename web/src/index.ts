import { Game } from './game';

const gameCanvas = document.getElementById('game') as HTMLCanvasElement;
const hudCanvas = document.getElementById('hud') as HTMLCanvasElement;

const game = new Game(gameCanvas, hudCanvas);

let lastTime = performance.now();

function loop(time: number): void {
  const dt = Math.min(time - lastTime, 50); // cap at 50ms to avoid spiral
  lastTime = time;

  game.update(dt);
  game.render();

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
