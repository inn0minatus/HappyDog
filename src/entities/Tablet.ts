import Phaser from 'phaser';
import { KEYS } from '../config/assetManifest';
import { PICKUP_HITBOX_SCALE } from '../config/gameConfig';
import { RunnerEntity } from './RunnerEntity';

/**
 * Tablet — the brand product collectible (spec §3.3). Pickup grants +score and
 * +1 HP (capped at the 3-heart max). Hovers above the ground (placed by the
 * Spawner) so collecting it requires a jump — the same jump that clears hazards.
 * Centered origin so it floats; forgiving hitbox so it's easy to grab.
 */
export class Tablet extends RunnerEntity {
  constructor(scene: Phaser.Scene, x = 0, y = 0) {
    super(scene, x, y, KEYS.tablet);
    this.setOrigin(0.5, 0.5); // floating collectible
  }

  protected hitboxScale(): number {
    return PICKUP_HITBOX_SCALE;
  }
}
