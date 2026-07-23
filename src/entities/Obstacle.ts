import Phaser from 'phaser';
import { KEYS } from '../config/assetManifest';
import { HAZARD_HITBOX_SCALE } from '../config/gameConfig';
import { RunnerEntity } from './RunnerEntity';

/**
 * Environmental obstacles (spec §3.3) — bush & puddle. Same damage model as a
 * tick (−1 HP), treated as jump-over hazards. Both are ground entities anchored
 * bottom-center. Split into two thin classes so each backs its own object pool
 * (a pool is single-texture), while sharing the ground-hazard hitbox.
 */
abstract class GroundObstacle extends RunnerEntity {
  protected hitboxScale(): number {
    return HAZARD_HITBOX_SCALE;
  }
}

/** Bush — a tall-ish jump obstacle. */
export class Bush extends GroundObstacle {
  constructor(scene: Phaser.Scene, x = 0, y = 0) {
    super(scene, x, y, KEYS.bush);
    this.setOrigin(0.5, 1);
  }
}

/** Puddle — a low, wide jump obstacle. */
export class Puddle extends GroundObstacle {
  constructor(scene: Phaser.Scene, x = 0, y = 0) {
    super(scene, x, y, KEYS.puddle);
    this.setOrigin(0.5, 1);
  }
}
