import { HUD_FONT, HUD_COLOR } from '../config';

export class HUD {
  private ctx: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;
  private touchMode = false;
  private fpsFrames = 0;
  private fpsTime = 0;
  private fpsDisplay = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get 2d context for HUD');
    this.ctx = ctx;
  }

  setTouchMode(touch: boolean): void {
    this.touchMode = touch;
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

  updateFps(dt: number): void {
    this.fpsFrames++;
    this.fpsTime += dt;
    if (this.fpsTime >= 500) {
      this.fpsDisplay = Math.round(this.fpsFrames / (this.fpsTime / 1000));
      this.fpsFrames = 0;
      this.fpsTime = 0;
    }
  }

  drawPlaying(score: number, lives: number, muted?: boolean, enemyCount?: number, autoFire?: boolean): void {
    this.clear();
    this.ctx.textBaseline = 'top';

    // Score top-left with glow
    this.ctx.textAlign = 'left';
    this.drawGlowText(`SCORE: ${score}`, 20, 20, HUD_FONT, HUD_COLOR, '#0a550a', 8);

    // Lives top-right with glow
    this.ctx.textAlign = 'right';
    this.drawGlowText(`LIVES: ${lives}`, this.canvas.clientWidth - 20, 20, HUD_FONT, HUD_COLOR, '#0a550a', 8);

    // FPS + enemy count bottom-left
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'bottom';
    const fpsColor = this.fpsDisplay >= 55 ? '#20ff20' : this.fpsDisplay >= 30 ? '#ffff20' : '#ff3030';
    let debugText = `FPS: ${this.fpsDisplay}`;
    if (enemyCount !== undefined) debugText += `  ENEMIES: ${enemyCount}`;
    this.drawGlowText(debugText, 20, this.canvas.clientHeight - 10, '14px monospace', fpsColor, fpsColor, 5);
    this.ctx.textBaseline = 'top';

    // Status indicators (top-center)
    this.ctx.textAlign = 'center';
    const indicators: string[] = [];
    if (muted) indicators.push('MUTED [M]');
    if (autoFire) indicators.push('AUTO-FIRE [F]');
    if (indicators.length > 0) {
      const text = indicators.join('  ');
      const color = muted ? '#aa3030' : '#30aa30';
      this.drawGlowText(text, this.canvas.clientWidth / 2, 20, '14px monospace', color, color, 5);
    }
  }

  /** Draw phase transition banner with fade-in/out animation */
  drawPhaseBanner(name: string, progress: number): void {
    if (!name || progress <= 0 || progress >= 1) return;
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;

    // Fade: quick in, hold, slow out
    let alpha: number;
    if (progress < 0.15) {
      alpha = progress / 0.15; // fade in
    } else if (progress > 0.7) {
      alpha = (1 - progress) / 0.3; // fade out
    } else {
      alpha = 1;
    }

    // Slide in from left
    const slideOffset = progress < 0.15 ? (1 - progress / 0.15) * -60 : 0;

    this.ctx.save();
    this.ctx.globalAlpha = alpha;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';

    // Background stripe
    const stripeH = 60;
    const y = h * 0.35;
    this.ctx.fillStyle = `rgba(0, 0, 0, ${0.4 * alpha})`;
    this.ctx.fillRect(0, y - stripeH / 2, w, stripeH);

    // Accent lines
    this.ctx.strokeStyle = `rgba(255, 100, 30, ${0.6 * alpha})`;
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(w * 0.2, y - stripeH / 2);
    this.ctx.lineTo(w * 0.8, y - stripeH / 2);
    this.ctx.moveTo(w * 0.2, y + stripeH / 2);
    this.ctx.lineTo(w * 0.8, y + stripeH / 2);
    this.ctx.stroke();

    // Banner text
    const bannerX = w / 2 + slideOffset;
    this.drawGlowText(name, bannerX, y, 'bold 36px monospace', '#ff6020', '#ff3000', 20);

    this.ctx.restore();
  }

  /** Draw heat meter — thin bar on the left side, scales with heat 0-1 */
  drawHeatMeter(heat: number): void {
    if (heat <= 0.01) return;
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;

    const barX = 20;
    const barY = h * 0.2;
    const barW = 6;
    const barH = h * 0.3;
    const fillH = barH * heat;

    // Background outline
    this.ctx.save();
    this.ctx.strokeStyle = 'rgba(255, 100, 50, 0.3)';
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(barX, barY, barW, barH);

    // Fill (bottom-up, gradient from orange to white)
    const gradient = this.ctx.createLinearGradient(barX, barY + barH, barX, barY + barH - fillH);
    gradient.addColorStop(0, 'rgba(255, 120, 30, 0.6)');
    gradient.addColorStop(0.5, 'rgba(255, 180, 50, 0.8)');
    gradient.addColorStop(1, 'rgba(255, 255, 200, 0.9)');
    this.ctx.fillStyle = gradient;
    this.ctx.shadowColor = 'rgba(255, 120, 30, 0.5)';
    this.ctx.shadowBlur = 8;
    this.ctx.fillRect(barX, barY + barH - fillH, barW, fillH);

    // Label
    this.ctx.shadowBlur = 0;
    this.ctx.fillStyle = heat > 0.5 ? 'rgba(255, 180, 50, 0.8)' : 'rgba(255, 120, 30, 0.5)';
    this.ctx.font = '9px monospace';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'top';
    this.ctx.fillText('HEAT', barX + barW / 2, barY + barH + 4);
    this.ctx.restore();
  }

  /** Draw recovery window banner */
  drawRecoveryBanner(progress: number): void {
    if (progress <= 0) return;
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;

    // Remaining fraction (1 = just started, 0 = expiring)
    const alpha = progress > 0.15 ? 0.85 : progress / 0.15 * 0.85;

    this.ctx.save();
    this.ctx.globalAlpha = alpha;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';

    const y = h * 0.22;

    // "RECOVERY" text with cyan glow
    const color = progress > 0.2 ? '#50ddff' : '#ff8040'; // Warn color when expiring
    const glowColor = progress > 0.2 ? '#2090cc' : '#cc5020';
    this.drawGlowText('RECOVERY', w / 2, y, 'bold 18px monospace', color, glowColor, 12);

    // Progress bar under text
    const barW = 120;
    const barH = 3;
    const barX = w / 2 - barW / 2;
    const barY = y + 14;
    this.ctx.fillStyle = `rgba(80, 220, 255, ${0.3 * alpha})`;
    this.ctx.fillRect(barX, barY, barW, barH);
    this.ctx.fillStyle = `rgba(80, 220, 255, ${0.8 * alpha})`;
    this.ctx.shadowColor = '#50ddff';
    this.ctx.shadowBlur = 6;
    this.ctx.fillRect(barX, barY, barW * progress, barH);
    this.ctx.shadowBlur = 0;

    this.ctx.restore();
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
    const playText = this.touchMode ? 'Tap to Play' : 'Click to Play';
    this.drawGlowText(playText, w / 2, h / 2 + 50, '22px monospace', '#10dd10', '#10dd10', 15);

    // Controls hint
    const controlsText = this.touchMode
      ? 'Left stick: move  |  Right stick: aim & shoot'
      : 'WASD to move  |  Mouse to aim  |  Click to shoot  |  F auto-fire  |  M mute';
    this.drawGlowText(controlsText, w / 2, h / 2 + 100, '13px monospace', '#0a770a', '#0a770a', 5);

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

    // Light overlay so the frozen chaos is still visible behind
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
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
    const replayText = this.touchMode ? 'Tap to Play Again' : 'Click to Play Again';
    this.drawGlowText(replayText, w / 2, h / 2 + 110, '20px monospace', '#10dd10', '#10dd10', 12);
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
