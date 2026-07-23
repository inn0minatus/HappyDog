import Phaser from 'phaser';
import { SceneKey } from './keys';
import {
  GAME_WIDTH,
  GAME_HEIGHT,
  GROUND_TOP_Y,
  HERO_X,
  MAX_HP,
  TICK_DAMAGE,
  OBSTACLE_DAMAGE,
  TABLET_HEAL,
  TABLET_SCORE,
  SCORE_SURVIVAL_PER_S,
  LEVEL_LENGTH,
  SPAWN_MARGIN_PX,
  RECYCLE_MARGIN_PX,
  HERO_BODY_HEIGHT,
  PARALLAX_FACTOR_FAR,
  PARALLAX_FACTOR_NEAR,
  PARALLAX_FACTOR_GROUND,
  PARALLAX_FACTOR_GRASS,
  HIT_SHAKE_MS,
  HIT_SHAKE_INTENSITY,
  HIT_FLASH_MS,
  RESULTS_HANDOFF_DELAY_MS,
  DEPTH,
} from '../config/gameConfig';
import { KEYS } from '../config/assetManifest';
import { track, type FinishGameParams } from '../analytics/track';
import { HeroDog } from '../entities/HeroDog';
import { FinishLine } from '../entities/FinishLine';
import { RunnerEntity } from '../entities/RunnerEntity';
import { DifficultyCurve } from '../systems/DifficultyCurve';
import { Spawner } from '../systems/Spawner';
import { Hud } from '../ui/Hud';
import { PauseOverlay } from '../ui/PauseOverlay';
import { GameEvents } from './gameEvents';
import { playSfx, Sfx, playMusic, pauseMusic, resumeMusic, stopMusic, Music } from '../systems/audio';

// Re-export the event contract so subscribers can import it "from GameScene"
// (the canonical name) OR from the standalone module that breaks the Hud↔Scene
// import cycle. Both point at the same const.
export { GameEvents } from './gameEvents';

/**
 * GameScene — the real, finite core run loop (spec §3, §5.2, §8.3).
 *
 * The hero is pinned at HERO_X and only moves vertically; the WORLD scrolls past
 * (parallax tileSprites + object-pooled entities driven by the DifficultyCurve).
 * Fires `start_game` on entry and `finish_game` on Victory (finish line) or Game
 * Over (0 HP), then hands the SAME {result, score, duration_s} payload to
 * ResultsScene.
 *
 * The scene is purely the MODEL: it owns run state and EMITS `GameEvents` on
 * `scene.events`; the Hud/PauseOverlay are the VIEW and only subscribe. Audio is
 * fired at the same choke points as the events (jump/hit/pickup/armor/win/lose).
 */
export class GameScene extends Phaser.Scene {
  private hero!: HeroDog;
  private curve!: DifficultyCurve;
  private spawner!: Spawner;
  private finishLine!: FinishLine;
  private hud!: Hud;
  private pauseOverlay: PauseOverlay | undefined;

  // Parallax layers.
  private bgFar!: Phaser.GameObjects.TileSprite;
  private bgNear!: Phaser.GameObjects.TileSprite;
  private groundTile!: Phaser.GameObjects.TileSprite;
  private fgGrass!: Phaser.GameObjects.TileSprite;

  // Run state.
  private distance = 0;
  private elapsedMs = 0;
  private tabletScore = 0;
  private score = 0;
  private finished = false;
  private finishSpawned = false;
  private paused = false;

  // Change-tracking so HUD events only fire on transitions.
  private lastHp = MAX_HP;
  private lastScore = 0;
  private lastArmorActive = false;

  private readonly spawnX = GAME_WIDTH + SPAWN_MARGIN_PX;
  private readonly recycleX = -RECYCLE_MARGIN_PX;
  /** Distance the hero covers while a right-edge spawn scrolls in to reach it. */
  private readonly approach = GAME_WIDTH + SPAWN_MARGIN_PX - HERO_X;

  constructor() {
    super({ key: SceneKey.Game });
  }

