import Phaser from 'phaser';
import {
  LEVEL_LENGTH,
  SCROLL_SPEED_START,
  SCROLL_SPEED_MAX,
  HAZARD_SPACING_START,
  HAZARD_SPACING_END,
  TABLET_SPACING_START,
  LATE_GENEROSITY_FACTOR,
} from '../config/gameConfig';

/**
 * DifficultyCurve — the authored ramp over the finite level (spec §3.8).
 *
 * Pure, stateless functions of `progress` (distance / LEVEL_LENGTH, clamped to
 * [0,1]) so the ramp is repeatable and tunable entirely from gameConfig:
 *  - world SPEED rises start → max;
 *  - hazard SPACING tightens start → end (always jump-clearable, §3.2);
 *  - collectible GENEROSITY tapers in the final quarter to raise late tension,
 *    which WIDENS tablet spacing near the finish.
 */
export class DifficultyCurve {
  /** Fraction of the level completed, from distance travelled. */
  progress(distance: number): number {
    return Phaser.Math.Clamp(distance / LEVEL_LENGTH, 0, 1);
  }

  /** World scroll speed (px/s) at this progress. */
  speed(progress: number): number {
    return Phaser.Math.Linear(SCROLL_SPEED_START, SCROLL_SPEED_MAX, progress);
  }

  /** Center-to-center world spacing (== on-screen px) between consecutive hazards. */
  hazardSpacing(progress: number): number {
    return Phaser.Math.Linear(HAZARD_SPACING_START, HAZARD_SPACING_END, progress);
  }

  /**
   * Collectible generosity multiplier: 1.0 until the final quarter, then eases to
   * LATE_GENEROSITY_FACTOR by the finish (fewer freebies near the end).
   */
  generosity(progress: number): number {
    if (progress <= 0.75) return 1;
    const tail = (progress - 0.75) / 0.25; // 0 → 1 across the last quarter
    return Phaser.Math.Linear(1, LATE_GENEROSITY_FACTOR, tail);
  }

  /** World spacing between tablets — widens as generosity tapers late-game. */
  tabletSpacing(progress: number): number {
    return TABLET_SPACING_START / this.generosity(progress);
  }
}
