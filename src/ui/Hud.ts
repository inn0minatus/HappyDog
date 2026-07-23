import Phaser from 'phaser';
import { KEYS } from '../config/assetManifest';
import { DEPTH, HUD, GAME_WIDTH, MAX_HP } from '../config/gameConfig';
import { t } from '../i18n/strings';
import { GameEvents, type ArmorState } from '../scenes/gameEvents';
import { AudioManager } from '../systems/AudioManager';
import { playSfx, Sfx } from '../systems/audio';

export interface HudOptions {
  /** Invoked when the pause button is tapped. */
  onPause: () => void;
}

export interface HudSnapshot {
  hp: number;
  score: number;
  progress: number;
}

/**
 * Hud — the persistent in-run overlay (spec §6.2). It is purely a VIEW: it never
 * reaches into the run loop, only SUBSCRIBES to the events GameScene emits on
 * `scene.events` and re-paints. Hearts (shape+fill), score, a level-progress bar
 * (dynamic fill drawn through the frame's transparent window), plus pause + mute
 * controls and a small armor tell. Resets on `run:start`, freezes on `run:end`,
 * and removes every listener on scene shutdown (no leaks across replays).
 */
export class Hud {
  private readonly scene: Phaser.Scene;
  private readonly opts: HudOptions;

  private readonly hearts: Phaser.GameObjects.Image[] = [];
  private readonly scoreText: Phaser.GameObjects.Text;
  private readonly progressFill: Phaser.GameObjects.Rectangle;
  private readonly pauseBtn: Phaser.GameObjects.Image;
  private readonly muteBtn: Phaser.GameObjects.Image;
  private readonly armorIcon: Phaser.GameObjects.Image;

  private armorTween: Phaser.Tweens.Tween | undefined;
  private readonly progressUsableWidth: number;
  private frozen = false;

  constructor(scene: Phaser.Scene, opts: HudOptions, initial?: HudSnapshot) {
    this.scene = scene;
    this.opts = opts;
    this.progressUsableWidth = HUD.progressBarWidth - HUD.progressFillInsetX * 2;

    // ── Progress bar: frame asset + a dynamic fill drawn on top ──
    scene.add.image(GAME_WIDTH / 2, HUD.progressBarY, KEYS.ui_progress_bar).setDepth(DEPTH.hud);
    const fillLeft = GAME_WIDTH / 2 - this.progressUsableWidth / 2;
    this.progressFill = scene.add
      .rectangle(fillLeft, HUD.progressBarY, this.progressUsableWidth, HUD.progressFillHeight, HUD.progressFillColor)
      .setOrigin(0, 0.5)
      .setDepth(DEPTH.hud);
    this.progressFill.scaleX = 0;

    // ── Score row ──
    scene.add.image(HUD.scoreIconX, HUD.scoreRowY, KEYS.ui_score_icon).setDepth(DEPTH.hud);
    this.scoreText = scene.add
      .text(HUD.scoreTextX, HUD.scoreRowY, this.scoreLabel(0), {
        fontFamily: 'system-ui, sans-serif',
        fontSize: HUD.scoreFontSize,
        fontStyle: 'bold',
        color: HUD.scoreColor,
        stroke: HUD.scoreStrokeColor,
        strokeThickness: HUD.scoreStrokeThickness,
      })
      .setOrigin(0, 0.5)
      .setDepth(DEPTH.hud);

    // ── Hearts ──
    for (let i = 0; i < MAX_HP; i++) {
      this.hearts.push(
        scene.add.image(HUD.heartStartX + i * HUD.heartSpacing, HUD.heartY, KEYS.ui_heart_full).setDepth(DEPTH.hud),
      );
    }

    // ── Small armor tell (hidden until armored) ──
    this.armorIcon = scene.add
      .image(HUD.armorTellX, HUD.armorTellY, KEYS.armor_pickup)
      .setScale(HUD.armorTellScale)
      .setDepth(DEPTH.hud)
      .setVisible(false);

    // ── Controls (mute then pause, top-right) ──
    this.muteBtn = scene.add
      .image(HUD.muteBtnX, HUD.muteBtnY, this.muteTexture())
      .setDepth(DEPTH.hud)
      .setInteractive({ useHandCursor: true });
    this.muteBtn.on(Phaser.Input.Events.POINTER_UP, this.onMuteTap, this);

    this.pauseBtn = scene.add
      .image(HUD.pauseBtnX, HUD.pauseBtnY, KEYS.ui_btn_pause)
      .setDepth(DEPTH.hud)
      .setInteractive({ useHandCursor: true });
    this.pauseBtn.on(Phaser.Input.Events.POINTER_UP, this.onPauseTap, this);

    if (initial) {
      this.setHp(initial.hp);
      this.setScore(initial.score);
      this.setProgress(initial.progress);
    }

    // ── Subscriptions ──
    const ev = scene.events;
    ev.on(GameEvents.hp, this.onHp, this);
    ev.on(GameEvents.score, this.onScore, this);
    ev.on(GameEvents.progress, this.onProgress, this);
    ev.on(GameEvents.armor, this.onArmor, this);
    ev.on(GameEvents.runStart, this.onRunStart, this);
    ev.on(GameEvents.runEnd, this.onRunEnd, this);
    ev.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }

