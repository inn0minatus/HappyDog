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
} from '../config/gameConfig';
import { KEYS } from '../config/assetManifest';
import { t } from '../i18n/strings';
import { track, type FinishGameParams } from '../analytics/track';
import { HeroDog } from '../entities/HeroDog';
import { FinishLine } from '../entities/FinishLine';
import { RunnerEntity } from '../entities/RunnerEntity';
import { DifficultyCurve } from '../systems/DifficultyCurve';
import { Spawner } from '../systems/Spawner';

/**
 * Events emitted on `scene.events` for a future HUD / AudioManager to subscribe to
 * (Phase 4). The in-scene HUD here is a throwaway readout; Phase 4's Hud.ts can
 * listen to these instead of reaching into the scene. Payloads are primitives.
 */
export const GameEvents = {
  hp: 'hud:hp', // (hp: number)
  score: 'hud:score', // (score: number)
  progress: 'hud:progress', // (progress: number 0..1)
  armor: 'hud:armor', // ({ active: boolean, remainingMs: number })
  runStart: 'run:start', // ()
  runEnd: 'run:end', // (payload: FinishGameParams)
} as const;

/** Render layering (presentation only). */
const Depth = {
  bgFar: 0,
  bgNear: 1,
  ground: 2,
  grass: 3,
  entity: 5,
  hero: 6,
  aura: 7,
  hud: 100,
} as const;

/**
 * GameScene — the real, finite core run loop (spec §3, §5.2, §8.3).
 *
 * The hero is pinned at HERO_X and only moves vertically; the WORLD scrolls past
 * (parallax tileSprites + object-pooled entities driven by the DifficultyCurve).
 * Fires `start_game` on entry and `finish_game` on Victory (finish line) or Game
 * Over (0 HP), then hands the SAME {result, score, duration_s} payload to
 * ResultsScene — the exact handoff the placeholder used.
 */
export class GameScene extends Phaser.Scene {
  private hero!: HeroDog;
  private curve!: DifficultyCurve;
  private spawner!: Spawner;
  private finishLine!: FinishLine;

  // Parallax layers.
  private bgFar!: Phaser.GameObjects.TileSprite;
  private bgNear!: Phaser.GameObjects.TileSprite;
  private groundTile!: Phaser.GameObjects.TileSprite;
  private fgGrass!: Phaser.GameObjects.TileSprite;

  // HUD readout.
  private heartImages: Phaser.GameObjects.Image[] = [];
  private scoreText!: Phaser.GameObjects.Text;
  private progressFill!: Phaser.GameObjects.Rectangle;

