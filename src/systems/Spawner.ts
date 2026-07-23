import Phaser from 'phaser';
import { Tick } from '../entities/Tick';
import { Bush, Puddle } from '../entities/Obstacle';
import { Tablet } from '../entities/Tablet';
import { ArmorPickup } from '../entities/ArmorPickup';
import { RunnerEntity } from '../entities/RunnerEntity';
import { DifficultyCurve } from './DifficultyCurve';
import {
  LEVEL_LENGTH,
  HAZARD_SPACING_START,
  TABLET_SPACING_START,
  ARMOR_SPAWNS_PER_LEVEL,
  POOL_SIZE_HAZARD,
  POOL_SIZE_TABLET,
  POOL_SIZE_ARMOR,
  COLLECTIBLE_HOVER_PX,
  COLLECTIBLE_HOVER_JITTER_PX,
  HAZARD_WEIGHT_TICK,
  HAZARD_WEIGHT_BUSH,
  HAZARD_WEIGHT_PUDDLE,
} from '../config/gameConfig';

interface HazardChoice {
  readonly group: Phaser.Physics.Arcade.Group;
  readonly weight: number;
}

/**
 * Spawner — difficulty-curve-driven spawning from OBJECT POOLS (spec §3.8, §10.1).
 *
 * Every scrolling entity lives in a `Phaser.Physics.Arcade.Group` sized above the
 * worst-case on-screen count, so `update()` never allocates — it reuses dead
 * instances via `group.get()` and returns them with `recycle()`. No per-spawn GC.
 *
 * Spawning is DISTANCE-scheduled: because entities move left at exactly the world
 * speed and the distance metric advances at the same rate, scheduling a spawn every
 * `S` world-units yields a clean `S` px on-screen gap regardless of the speed ramp.
 * That keeps hazard spacing FAIR and jump-clearable (§3.2) — hazards sit on the
 * ground; tablets/armor hover so the same jump both clears a hazard and collects.
 */
export class Spawner {
  readonly tickPool: Phaser.Physics.Arcade.Group;
  readonly bushPool: Phaser.Physics.Arcade.Group;
  readonly puddlePool: Phaser.Physics.Arcade.Group;
  readonly tabletPool: Phaser.Physics.Arcade.Group;
  readonly armorPool: Phaser.Physics.Arcade.Group;

  private readonly allPools: Phaser.Physics.Arcade.Group[];
  private readonly hazardTable: HazardChoice[];
  private readonly hazardWeightTotal: number;

  private nextHazardDistance = HAZARD_SPACING_START;
  private nextTabletDistance = TABLET_SPACING_START;
  private readonly armorQueue: number[] = [];
  private spawningEnabled = true;

  constructor(
    scene: Phaser.Scene,
    private readonly curve: DifficultyCurve,
    private readonly groundY: number,
    private readonly spawnX: number,
    private readonly recycleX: number,
  ) {
    const mk = (classType: Function, maxSize: number): Phaser.Physics.Arcade.Group =>
      scene.physics.add.group({ classType, maxSize, runChildUpdate: false });

    this.tickPool = mk(Tick, POOL_SIZE_HAZARD);
    this.bushPool = mk(Bush, POOL_SIZE_HAZARD);
    this.puddlePool = mk(Puddle, POOL_SIZE_HAZARD);
    this.tabletPool = mk(Tablet, POOL_SIZE_TABLET);
    this.armorPool = mk(ArmorPickup, POOL_SIZE_ARMOR);

    this.allPools = [this.tickPool, this.bushPool, this.puddlePool, this.tabletPool, this.armorPool];

    this.hazardTable = [
      { group: this.tickPool, weight: HAZARD_WEIGHT_TICK },
      { group: this.bushPool, weight: HAZARD_WEIGHT_BUSH },
      { group: this.puddlePool, weight: HAZARD_WEIGHT_PUDDLE },
    ];
    this.hazardWeightTotal = this.hazardTable.reduce((s, h) => s + h.weight, 0);

    this.buildArmorSchedule();
  }

