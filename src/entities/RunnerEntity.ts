import Phaser from 'phaser';

/**
 * RunnerEntity — shared base for every POOLED, world-scrolling entity (ticks,
 * tablets, obstacles, armor pickups, finish line).
 *
 * Pooling contract (spec §10.1 — no per-spawn GC churn):
 *  - Instances live in a `Phaser.Physics.Arcade.Group` (the pool) and are reused.
 *  - `group.get()` hands back a dead instance (or constructs one up to maxSize);
 *    the scene/spawner then calls `spawn(x, y)` to make it live at a position.
 *  - `recycle()` disables the body + hides it, returning it to the pool for reuse.
 *
 * Horizontal motion is driven by the Spawner setting `body.velocity.x` to the
 * current world speed each frame, so entities stay in lock-step with the parallax
 * and the distance metric (1 world unit == 1 px). None of these entities use
 * gravity — they float at their spawn Y and scroll left.
 */
export abstract class RunnerEntity extends Phaser.Physics.Arcade.Sprite {
  /** Reactivate this pooled entity at (x, y) with a live, gravity-free body. */
  spawn(x: number, y: number): this {
    // enableBody(reset, x, y, enableGameObject, showGameObject)
    this.enableBody(true, x, y, true, true);
    this.setActive(true);
    this.setVisible(true);
    this.setScale(1);
    this.setAlpha(1);
    this.setAngle(0);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setAllowGravity(false);
    body.setVelocity(0, 0);
    this.configureBody(body);
    return this;
  }

  /** Return to the pool: disable body, hide, deactivate (so `group.get` reuses it). */
  recycle(): void {
    if (!this.active) return;
    // disableBody(disableGameObject, hideGameObject)
    this.disableBody(true, true);
  }

  /** Whether this entity has scrolled far enough off-screen to be recycled. */
  isOffscreenLeft(recycleX: number): boolean {
    return this.active && this.x < recycleX;
  }

  /**
   * Size/position the Arcade body once it is live. Default: a centered box scaled
   * to `hitboxScale` of the art frame — forgiving for the player. Subclasses may
   * override for a non-centered or full-height body (e.g. the finish line).
   */
  protected configureBody(body: Phaser.Physics.Arcade.Body): void {
    const scale = this.hitboxScale();
    body.setSize(this.width * scale, this.height * scale, true);
  }

  /** Fraction of the art frame used for the (centered) hitbox. */
  protected abstract hitboxScale(): number;
}