  /** Re-read the shared mute state and repaint the icon (e.g. after resume). */
  syncMute(): void {
    this.muteBtn.setTexture(this.muteTexture());
  }

  destroy(): void {
    const ev = this.scene.events;
    ev.off(GameEvents.hp, this.onHp, this);
    ev.off(GameEvents.score, this.onScore, this);
    ev.off(GameEvents.progress, this.onProgress, this);
    ev.off(GameEvents.armor, this.onArmor, this);
    ev.off(GameEvents.runStart, this.onRunStart, this);
    ev.off(GameEvents.runEnd, this.onRunEnd, this);
    ev.off(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
    this.stopArmorTell();
    // Display objects are scene-owned and auto-destroyed on shutdown.
  }

  // ── Event handlers ──────────────────────────────────────────────────────────
  private onHp(hp: number): void {
    if (this.frozen) return;
    this.setHp(hp);
  }

  private onScore(score: number): void {
    if (this.frozen) return;
    this.setScore(score);
  }

  private onProgress(progress: number): void {
    if (this.frozen) return;
    this.setProgress(progress);
  }

  private onArmor(state: ArmorState): void {
    if (this.frozen) return;
    if (state.active) this.startArmorTell();
    else this.stopArmorTell();
  }

  private onRunStart(): void {
    this.frozen = false;
    this.setHp(MAX_HP);
    this.setScore(0);
    this.setProgress(0);
    this.stopArmorTell();
    this.pauseBtn.setAlpha(1).setInteractive({ useHandCursor: true });
  }

  private onRunEnd(): void {
    // Freeze the HUD in its final state; pausing is meaningless once the run ends.
    this.frozen = true;
    this.stopArmorTell();
    this.pauseBtn.disableInteractive();
    this.pauseBtn.setAlpha(HUD.frozenBtnAlpha);
  }

  // ── Control taps ─────────────────────────────────────────────────────────────
  private onMuteTap(): void {
    AudioManager.toggle(this.scene.sound);
    this.syncMute();
    playSfx(this.scene, Sfx.ui);
  }

  private onPauseTap(): void {
    if (this.frozen) return;
    playSfx(this.scene, Sfx.ui);
    this.opts.onPause();
  }

  // ── Painters ─────────────────────────────────────────────────────────────────
  private setHp(hp: number): void {
    this.hearts.forEach((img, i) => {
      img.setTexture(i < hp ? KEYS.ui_heart_full : KEYS.ui_heart_empty);
    });
  }

  private setScore(score: number): void {
    this.scoreText.setText(this.scoreLabel(score));
  }

  private setProgress(progress: number): void {
    this.progressFill.scaleX = Phaser.Math.Clamp(progress, 0, 1);
  }

  private scoreLabel(score: number): string {
    return `${t('hud_score')}: ${score}`;
  }

  private muteTexture(): string {
    return AudioManager.isMuted() ? KEYS.ui_btn_mute_off : KEYS.ui_btn_mute_on;
  }

  private startArmorTell(): void {
    this.armorIcon.setVisible(true).setScale(HUD.armorTellScale);
    if (this.armorTween) return;
    this.armorTween = this.scene.tweens.add({
      targets: this.armorIcon,
      scale: { from: HUD.armorTellScale, to: HUD.armorTellPulseScale },
      duration: HUD.armorTellPulseMs,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
    });
  }

  private stopArmorTell(): void {
    this.armorTween?.stop();
    this.armorTween = undefined;
    this.armorIcon.setVisible(false).setScale(HUD.armorTellScale);
  }
}
