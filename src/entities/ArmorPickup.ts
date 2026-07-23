import Phaser from 'phaser';
import { KEYS } from '../config/assetManifest';
import { PICKUP_HITBOX_SCALE } from '../config/gameConfig';
import { RunnerEntity } from './RunnerEntity';

/**
 * ArmorPickup — the "tablet as armor" shield power-up (spec §3.7). Pickup grants
 * timed total invulnerability. Occasional (~1–2/level). Hovers above the ground
 * like a tablet (jump to collect); centered origin so it floats.
 */
export class ArmorPickup extends RunnerEntity {
  constructor(scene: Phaser.Scene, x = 0, y = 0) {
    super(scene, x, y, KEYS.armor_pickup);
    this.setOrigin(0.5, 0.5);
  }

  protected hitboxScale(): number {
    return PICKUP_HITBOX_SCALE;
  }
}
