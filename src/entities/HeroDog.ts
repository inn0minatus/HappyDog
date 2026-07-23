import Phaser from 'phaser';
import { KEYS } from '../config/assetManifest';

/**
 * HeroDog — the player avatar.
 *
 * Phase 1 is a PLACEHOLDER: it renders the run sprite pinned at a fixed screen X
 * (the world will scroll past it later) with a gentle idle bob, plus a cosmetic
 * squash-hop on tap to prove the input path end-to-end. No physics/HP yet.
 *
 * Phase 2 turns this into a `Phaser.Physics.Arcade.Sprite` with HP and the five
 * animation states (run/jump/hit/victory/defeat) — the class boundary is here so
 * that is an additive change, not a rewrite.
 */
export class HeroDog extends Phaser.GameObjects.Sprite {
  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, KEYS.dog_run);
    this.setOrigin(0.5, 1); // feet rest on the ground line at `y`
    scene.add.existing(this);

    // Idle bob so the placeholder reads as "alive".
    scene.tweens.add({
      targets: this,
      y: y - 6,
      duration: 420,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });
  }

  /** Cosmetic squash-hop on tap (Phase 1 has no real jump physics yet). */
  nudgeJump(): void {
    this.scene.tweens.add({
      targets: this,
      scaleX: 1.08,
      scaleY: 0.9,
      duration: 90,
      yoyo: true,
      ease: 'Quad.out',
    });
  }
}
