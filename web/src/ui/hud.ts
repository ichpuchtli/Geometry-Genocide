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

  private drawGlowText(text: string, x: number, y: number, font: string, color: string, glowColor: string, blur: number = 10): void {
    this.ctx.save();
    this.ctx.font = font;
    this.ctx.fillStyle = glowColor;
    this.ctx.shadowColor = glowColor;
    this.ctx.shadowBlur = blur;
    this.ctx.fillText(text, x, y);
    // Second pass for crisp text on top
    this.ctx.shadowBlur = 0;
    this.ctx.fillStyle = color;
    this.ctx.fillText(text, x, y);
    this.ctx.restore();
  }

  drawPlaying(score: number, lives: number): void {
    this.clear();
    this.ctx.textBaseline = 'top';

    // Score top-left with glow
    this.ctx.textAlign = 'left';
    this.drawGlowText(`SCORE: ${score}`, 20, 20, HUD_FONT, HUD_COLOR, '#0a550a', 8);

    // Lives top-right with glow
    this.ctx.textAlign = 'right';
    this.drawGlowText(`LIVES: ${lives}`, this.canvas.clientWidth - 20, 20, HUD_FONT, HUD_COLOR, '#0a550a', 8);
  }

  drawMenu(): void {
    this.clear();
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';

    // Title with strong glow
    this.drawGlowText('GEOMETRY', w / 2, h / 2 - 80, 'bold 56px monospace', '#20ff20', '#20ff20', 25);
    this.drawGlowText('GENOCIDE', w / 2, h / 2 - 20, 'bold 56px monospace', '#20ff20', '#20ff20', 25);

    // Subtitle
    this.drawGlowText('Click to Play', w / 2, h / 2 + 50, '22px monospace', '#10dd10', '#10dd10', 15);

    // Controls hint
    this.drawGlowText(
      'WASD to move  |  Mouse to aim  |  Click to shoot  |  ESC to quit',
      w / 2, h / 2 + 100,
      '13px monospace', '#0a770a', '#0a770a', 5,
    );

    // Credit
    this.ctx.textBaseline = 'bottom';
    this.drawGlowText('Geometry Wars-inspired arcade shooter', w / 2, h - 20, '11px monospace', '#064006', '#064006', 3);
  }

  drawGameOver(score: number, enemiesKilled: number, timeSurvived: number): void {
    this.clear();
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';

    // Semi-transparent dark overlay
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    this.ctx.fillRect(0, 0, w, h);

    // Game Over with red glow
    this.drawGlowText('GAME OVER', w / 2, h / 2 - 100, 'bold 52px monospace', '#ff3030', '#ff0000', 30);

    // Score with bright green glow
    this.drawGlowText(`${score}`, w / 2, h / 2 - 30, 'bold 44px monospace', '#20ff20', '#20ff20', 20);
    this.drawGlowText('SCORE', w / 2, h / 2 + 10, '16px monospace', '#0a770a', '#0a770a', 5);

    // Stats
    const mins = Math.floor(timeSurvived / 60);
    const secs = Math.floor(timeSurvived % 60);
    this.drawGlowText(
      `Time: ${mins}:${secs.toString().padStart(2, '0')}  |  Kills: ${enemiesKilled}`,
      w / 2, h / 2 + 55,
      '18px monospace', '#10aa10', '#10aa10', 8,
    );

    // Play again
    this.drawGlowText('Click to Play Again', w / 2, h / 2 + 110, '20px monospace', '#10dd10', '#10dd10', 12);
  }

  drawLoading(progress: number): void {
    this.clear();
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';

    this.drawGlowText('LOADING...', w / 2, h / 2 - 20, 'bold 28px monospace', '#20ff20', '#20ff20', 15);

    // Progress bar
    const barW = 200;
    const barH = 6;
    const barX = w / 2 - barW / 2;
    const barY = h / 2 + 15;
    this.ctx.strokeStyle = '#0a550a';
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(barX, barY, barW, barH);
    this.ctx.fillStyle = '#20ff20';
    this.ctx.shadowColor = '#20ff20';
    this.ctx.shadowBlur = 8;
    this.ctx.fillRect(barX, barY, barW * progress, barH);
    this.ctx.shadowBlur = 0;
  }
}