  /** Pools whose contact costs the hero HP (tick behaves specially under armor). */
  get obstaclePools(): Phaser.Physics.Arcade.Group[] {
    return [this.bushPool, this.puddlePool];
  }

  /**
   * Advance the run one frame: schedule new spawns from the curve, then scroll and
   * recycle every active entity. `distance` is world units travelled so far.
   */
  update(distance: number, worldSpeed: number, progress: number): void {
    if (this.spawningEnabled) {
      while (distance >= this.nextHazardDistance) {
        this.spawnHazard();
        this.nextHazardDistance += this.curve.hazardSpacing(progress);
      }
      while (distance >= this.nextTabletDistance) {
        this.spawnTablet();
        this.nextTabletDistance += this.curve.tabletSpacing(progress);
      }
      while (this.armorQueue.length > 0 && distance >= this.armorQueue[0]!) {
        this.armorQueue.shift();
        this.spawnArmor();
      }
    }

    this.scrollAndRecycle(worldSpeed);
  }

  /** Stop scheduling NEW spawns (called once the finish line is queued, §3.9). */
  stopSpawning(): void {
    this.spawningEnabled = false;
  }

  /** Freeze every live entity in place (zero horizontal velocity) — used on run end. */
  freeze(): void {
    for (const pool of this.allPools) {
      for (const child of pool.getChildren()) {
        const e = child as RunnerEntity;
        if (e.active) e.setVelocityX(0);
      }
    }
  }

  /** Recycle everything currently live (e.g. on a clean restart). */
  recycleAll(): void {
    for (const pool of this.allPools) {
      for (const child of pool.getChildren()) {
        (child as RunnerEntity).recycle();
      }
    }
  }

  destroy(): void {
    for (const pool of this.allPools) pool.destroy(true);
  }

  // ── Spawning ─────────────────────────────────────────────────────────────────
  private spawnHazard(): void {
    const pool = this.pickHazardPool();
    const entity = pool.get(this.spawnX, this.groundY) as RunnerEntity | null;
    if (!entity) return; // pool exhausted — skip (sized so this shouldn't happen)
    entity.spawn(this.spawnX, this.groundY); // ground entities: feet on the ground line
  }

  private spawnTablet(): void {
    const y = this.hoverY();
    const entity = this.tabletPool.get(this.spawnX, y) as RunnerEntity | null;
    if (!entity) return;
    entity.spawn(this.spawnX, y);
  }

  private spawnArmor(): void {
    const y = this.hoverY();
    const entity = this.armorPool.get(this.spawnX, y) as RunnerEntity | null;
    if (!entity) return;
    entity.spawn(this.spawnX, y);
  }

  /** A hover height above the ground that always requires a jump to reach. */
  private hoverY(): number {
    return this.groundY - COLLECTIBLE_HOVER_PX - Phaser.Math.Between(0, COLLECTIBLE_HOVER_JITTER_PX);
  }

  private pickHazardPool(): Phaser.Physics.Arcade.Group {
    const roll = Phaser.Math.Between(1, this.hazardWeightTotal);
    let acc = 0;
    for (const h of this.hazardTable) {
      acc += h.weight;
      if (roll <= acc) return h.group;
    }
    return this.tickPool; // unreachable; satisfies the type checker
  }

  private buildArmorSchedule(): void {
    const n: number = ARMOR_SPAWNS_PER_LEVEL; // widen from the literal type for the i/(n-1) math
    for (let i = 0; i < n; i++) {
      const frac = n === 1 ? 0.5 : Phaser.Math.Linear(0.25, 0.85, i / (n - 1));
      this.armorQueue.push(frac * LEVEL_LENGTH);
    }
  }

  // ── Motion / recycling ───────────────────────────────────────────────────────
  private scrollAndRecycle(worldSpeed: number): void {
    for (const pool of this.allPools) {
      for (const child of pool.getChildren()) {
        const e = child as RunnerEntity;
        if (!e.active) continue;
        e.setVelocityX(-worldSpeed);
        if (e.isOffscreenLeft(this.recycleX)) e.recycle();
      }
    }
  }
}
