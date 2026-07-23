import Phaser from 'phaser';
import { KEYS } from '../config/assetManifest';
import {
  GRAVITY_Y,
  JUMP_VELOCITY_Y,
  MAX_HP,
  START_HP,
  INVULN_MS,
  INVULN_BLINK_MS,
  ARMOR_DURATION_MS,
  ARMOR_EXPIRY_TELL_MS,
  ARMOR_AURA_BLINK_MS,
  HERO_BODY_WIDTH,
  HERO_BODY_HEIGHT,
  HERO_RUN_TILT_DEG,
  HERO_RUN_TILT_MS,
  HERO_JUMP_STRETCH,
  HERO_JUMP_STRETCH_MS,
  HERO_LAND_SQUASH,
  HERO_LAND_SQUASH_MS,
  HERO_HIT_POSE_MS,
  HIT_FLASH_MS,
  HERO_VICTORY_HOP_VELOCITY,
} from '../config/gameConfig';

/** Visual/logic state of the hero (spec §4.1 — the five animation states). */
export type HeroState = 'run' | 'jump' | 'hit' | 'victory' | 'defeat';

/**
 * HeroDog — the player avatar (spec §3.3, §3.4, §3.7).
 *
 * An Arcade-physics sprite pinned at a fixed screen X while the world scrolls past
 * (the Spawner/parallax move; the dog only moves vertically). Owns:
 *  - a run → jump → hit → victory/defeat state machine (single SVG per state);
 *  - HP with a post-hit invulnerability (i-frame) window so one contact can't
 *    drain multiple hearts (§3.4);
 *  - the Armor power-up: timed total invulnerability with a `dog_armored` art swap,
 *    a persistent aura, and an expiry blink tell (§3.7 / §4.4).
 *
 * Animation is done with tweens on body-safe channels: run uses an ANGLE tilt
 * (Arcade AABBs ignore rotation, so the hitbox never wobbles); jump squash/stretch
 * scales briefly only at takeoff/landing (never mid-air where collectibles are
 * grabbed); i-frames blink ALPHA. The scene drives per-frame work via `tick()`.
 */
export class HeroDog extends Phaser.Physics.Arcade.Sprite {
  hp = START_HP;

  private heroState: HeroState = 'run';
  private grounded = true;
  private armorUntil = 0;
  private invulnUntil = 0;

  /** Persistent shield aura shown while armored; follows the dog in `tick()`. */
  private readonly aura: Phaser.GameObjects.Image;

