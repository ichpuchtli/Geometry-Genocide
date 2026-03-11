/**
 * Game haptics using navigator.vibrate directly.
 *
 * The web-haptics library hid its iOS checkbox-switch element with
 * display:none which prevented it from firing, and its PWM intensity
 * simulation made short Android pulses imperceptible. Direct vibrate
 * calls are simpler and more reliable on Android / Chrome.
 *
 * iOS Safari does not support the Vibration API at all — there is no
 * reliable web-only haptics path for iOS, so calls silently no-op.
 */

const supported = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

function vibrate(pattern: number | number[]): void {
  if (supported) navigator.vibrate(pattern);
}

export class HapticsManager {
  /** Light tap — enemy kill, bullet hit */
  light(): void {
    vibrate(18);
  }

  /** Medium impact — enemy spawn, small explosion */
  medium(): void {
    vibrate(40);
  }

  /** Heavy impact — boss kill, large explosion */
  heavy(): void {
    vibrate([60, 30, 80]);
  }

  /** Player death — long dramatic rumble */
  death(): void {
    vibrate([100, 40, 120, 40, 160]);
  }

  /** Boss spawn — ominous double pulse */
  bossSpawn(): void {
    vibrate([80, 60, 120]);
  }

  /** Player respawn — sharp nudge */
  respawn(): void {
    vibrate([80, 80, 50]);
  }

  /** BlackHole absorb — quick suck */
  absorb(): void {
    vibrate(25);
  }

  /** Error/warning — e.g. last life */
  warning(): void {
    vibrate([40, 40, 40, 40, 40]);
  }

  /** BlackHole supernova — escalating dramatic pattern */
  supernova(): void {
    vibrate([100, 30, 150, 40, 200]);
  }
}
