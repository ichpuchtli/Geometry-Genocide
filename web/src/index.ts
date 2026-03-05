import { Game } from './game';

const gameCanvas = document.getElementById('game') as HTMLCanvasElement;
const hudCanvas = document.getElementById('hud') as HTMLCanvasElement;

const game = new Game(gameCanvas, hudCanvas);

let lastTime = performance.now();
let paused = false;

function loop(time: number): void {
  if (!paused) {
    const dt = Math.min(time - lastTime, 50);
    lastTime = time;
    game.update(dt);
    game.render();
  } else {
    lastTime = time;
  }
  requestAnimationFrame(loop);
}

// Pause when tab is hidden
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    paused = true;
    game.onPause();
  } else {
    paused = false;
    lastTime = performance.now();
    game.onResume();
  }
});

requestAnimationFrame(loop);