  private runTilt?: Phaser.Tweens.Tween | undefined;
  private blink?: Phaser.Tweens.Tween | undefined;
  private hitPoseTimer?: Phaser.Time.TimerEvent;
  private flashTimer?: Phaser.Time.TimerEvent;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, KEYS.dog_run);
    this.setOrigin(0.5, 1); // feet rest on the ground line at `y`
    scene.add.existing(this);
    scene.physics.add.existing(this);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setGravityY(GRAVITY_Y);
    body.setVelocity(0, 0);
    this.applyBody();

    // Aura sits just above the hero; created hidden, shown on armor pickup.
    this.aura = scene.add.image(x, y, KEYS.vfx_armor_aura).setOrigin(0.5, 0.5);
    this.aura.setVisible(false).setActive(false);

    this.enterRun();
  }

  // ── Public state queries (also power the Phase-4 HUD hooks) ────────────────
  // NB: named `currentState` (not `state`) — Phaser.GameObjects.Sprite already
  // owns a `state` property, which a getter cannot legally override.
  get currentState(): HeroState {
    return this.heroState;
  }

  get isAlive(): boolean {
    return this.heroState !== 'defeat' && this.heroState !== 'victory';
  }

  isArmored(time: number): boolean {
    return time < this.armorUntil;
  }

  /** True while EITHER armor or the post-hit i-frame window is active. */
  isInvulnerable(time: number): boolean {
    return time < this.armorUntil || time < this.invulnUntil;
  }

  /** Milliseconds of armor remaining (0 if not armored) — for the HUD/audio tell. */
  armorRemaining(time: number): number {
    return Math.max(0, this.armorUntil - time);
  }

  /** The shared aura game object (so the scene can order its depth once). */
  get auraSprite(): Phaser.GameObjects.Image {
    return this.aura;
  }

  // ── Input ──────────────────────────────────────────────────────────────────
  /** Edge-triggered jump: fires only when grounded & alive; ignored airborne. */
  jump(): void {
    if (!this.isAlive || !this.grounded) return;
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocityY(JUMP_VELOCITY_Y);
    this.grounded = false;
    this.enterJump();
  }

  // ── Damage / heal / armor ───────────────────────────────────────────────────
  /**
   * Apply `amount` damage. Returns true only if HP was actually removed (false
   * when invulnerable) so the caller knows whether to consume the hazard / react.
   * i-frames are what stop a single lingering contact from draining several HP.
   */
  takeHit(time: number, amount: number): boolean {
    if (!this.isAlive || this.isInvulnerable(time)) return false;

    this.hp = Math.max(0, this.hp - amount);
    this.invulnUntil = time + INVULN_MS;
    this.enterHit();
    this.startBlink();
    return true;
  }

  /** Heal by `amount`, capped at the 3-heart max (spec §3.4). */
  heal(amount: number): void {
    this.hp = Math.min(MAX_HP, this.hp + amount);
  }

  /** Activate the Armor power-up: timed total invulnerability + art swap (§3.7). */
  activateArmor(time: number): void {
    this.armorUntil = time + ARMOR_DURATION_MS;
    this.aura.setVisible(true).setActive(true).setAlpha(1);
    // Post-hit blink is redundant under armor — clear it for a clean aura read.
    this.stopBlink();
    if (this.heroState === 'run') this.setHeroTexture(KEYS.dog_armored);
  }

  // ── Terminal poses ───────────────────────────────────────────────────────────
  victory(): void {
    if (!this.isAlive) return;
    this.enterEnd('victory');
    const body = this.body as Phaser.Physics.Arcade.Body;
    // Re-enable a brief hop for celebration, then let it settle.
    body.setVelocity(0, HERO_VICTORY_HOP_VELOCITY);
    this.scene.tweens.add({
      targets: this,
      scaleX: 1.06,
      scaleY: 0.94,
      duration: 160,
      yoyo: true,
      ease: 'Quad.out',
    });
  }

  defeat(): void {
    if (!this.isAlive) return;
    this.enterEnd('defeat');
    this.scene.tweens.add({
      targets: this,
      angle: -8,
      duration: 220,
      ease: 'Quad.out',
    });
  }

  // ── Per-frame update (called by the scene) ──────────────────────────────────
  tick(time: number): void {
    const body = this.body as Phaser.Physics.Arcade.Body | null;

    if (this.heroState === 'victory' || this.heroState === 'defeat') {
      this.aura.setVisible(false);
      return;
    }

    // Landing detection: a jump that has touched the floor returns to run.
    if (body) {
      const onFloor = body.onFloor();
      if (onFloor && !this.grounded && this.heroState === 'jump') {
        this.grounded = true;
        this.onLanded();
      }
      this.grounded = onFloor;
    }

    // Armor lifetime + expiry tell.
    if (this.armorUntil > 0) {
      if (time >= this.armorUntil) {
        this.deactivateArmor();
      } else {
        this.updateAura(time);
      }
    }

    // i-frame expiry (independent of armor).
    if (this.invulnUntil > 0 && time >= this.invulnUntil) {
      this.stopBlink();
    }
  }

  // ── State entry helpers ──────────────────────────────────────────────────────
  private enterRun(): void {
    this.heroState = 'run';
    this.setHeroTexture(this.isArmored(this.scene.time.now) ? KEYS.dog_armored : KEYS.dog_run);
    this.setScale(1);
    this.startRunTilt();
  }

  private enterJump(): void {
    this.heroState = 'jump';
    this.setHeroTexture(KEYS.dog_jump);
    this.stopRunTilt();
    this.setAngle(0);
    // Takeoff stretch — brief, resets to 1 well before apex (mid-air stays true).
    this.scene.tweens.add({
      targets: this,
      scaleX: 1 - HERO_JUMP_STRETCH,
      scaleY: 1 + HERO_JUMP_STRETCH,
      duration: HERO_JUMP_STRETCH_MS,
      yoyo: true,
      ease: 'Quad.out',
    });
  }

  private onLanded(): void {
    // Landing squash, then settle into the run loop.
    this.scene.tweens.add({
      targets: this,
      scaleX: 1 + HERO_LAND_SQUASH,
      scaleY: 1 - HERO_LAND_SQUASH,
      duration: HERO_LAND_SQUASH_MS,
      yoyo: true,
      ease: 'Quad.out',
    });
    this.enterRun();
  }

  private enterHit(): void {
    this.heroState = 'hit';
    this.setHeroTexture(KEYS.dog_hit);
    this.stopRunTilt();

    // Red flash on the dog.
    this.setTint(0xff6b6b);
    this.flashTimer?.remove();
    this.flashTimer = this.scene.time.delayedCall(HIT_FLASH_MS, () => this.clearTint());

    // Hold the hit pose briefly, then return to run/jump (unless the run ended).
    this.hitPoseTimer?.remove();
    this.hitPoseTimer = this.scene.time.delayedCall(HERO_HIT_POSE_MS, () => {
      if (this.heroState !== 'hit') return;
      if (this.grounded) this.enterRun();
      else {
        this.heroState = 'jump';
        this.setHeroTexture(KEYS.dog_jump);
      }
    });
  }

  private enterEnd(which: 'victory' | 'defeat'): void {
    this.heroState = which;
    this.stopRunTilt();
    this.stopBlink();
    this.flashTimer?.remove();
    this.hitPoseTimer?.remove();
    this.clearTint();
    this.setAngle(0);
    this.aura.setVisible(false).setActive(false);
    this.setHeroTexture(which === 'victory' ? KEYS.dog_victory : KEYS.dog_defeat);
  }

  private deactivateArmor(): void {
    this.armorUntil = 0;
    this.aura.setVisible(false).setActive(false);
    if (this.heroState === 'run') this.setHeroTexture(KEYS.dog_run);
  }

  // ── Tween/visual utilities ──────────────────────────────────────────────────
  private updateAura(time: number): void {
    // Aura rides the dog's torso.
    this.aura.setPosition(this.x, this.y - HERO_BODY_HEIGHT * 0.55);
    // Expiry tell: blink in the final window (spec §4.4).
    const remaining = this.armorUntil - time;
    if (remaining <= ARMOR_EXPIRY_TELL_MS) {
      const on = Math.floor(time / ARMOR_AURA_BLINK_MS) % 2 === 0;
      this.aura.setAlpha(on ? 1 : 0.25);
    } else {
      this.aura.setAlpha(1);
    }
  }

  private startRunTilt(): void {
    this.stopRunTilt();
    this.setAngle(0);
    this.runTilt = this.scene.tweens.add({
      targets: this,
      angle: { from: -HERO_RUN_TILT_DEG, to: HERO_RUN_TILT_DEG },
      duration: HERO_RUN_TILT_MS,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });
  }

  private stopRunTilt(): void {
    this.runTilt?.stop();
    this.runTilt = undefined;
  }

  private startBlink(): void {
    this.stopBlink();
    this.blink = this.scene.tweens.add({
      targets: this,
      alpha: 0.3,
      duration: INVULN_BLINK_MS,
      yoyo: true,
      repeat: -1,
    });
  }

  private stopBlink(): void {
    this.blink?.stop();
    this.blink = undefined;
    this.setAlpha(1);
  }

  /** Swap the state SVG and re-fit the (feet-anchored) physics body to it. */
  private setHeroTexture(key: string): void {
    if (this.texture.key === key) return;
    this.setTexture(key);
    this.setOrigin(0.5, 1);
    if (this.body) this.applyBody();
  }

  /**
   * Fit a forgiving, feet-anchored body to the current frame. With origin (0.5,1)
   * and this offset, the body's bottom sits exactly on the sprite's y (the feet),
   * horizontally centered — so the ground collider rests the dog correctly and the
   * hitbox stays fair as textures swap between differently-sized state frames.
   */
  private applyBody(): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    const fw = this.width;
    const fh = this.height;
    body.setSize(HERO_BODY_WIDTH, HERO_BODY_HEIGHT, false);
    body.setOffset((fw - HERO_BODY_WIDTH) / 2, fh - HERO_BODY_HEIGHT);
  }
}
