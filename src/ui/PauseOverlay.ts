import Phaser from 'phaser';
import { KEYS } from '../config/assetManifest';
import { DEPTH, PAUSE, GAME_WIDTH, GAME_HEIGHT } from '../config/gameConfig';
import { t } from '../i18n/strings';
import { createButton } from './Button';
import { AudioManager } from '../systems/AudioManager';
import { playSfx, Sfx } from '../systems/audio';

export interface PauseOverlayCallbacks {
  onResume: () => void;
  onRestart: () => void;
  onMenu: () => void;
  /** Called after mute is toggled here, so the HUD can repaint its own icon. */
  onMuteChanged: () => void;
}

/**
 * PauseOverlay — the dim + centered `ui_pause_panel` shown while the run is
 * paused (spec §6.3): Resume / Restart / Main-menu, plus a mute toggle. The
 * backdrop is interactive so it swallows taps (with `topOnly` input this also
 * blocks the HUD controls beneath it). Fully torn down via `destroy()`.
 */
export class PauseOverlay {
  private readonly scene: Phaser.Scene;
  private readonly objects: Phaser.GameObjects.GameObject[] = [];
  private readonly muteBtn: Phaser.GameObjects.Image;
  private readonly muteLabel: Phaser.GameObjects.Text;
  private readonly onMuteChanged: () => void;

  constructor(scene: Phaser.Scene, cb: PauseOverlayCallbacks) {
    this.scene = scene;
    this.onMuteChanged = cb.onMuteChanged;
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;

    // Dim backdrop that also swallows taps to the frozen game beneath.
    const backdrop = scene.add
      .rectangle(cx, cy, GAME_WIDTH, GAME_HEIGHT, PAUSE.backdropColor, PAUSE.backdropAlpha)
      .setDepth(DEPTH.pauseBackdrop)
      .setInteractive();
    this.objects.push(backdrop);

    const panel = scene.add.image(cx, cy, KEYS.ui_pause_panel).setDepth(DEPTH.pausePanel);
    this.objects.push(panel);

    const title = scene.add
      .text(cx, cy + PAUSE.titleOffsetY, t('pause_title'), {
        fontFamily: 'system-ui, sans-serif',
        fontSize: PAUSE.titleFontSize,
        fontStyle: 'bold',
        color: PAUSE.titleColor,
      })
      .setOrigin(0.5)
      .setDepth(DEPTH.pauseContent);
    this.objects.push(title);

    this.objects.push(this.makeButton(cx, cy + PAUSE.resumeOffsetY, t('pause_resume'), cb.onResume));
    this.objects.push(this.makeButton(cx, cy + PAUSE.restartOffsetY, t('pause_restart'), cb.onRestart));
    this.objects.push(this.makeButton(cx, cy + PAUSE.menuOffsetY, t('pause_menu'), cb.onMenu));

    // Mute toggle (mirrors the HUD control; shares the persisted state).
    this.muteBtn = scene.add
      .image(cx + PAUSE.muteOffsetX, cy + PAUSE.muteOffsetY, this.muteTexture())
      .setDepth(DEPTH.pauseContent)
      .setInteractive({ useHandCursor: true });
    this.muteBtn.on(Phaser.Input.Events.POINTER_UP, this.onMuteTap, this);
    this.objects.push(this.muteBtn);

    this.muteLabel = scene.add
      .text(cx + PAUSE.muteOffsetX, cy + PAUSE.muteOffsetY + PAUSE.muteLabelOffsetY, this.muteLabelText(), {
        fontFamily: 'system-ui, sans-serif',
        fontSize: PAUSE.muteLabelFontSize,
        color: PAUSE.muteLabelColor,
      })
      .setOrigin(0.5, 0)
      .setDepth(DEPTH.pauseContent);
    this.objects.push(this.muteLabel);

    // Quick fade-in (created AFTER the scene paused its tweens, so it still runs).
    scene.tweens.add({
      targets: this.objects,
      alpha: { from: 0, to: 1 },
      duration: PAUSE.fadeInMs,
      ease: 'Quad.out',
    });
  }

  destroy(): void {
    for (const obj of this.objects) obj.destroy();
    this.objects.length = 0;
  }

  private makeButton(x: number, y: number, label: string, onClick: () => void): Phaser.GameObjects.Container {
    return createButton(this.scene, {
      x,
      y,
      label,
      width: PAUSE.buttonWidth,
      height: PAUSE.buttonHeight,
      onClick: () => {
        playSfx(this.scene, Sfx.ui);
        onClick();
      },
    }).setDepth(DEPTH.pauseContent);
  }

  private onMuteTap(): void {
    AudioManager.toggle(this.scene.sound);
    this.muteBtn.setTexture(this.muteTexture());
    this.muteLabel.setText(this.muteLabelText());
    playSfx(this.scene, Sfx.ui);
    this.onMuteChanged();
  }

  private muteTexture(): string {
    return AudioManager.isMuted() ? KEYS.ui_btn_mute_off : KEYS.ui_btn_mute_on;
  }

  private muteLabelText(): string {
    return AudioManager.isMuted() ? t('menu_sound_off') : t('menu_sound_on');
  }
}
