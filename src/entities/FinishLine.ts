import Phaser from 'phaser';
import { KEYS } from '../config/assetManifest';
import { FINISH_HITBOX_WIDTH } from '../config/gameConfig';
import { RunnerEntity } from './RunnerEntity';

/**
 * FinishLine — spawned ONCE at world position LEVEL_LENGTH (spec §3.9). Reaching
 * it with ≥1 HP ends the run in Victory. Ground entity anchored bottom-center; a
 * thin, FULL-HEIGHT trigger band so the overlap fires whether the hero is grounded
 * or mid-jump when it arrives. Pooled via a 1-slot group for API consistency.
 */
export class FinishLine extends RunnerEntity {
  constructor(scene: Phaser.Scene, x = 0, y = 0) {
    super(scene, x, y, KEYS.finish_line);
    this.setOrigin(0.5, 1);
  }

  protected hitboxScale(): number {
    return 1; // unused — configureBody is overridden below
  }

  protected override configureBody(body: Phaser.Physics.Arcade.Body): void {
    // Thin horizontally, full art height, centered → catches any jump height.
    body.setSize(FINISH_HITBOX_WIDTH, this.height, true);
  }
}
