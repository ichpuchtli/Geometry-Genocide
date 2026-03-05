import { HUD_FONT, HUD_COLOR } from '../config';

export class HUD {
  private ctx: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get 2d context for HUD');
    this.ctx = ctx;
  }

  resize(): void {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = this.canvas.clientWidth * dpr;
    this.canvas.height = this.canvas.clientHeight * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  clear(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  drawPlaying(score: number, lives: number): void {
    this.clear();
    this.ctx.font = HUD_FONT;
    this.ctx.fillStyle = HUD_COLOR;
    this.ctx.textBaseline = 'top';

    // Score top-left
    this.ctx.textAlign = 'left';
    this.ctx.fillText(`SCORE: ${score}`, 20, 20);

    // Lives top-right
    this.ctx.textAlign = 'right';
    this.ctx.fillText(`LIVES: ${lives}`, this.canvas.clientWidth - 20, 20);
  }

  drawMenu(): void {
    this.clear();
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';

    // Title
    this.ctx.font = 'bold 48px monospace';
    this.ctx.fillStyle = '#20ff20';
    this.ctx.fillText('GEOMETRY GENOCIDE', w / 2, h / 2 - 60);

    // Subtitle
    this.ctx.font = '20px monospace';
    this.ctx.fillStyle = '#10aa10';
    this.ctx.fillText('Click to Play', w / 2, h / 2 + 20);

    // Controls hint
    this.ctx.font = '14px monospace';
    this.ctx.fillStyle = '#0a770a';
    this.ctx.fillText('WASD to move  |  Mouse to aim  |  Click to shoot  |  ESC to quit', w / 2, h / 2 + 60);
  }

  drawGameOver(score: number, enemiesKilled: number, timeSurvived: number): void {
    this.clear();
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';

    this.ctx.font = 'bold 48px monospace';
    this.ctx.fillStyle = '#ff2020';
    this.ctx.fillText('GAME OVER', w / 2, h / 2 - 80);

    this.ctx.font = '28px monospace';
    this.ctx.fillStyle = '#20ff20';
    this.ctx.fillText(`SCORE: ${score}`, w / 2, h / 2 - 20);

    this.ctx.font = '18px monospace';
    this.ctx.fillStyle = '#10aa10';
    const mins = Math.floor(timeSurvived / 60);
    const secs = Math.floor(timeSurvived % 60);
    this.ctx.fillText(`Time: ${mins}:${secs.toString().padStart(2, '0')}  |  Kills: ${enemiesKilled}`, w / 2, h / 2 + 20);

    this.ctx.font = '20px monospace';
    this.ctx.fillStyle = '#10aa10';
    this.ctx.fillText('Click to Play Again', w / 2, h / 2 + 70);
  }
}