  create(): void {
    this.resetState();
    this.buildParallax();
    this.buildGroundAndHero();
    this.buildSystems();
    this.buildFinishLine();
    this.registerCollisions();
    this.buildHud();
    this.buildInput();

    // A round has begun (spec §5.2).
    track('start_game');
    this.events.emit(GameEvents.runStart);
    playMusic(this, Music.game);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanup, this);
  }

  // ── Public read hooks (HUD/audio can poll these for initial state) ─────────
  get liveHp(): number {
    return this.hero.hp;
  }
  get liveScore(): number {
    return this.score;
  }
  get liveProgress(): number {
    return this.curve.progress(this.distance);
  }

  // ── Build steps ─────────────────────────────────────────────────────────────
  private resetState(): void {
    this.distance = 0;
    this.elapsedMs = 0;
    this.tabletScore = 0;
    this.score = 0;
    this.finished = false;
    this.finishSpawned = false;
    this.paused = false;
    this.lastHp = MAX_HP;
    this.lastScore = 0;
    this.lastArmorActive = false;
  }

  private buildParallax(): void {
    const cx = GAME_WIDTH / 2;
    this.bgFar = this.add
      .tileSprite(cx, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, KEYS.park_bg_far)
      .setDepth(DEPTH.bgFar);
    this.bgNear = this.add
      .tileSprite(cx, GROUND_TOP_Y, GAME_WIDTH, 360, KEYS.park_bg_near)
      .setOrigin(0.5, 1)
      .setDepth(DEPTH.bgNear);
    this.groundTile = this.add
      .tileSprite(cx, GROUND_TOP_Y, GAME_WIDTH, GAME_HEIGHT - GROUND_TOP_Y, KEYS.ground_tile)
      .setOrigin(0.5, 0)
      .setDepth(DEPTH.ground);
    this.fgGrass = this.add
      .tileSprite(cx, GAME_HEIGHT, GAME_WIDTH, 140, KEYS.park_fg_grass)
      .setOrigin(0.5, 1)
      .setDepth(DEPTH.grass);
  }

  private buildGroundAndHero(): void {
    this.hero = new HeroDog(this, HERO_X, GROUND_TOP_Y);
    this.hero.setDepth(DEPTH.hero);
    this.hero.auraSprite.setDepth(DEPTH.aura);

    // Invisible static floor so the hero's jump arc lands cleanly.
    const ground = this.add
      .rectangle(GAME_WIDTH / 2, GROUND_TOP_Y, GAME_WIDTH, GAME_HEIGHT - GROUND_TOP_Y, 0x000000, 0)
      .setOrigin(0.5, 0);
    this.physics.add.existing(ground, true);
    this.physics.add.collider(this.hero, ground);
  }

  private buildSystems(): void {
    this.curve = new DifficultyCurve();
    this.spawner = new Spawner(this, this.curve, GROUND_TOP_Y, this.spawnX, this.recycleX);
  }

  private buildFinishLine(): void {
    this.finishLine = new FinishLine(this);
    this.finishLine.setDepth(DEPTH.entity);
    this.add.existing(this.finishLine);
    this.physics.add.existing(this.finishLine);
    this.finishLine.recycle(); // hidden until it's queued near LEVEL_LENGTH
  }

  private registerCollisions(): void {
    // Ticks: damage; when armored, the tick is CONSUMED for a powerful feel (§3.7).
    this.physics.add.overlap(
      this.hero,
      this.spawner.tickPool,
      (_h, obj) => this.onTick(obj as RunnerEntity),
      undefined,
      this,
    );
    // Bush/puddle: damage; ignored (not consumed) while invulnerable.
    this.physics.add.overlap(
      this.hero,
      this.spawner.obstaclePools,
      (_h, obj) => this.onObstacle(obj as RunnerEntity),
      undefined,
      this,
    );
    // Tablet: +score & +1 HP (capped).
    this.physics.add.overlap(
      this.hero,
      this.spawner.tabletPool,
      (_h, obj) => this.onTablet(obj as RunnerEntity),
      undefined,
      this,
    );
    // Armor: activate timed invulnerability + burst VFX.
    this.physics.add.overlap(
      this.hero,
      this.spawner.armorPool,
      (_h, obj) => this.onArmor(obj as RunnerEntity),
      undefined,
      this,
    );
    // Finish line: Victory.
    this.physics.add.overlap(this.hero, this.finishLine, () => this.endRun('win'), undefined, this);
  }

  private buildHud(): void {
    this.hud = new Hud(
      this,
      { onPause: () => this.pauseGame() },
      { hp: this.liveHp, score: this.liveScore, progress: this.liveProgress },
    );
  }

  private buildInput(): void {
    // The WHOLE canvas is the jump zone (spec §3.2 / §10.4), EXCEPT the HUD
    // controls: a tap that lands on an interactive object (pause/mute) must not
    // also jump, and no tap jumps while paused or after the run has ended.
    this.input.on(Phaser.Input.Events.POINTER_DOWN, this.onPointerDown, this);
    this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE).on('down', this.onJumpKey, this);
  }

  // ── Input handlers ─────────────────────────────────────────────────────────
  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (this.paused || this.finished) return;
    // Taps on interactive HUD controls (pause/mute) are handled by those objects;
    // they must NOT also trigger a jump.
    if (this.input.hitTestPointer(pointer).length > 0) return;
    this.tryJump();
  }

  private onJumpKey(): void {
    if (this.paused || this.finished) return;
    this.tryJump();
  }

  private tryJump(): void {
    if (this.hero.jump()) playSfx(this, Sfx.jump);
  }

  // ── Per-frame loop ────────────────────────────────────────────────────────────
  override update(_time: number, delta: number): void {
    if (this.finished || this.paused) return;

    const dt = delta / 1000;
    this.elapsedMs += delta;

    const progress = this.curve.progress(this.distance);
    const worldSpeed = this.curve.speed(progress);
    this.distance += worldSpeed * dt;

    this.scrollParallax(worldSpeed, dt);
    this.spawner.update(this.distance, worldSpeed, progress);
    this.updateFinishLine(worldSpeed);

    // Drive hero animation/armor timing off the SCENE clock so it freezes exactly
    // with the pause overlay (this.time.paused) and resumes bit-for-bit.
    const now = this.time.now;
    this.hero.tick(now);
    this.updateScore();
    this.syncHp();
    this.events.emit(GameEvents.progress, progress);
    this.emitArmor(now);

    // Deterministic Victory: the finish line has reached the hero.
    if (this.finishSpawned && this.finishLine.active && this.finishLine.x <= HERO_X) {
      this.endRun('win');
    }
  }

  private scrollParallax(worldSpeed: number, dt: number): void {
    this.bgFar.tilePositionX += worldSpeed * PARALLAX_FACTOR_FAR * dt;
    this.bgNear.tilePositionX += worldSpeed * PARALLAX_FACTOR_NEAR * dt;
    this.groundTile.tilePositionX += worldSpeed * PARALLAX_FACTOR_GROUND * dt;
    this.fgGrass.tilePositionX += worldSpeed * PARALLAX_FACTOR_GRASS * dt;
  }

  private updateFinishLine(worldSpeed: number): void {
    if (!this.finishSpawned) {
      if (this.distance >= LEVEL_LENGTH - this.approach) {
        this.finishLine.spawn(this.spawnX, GROUND_TOP_Y);
        this.finishSpawned = true;
        this.spawner.stopSpawning(); // nothing spawns past the finish (§3.9)
      }
      return;
    }
    if (this.finishLine.active) this.finishLine.setVelocityX(-worldSpeed);
  }

  // ── HUD event emitters (view-agnostic; the Hud subscribes) ─────────────────
  private updateScore(): void {
    const survival = Math.floor((this.elapsedMs / 1000) * SCORE_SURVIVAL_PER_S);
    this.score = this.tabletScore + survival;
    if (this.score !== this.lastScore) {
      this.events.emit(GameEvents.score, this.score);
      this.lastScore = this.score;
    }
  }

  private syncHp(): void {
    const hp = this.hero.hp;
    if (hp !== this.lastHp) {
      this.events.emit(GameEvents.hp, hp);
      this.lastHp = hp;
    }
  }

  private emitArmor(time: number): void {
    const active = this.hero.isArmored(time);
    if (active !== this.lastArmorActive) {
      this.events.emit(GameEvents.armor, { active, remainingMs: this.hero.armorRemaining(time) });
      this.lastArmorActive = active;
    }
  }

  // ── Collision handlers ─────────────────────────────────────────────────────────
  private onTick(tick: RunnerEntity): void {
    if (this.finished || !tick.active) return;
    const time = this.time.now;
    if (this.hero.isArmored(time)) {
      tick.recycle(); // consumed by the shield — feels powerful (§3.7)
      return;
    }
    if (this.hero.isInvulnerable(time)) return; // mid i-frame — ignore, don't consume
    if (this.hero.takeHit(time, TICK_DAMAGE)) {
      tick.recycle();
      this.onHeroDamaged();
    }
  }

  private onObstacle(obstacle: RunnerEntity): void {
    if (this.finished || !obstacle.active) return;
    const time = this.time.now;
    if (this.hero.isInvulnerable(time)) return; // armored or i-frame → no damage
    if (this.hero.takeHit(time, OBSTACLE_DAMAGE)) {
      this.onHeroDamaged(); // the dog bumps it; obstacle keeps scrolling
    }
  }

  private onTablet(tablet: RunnerEntity): void {
    if (this.finished || !tablet.active) return;
    tablet.recycle();
    this.tabletScore += TABLET_SCORE;
    this.hero.heal(TABLET_HEAL);
    this.syncHp();
    playSfx(this, Sfx.tablet);
  }

  private onArmor(armor: RunnerEntity): void {
    if (this.finished || !armor.active) return;
    armor.recycle();
    this.hero.activateArmor(this.time.now);
    this.spawnArmorBurst();
    playSfx(this, Sfx.armor);
  }

  private onHeroDamaged(): void {
    this.cameras.main.shake(HIT_SHAKE_MS, HIT_SHAKE_INTENSITY);
    this.cameras.main.flash(HIT_FLASH_MS, 200, 60, 60);
    this.syncHp();
    playSfx(this, Sfx.hit);
    if (this.hero.hp <= 0) this.endRun('lose');
  }

  /** One-shot pickup burst VFX (rare — not pooled; tween-then-destroy). */
  private spawnArmorBurst(): void {
    const burst = this.add
      .image(this.hero.x, this.hero.y - HERO_BODY_HEIGHT * 0.55, KEYS.vfx_armor_burst)
      .setDepth(DEPTH.aura);
    this.tweens.add({
      targets: burst,
      scale: { from: 0.5, to: 1.4 },
      alpha: { from: 1, to: 0 },
      duration: 380,
      ease: 'Quad.out',
      onComplete: () => burst.destroy(),
    });
  }

  // ── Pause loop ───────────────────────────────────────────────────────────────
  private pauseGame(): void {
    if (this.paused || this.finished) return;
    this.paused = true;
    // Freeze EVERYTHING: physics bodies, all tweens, the scene clock (which also
    // owns the spawner cadence + the hero's armor/i-frame timing), and music.
    this.physics.world.pause();
    this.tweens.pauseAll();
    this.time.paused = true;
    pauseMusic();

    this.pauseOverlay = new PauseOverlay(this, {
      onResume: () => this.resumeGame(),
      onRestart: () => this.restartRun(),
      onMenu: () => this.quitToMenu(),
      onMuteChanged: () => this.hud.syncMute(),
    });
  }

  private resumeGame(): void {
    if (!this.paused) return;
    this.exitPauseState();
    resumeMusic();
  }

  private restartRun(): void {
    // Leave no frozen physics/clock behind, drop the music so create() starts it
    // fresh, then rebuild the whole scene.
    this.exitPauseState();
    stopMusic();
    this.scene.restart();
  }

  private quitToMenu(): void {
    this.exitPauseState();
    stopMusic();
    this.scene.start(SceneKey.Menu);
  }

  /** Tear down the overlay and unfreeze the world (shared by every pause exit). */
  private exitPauseState(): void {
    this.pauseOverlay?.destroy();
    this.pauseOverlay = undefined;
    this.tweens.resumeAll();
    this.physics.world.resume();
    this.time.paused = false;
    this.paused = false;
  }

  // ── Termination ────────────────────────────────────────────────────────────────
  private endRun(result: 'win' | 'lose'): void {
    if (this.finished) return;
    this.finished = true;

    if (result === 'win') {
      this.hero.victory();
      playSfx(this, Sfx.victory);
    } else {
      this.hero.defeat();
      playSfx(this, Sfx.defeat);
    }
    stopMusic(); // the run is over — let the sting land over silence

    this.spawner.freeze();
    if (this.finishLine.active) this.finishLine.setVelocityX(0);

    const payload: FinishGameParams = {
      result,
      score: this.score,
      duration_s: Math.round(this.elapsedMs / 1000),
    };
    track('finish_game', payload);
    this.events.emit(GameEvents.runEnd, payload);

    // Let the win/lose pose read, then hand off with the EXACT payload.
    this.time.delayedCall(RESULTS_HANDOFF_DELAY_MS, () => {
      this.scene.start(SceneKey.Results, payload);
    });
  }

  private cleanup(): void {
    // Tweens/timers/display objects are scene-scoped and auto-destroyed; destroy the
    // pools + overlay explicitly so re-entering Game (play again) never leaks or
    // double-fires. (The Hud self-destructs on the same SHUTDOWN event.)
    this.pauseOverlay?.destroy();
    this.pauseOverlay = undefined;
    this.spawner.destroy();
  }
}
