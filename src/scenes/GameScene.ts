import Phaser from 'phaser';
import { SceneKey } from './keys';
import {
  GAME_WIDTH,
  GAME_HEIGHT,
  GROUND_TOP_Y,
  HERO_X,
  MAX_HP,
  SCORE_SURVIVAL_PER_S,
  TARGET_DURATION_S,
} from '../config/gameConfig';
import { KEYS } from '../config/assetManifest';
import { t } from '../i18n/strings';
import { track, type FinishGameParams } from '../analytics/track';
import { createButton } from '../ui/Button';
import { HeroDog } from '../entities/HeroDog';

/**
 * GameScene — Phase 1 PLACEHOLDER run screen. It renders the park backdrop, the
 * hero, and a HUD, fires `start_game` on entry, and exposes TEMPORARY debug
 * controls (on-screen Win/Lose buttons + W/L keys) that end the run, fire
 * `finish_game`, and hand a result to ResultsScene. No real gameplay/physics yet
 * — this exists purely to make the flow navigable end-to-end.
 */
export class GameScene extends Phaser.Scene {
  private hero!: HeroDog;
  private scoreText!: Phaser.GameObjects.Text;
  private progressFill!: Phaser.GameObjects.Rectangle;

  private elapsedMs = 0;
  private score = 0;
  private finished = false;

  constructor() {
    super({ key: SceneKey.Game });
  }

  create(): void {
    this.elapsedMs = 0;
    this.score = 0;
    this.finished = false;

    this.buildBackground();
    this.hero = new HeroDog(this, HERO_X, GROUND_TOP_Y);
    this.buildHud();
    // Jump zone BEFORE the debug buttons so the buttons sit on top (topOnly).
    this.buildJumpInput();
    this.buildDebugFinishControls();

    // A round has begun.
    track('start_game');

    // Keyboard jump (cosmetic hop only; real jump physics is Phase 2).
    const space = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    space?.on('down', () => this.hero.nudgeJump());

    // Per-frame accumulator for active-play time (spec §7.2). Wired via the
    // scene UPDATE event so a later phase can freeze it during pause cleanly.
    this.events.on(Phaser.Scenes.Events.UPDATE, this.onUpdate, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.events.off(Phaser.Scenes.Events.UPDATE, this.onUpdate, this);
    });
  }

  private buildBackground(): void {
    const cx = GAME_WIDTH / 2;
    this.add.image(cx, GAME_HEIGHT / 2, KEYS.park_bg_far);
    this.add.image(cx, GROUND_TOP_Y, KEYS.park_bg_near).setOrigin(0.5, 1);
    this.add
      .tileSprite(cx, GROUND_TOP_Y, GAME_WIDTH, GAME_HEIGHT - GROUND_TOP_Y, KEYS.ground_tile)
      .setOrigin(0.5, 0);
    this.add.image(cx, GAME_HEIGHT, KEYS.park_fg_grass).setOrigin(0.5, 1);
  }

  private buildHud(): void {
    // Level-progress bar: the FRAME is the `ui_progress_bar` asset (1180×14),
    // drawn FIRST; the dynamic fill rectangle is drawn ON TOP, inset within the
    // track bounds, so it's visible and animates as progress advances. Phase 2
    // swaps the SVG art against the same key/size — a transparent-window frame
    // still reads correctly with the fill sitting inside it. Fill logic unchanged.
    const barY = 16;
    const barW = 1180; // == ui_progress_bar asset width (see assetManifest)
    const barLeft = GAME_WIDTH / 2 - barW / 2;
    this.add.image(GAME_WIDTH / 2, barY, KEYS.ui_progress_bar); // frame (below)
    this.progressFill = this.add
      .rectangle(barLeft + 2, barY, barW - 4, 8, 0x6cc04a)
      .setOrigin(0, 0.5); // fill on top, inset within the track
    this.progressFill.scaleX = 0;

    // Score row (top-left): the `ui_score_icon` asset next to the live score.
    const rowY = 58;
    this.add.image(38, rowY, KEYS.ui_score_icon);
    this.scoreText = this.add
      .text(68, rowY, `${t('hud_score')}: 0`, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '26px',
        fontStyle: 'bold',
        color: '#20272e',
      })
      .setOrigin(0, 0.5);

    // Hearts (below the score row) — Phase 1 shows all full.
    for (let i = 0; i < MAX_HP; i++) {
      this.add.image(42 + i * 44, 100, KEYS.ui_heart_full);
    }
  }

  /**
   * Jump input. Bound to a full-screen interactive Zone created BEFORE the debug
   * buttons, so with `input.topOnly` (Phaser default) a tap on a Win/Lose button
   * hits the button only — never also the jump. Real jump physics is Phase 2.
   */
  private buildJumpInput(): void {
    const jumpZone = this.add
      .zone(0, 0, GAME_WIDTH, GAME_HEIGHT)
      .setOrigin(0, 0)
      .setInteractive();
    jumpZone.on(Phaser.Input.Events.POINTER_DOWN, () => this.hero.nudgeJump());
  }

  private buildDebugFinishControls(): void {
    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 98, t('game_debug_hint'), {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '16px',
        color: '#20272e',
      })
      .setOrigin(0.5);

    createButton(this, {
      x: GAME_WIDTH / 2 - 135,
      y: GAME_HEIGHT - 50,
      width: 240,
      height: 56,
      label: t('game_debug_win'),
      onClick: () => this.finishRun('win'),
    });
    createButton(this, {
      x: GAME_WIDTH / 2 + 135,
      y: GAME_HEIGHT - 50,
      width: 240,
      height: 56,
      label: t('game_debug_lose'),
      onClick: () => this.finishRun('lose'),
    });

    const kb = this.input.keyboard;
    kb?.addKey(Phaser.Input.Keyboard.KeyCodes.W).on('down', () => this.finishRun('win'));
    kb?.addKey(Phaser.Input.Keyboard.KeyCodes.L).on('down', () => this.finishRun('lose'));
  }

  private onUpdate(_time: number, delta: number): void {
    if (this.finished) return;

    this.elapsedMs += delta;
    const seconds = this.elapsedMs / 1000;

    this.score = Math.floor(seconds * SCORE_SURVIVAL_PER_S);
    this.scoreText.setText(`${t('hud_score')}: ${this.score}`);

    const progress = Phaser.Math.Clamp(seconds / TARGET_DURATION_S.nominal, 0, 1);
    this.progressFill.scaleX = progress;
  }

  private finishRun(result: 'win' | 'lose'): void {
    if (this.finished) return;
    this.finished = true;

    const payload: FinishGameParams = {
      result,
      score: this.score,
      duration_s: Math.round(this.elapsedMs / 1000),
    };
    track('finish_game', payload);
    this.scene.start(SceneKey.Results, payload);
  }
}