  // Run state.
  private distance = 0;
  private elapsedMs = 0;
  private tabletScore = 0;
  private score = 0;
  private finished = false;
  private finishSpawned = false;

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

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanup, this);
  }

  // ── Public read hooks (Phase 4 HUD/audio can poll these) ───────────────────
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
    this.lastHp = MAX_HP;
    this.lastScore = 0;
    this.lastArmorActive = false;
    this.heartImages = [];
  }

  private buildParallax(): void {
    const cx = GAME_WIDTH / 2;
    this.bgFar = this.add
      .tileSprite(cx, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, KEYS.park_bg_far)
      .setDepth(Depth.bgFar);
    this.bgNear = this.add
      .tileSprite(cx, GROUND_TOP_Y, GAME_WIDTH, 360, KEYS.park_bg_near)
      .setOrigin(0.5, 1)
      .setDepth(Depth.bgNear);
    this.groundTile = this.add
      .tileSprite(cx, GROUND_TOP_Y, GAME_WIDTH, GAME_HEIGHT - GROUND_TOP_Y, KEYS.ground_tile)
      .setOrigin(0.5, 0)
      .setDepth(Depth.ground);
    this.fgGrass = this.add
      .tileSprite(cx, GAME_HEIGHT, GAME_WIDTH, 140, KEYS.park_fg_grass)
      .setOrigin(0.5, 1)
      .setDepth(Depth.grass);
  }

  private buildGroundAndHero(): void {
    this.hero = new HeroDog(this, HERO_X, GROUND_TOP_Y);
    this.hero.setDepth(Depth.hero);
    this.hero.auraSprite.setDepth(Depth.aura);

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
    this.finishLine.setDepth(Depth.entity);
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
    // Level-progress bar (frame asset + a dynamic fill inset within it).
    const barY = 16;
    const barW = 1180; // == ui_progress_bar asset width
    const barLeft = GAME_WIDTH / 2 - barW / 2;
    this.add.image(GAME_WIDTH / 2, barY, KEYS.ui_progress_bar).setDepth(Depth.hud);
    this.progressFill = this.add
      .rectangle(barLeft + 2, barY, barW - 4, 8, 0x6cc04a)
      .setOrigin(0, 0.5)
      .setDepth(Depth.hud);
    this.progressFill.scaleX = 0;

    // Score row (top-left).
    const rowY = 58;
    this.add.image(38, rowY, KEYS.ui_score_icon).setDepth(Depth.hud);
    this.scoreText = this.add
      .text(68, rowY, `${t('hud_score')}: 0`, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '26px',
        fontStyle: 'bold',
        color: '#20272e',
      })
      .setOrigin(0, 0.5)
      .setDepth(Depth.hud);

    // Hearts (below the score row).
    for (let i = 0; i < MAX_HP; i++) {
      this.heartImages.push(this.add.image(42 + i * 44, 100, KEYS.ui_heart_full).setDepth(Depth.hud));
    }
  }

  private buildInput(): void {
    // The WHOLE canvas is the jump zone (spec §3.2 / §10.4). Auto-run is always on.
    this.input.on(Phaser.Input.Events.POINTER_DOWN, () => this.hero.jump());
    this.input.keyboard
      ?.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)
      .on('down', () => this.hero.jump());
  }

  // ── Per-frame loop ────────────────────────────────────────────────────────────
  override update(time: number, delta: number): void {
    if (this.finished) return;

    const dt = delta / 1000;
    this.elapsedMs += delta;

    const progress = this.curve.progress(this.distance);
    const worldSpeed = this.curve.speed(progress);
    this.distance += worldSpeed * dt;

    this.scrollParallax(worldSpeed, dt);
    this.spawner.update(this.distance, worldSpeed, progress);
    this.updateFinishLine(worldSpeed);

    this.hero.tick(time);
    this.updateScore();
    this.updateHud(progress);
    this.emitArmor(time);

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

  private updateScore(): void {
    const survival = Math.floor((this.elapsedMs / 1000) * SCORE_SURVIVAL_PER_S);
    this.score = this.tabletScore + survival;
    if (this.score !== this.lastScore) {
      this.scoreText.setText(`${t('hud_score')}: ${this.score}`);
      this.events.emit(GameEvents.score, this.score);
      this.lastScore = this.score;
    }
  }

  private updateHud(progress: number): void {
    this.progressFill.scaleX = progress;
    this.events.emit(GameEvents.progress, progress);
    if (this.hero.hp !== this.lastHp) this.refreshHearts();
  }

  private refreshHearts(): void {
    const hp = this.hero.hp;
    this.heartImages.forEach((img, i) => {
      img.setTexture(i < hp ? KEYS.ui_heart_full : KEYS.ui_heart_empty);
    });
    this.events.emit(GameEvents.hp, hp);
    this.lastHp = hp;
  }

  private emitArmor(time: number): void {
    const active = this.hero.isArmored(time);
    const remainingMs = this.hero.armorRemaining(time);
    if (active !== this.lastArmorActive) {
      this.events.emit(GameEvents.armor, { active, remainingMs });
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
    this.refreshHearts();
  }

  private onArmor(armor: RunnerEntity): void {
    if (this.finished || !armor.active) return;
    armor.recycle();
    this.hero.activateArmor(this.time.now);
    this.spawnArmorBurst();
  }

  private onHeroDamaged(): void {
    this.cameras.main.shake(HIT_SHAKE_MS, HIT_SHAKE_INTENSITY);
    this.cameras.main.flash(HIT_FLASH_MS, 200, 60, 60);
    this.refreshHearts();
    if (this.hero.hp <= 0) this.endRun('lose');
  }

  /** One-shot pickup burst VFX (rare — not pooled; tween-then-destroy). */
  private spawnArmorBurst(): void {
    const burst = this.add
      .image(this.hero.x, this.hero.y - HERO_BODY_HEIGHT * 0.55, KEYS.vfx_armor_burst)
      .setDepth(Depth.aura);
    this.tweens.add({
      targets: burst,
      scale: { from: 0.5, to: 1.4 },
      alpha: { from: 1, to: 0 },
      duration: 380,
      ease: 'Quad.out',
      onComplete: () => burst.destroy(),
    });
  }

  // ── Termination ────────────────────────────────────────────────────────────────
  private endRun(result: 'win' | 'lose'): void {
    if (this.finished) return;
    this.finished = true;

    if (result === 'win') this.hero.victory();
    else this.hero.defeat();

    this.spawner.freeze();
    if (this.finishLine.active) this.finishLine.setVelocityX(0);

    const payload: FinishGameParams = {
      result,
      score: this.score,
      duration_s: Math.round(this.elapsedMs / 1000),
    };
    track('finish_game', payload);
    this.events.emit(GameEvents.runEnd, payload);

    // Let the win/lose pose read, then hand off with the EXACT placeholder payload.
    this.time.delayedCall(RESULTS_HANDOFF_DELAY_MS, () => {
      this.scene.start(SceneKey.Results, payload);
    });
  }

  private cleanup(): void {
    // Tweens/timers/display objects are scene-scoped and auto-destroyed; destroy the
    // pools explicitly so re-entering Game (play again) never leaks or double-fires.
    this.spawner.destroy();
    this.heartImages = [];
  }
}
