import { WebHaptics } from 'web-haptics';

/** Thin wrapper over web-haptics tuned for game events */
export class HapticsManager {
  private haptics: WebHaptics;

  constructor() {
    this.haptics = new WebHaptics();
  }

  /** Light tap — enemy kill, bullet hit */
  light(): void {
    this.haptics.trigger(15);
  }

  /** Medium impact — enemy spawn, small explosion */
  medium(): void {
    this.haptics.trigger(40);
  }

  /** Heavy impact — boss kill, large explosion */
  heavy(): void {
    this.haptics.trigger([60, 30, 80]);
  }

  /** Player death — long dramatic rumble */
  death(): void {
    this.haptics.trigger([100, 40, 120, 40, 160]);
  }

  /** Boss spawn — ominous double pulse */
  bossSpawn(): void {
    this.haptics.trigger([80, 60, 120]);
  }

  /** Player respawn — sharp nudge */
  respawn(): void {
    this.haptics.trigger('nudge');
  }

  /** BlackHole absorb — quick suck */
  absorb(): void {
    this.haptics.trigger(25);
  }

  /** Error/warning — e.g. last life */
  warning(): void {
    this.haptics.trigger('error');
  }
}
