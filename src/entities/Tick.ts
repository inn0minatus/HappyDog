import Phaser from 'phaser';
import { KEYS } from '../config/assetManifest';
import { HAZARD_HITBOX_SCALE } from '../config/gameConfig';
import { RunnerEntity } from './RunnerEntity';

/**
 * Tick — the signature damaging enemy (spec §3.3). A ground hazard: collision
 * costs the hero −1 HP (unless armored/invulnerable). Anchored bottom-center on
 * the ground line, faces right (no flip). A gentle idle wobble is applied by the
 * Spawner via a shared tween so pooled instances animate without per-entity work.
 */
export class Tick extends RunnerEntity {
  constructor(scene: Phaser.Scene, x = 0, y = 0) {
    super(scene, x, y, KEYS.tick);
    this.setOrigin(0.5, 1); // ground entity → feet on the ground line
  }

  protected hitboxScale(): number {
    return HAZARD_HITBOX_SCALE;
  }
}
