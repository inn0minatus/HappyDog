import Phaser from 'phaser';
import { SceneKey } from './keys';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/gameConfig';
import { KEYS } from '../config/assetManifest';
import { t } from '../i18n/strings';
import { createButton } from '../ui/Button';
import { AudioManager } from '../systems/AudioManager';
import { ENV } from '../config/env';
import { playSfx, playMusic, Sfx, Music } from '../systems/audio';
import { PROMO_COPY_FADE_MS } from '../config/gameConfig';

/**
 * MenuScene — title, Play (→ Game), and a persisted mute toggle. Fires no
 * analytics (start_game fires when the run actually begins, in GameScene).
 */
export class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: SceneKey.Menu });
  }

  create(): void {
    const cx = GAME_WIDTH / 2;

    // Drive the browser tab title from i18n (single localized source for the
    // game name). The on-canvas title is the `ui_title_logo` asset — we do NOT
    // draw `menu_title` over the logo (that would overlap the placeholder).
    document.title = t('menu_title');

    this.add.image(cx, GAME_HEIGHT / 2, KEYS.screen_bg_menu);
    this.add.image(cx, 180, KEYS.ui_title_logo);

    this.add
      .text(cx, 330, t('menu_subtitle'), {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '24px',
        color: '#3a444d',
      })
      .setOrigin(0.5);

    createButton(this, {
      x: cx,
      y: 450,
      texture: KEYS.ui_btn_play,
      label: t('menu_play'),
      onClick: () => {
        playSfx(this, Sfx.ui);
        this.scene.start(SceneKey.Game);
      },
    });

    this.add
      .text(cx, 550, t('menu_hint'), {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '20px',
        color: '#3a444d',
      })
      .setOrigin(0.5);

    // Promo teaser chip — the same code the results CTA rewards (spec §6.4) (tap-to-copy).
    this.buildPromoCopyChip(cx, 648);

    this.buildMuteToggle();

    // Menu loop music. Honors the persisted mute (global sound.mute) and the iOS
    // unlock installed in BootScene; on first load it plays once the user taps.
    playMusic(this, Music.menu);
  }

  private buildMuteToggle(): void {
    const muteBtn = this.add
      .image(GAME_WIDTH - 52, 52, this.muteTexture())
      .setInteractive({ useHandCursor: true });

    const label = this.add
      .text(GAME_WIDTH - 52, 90, this.muteLabel(), {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '14px',
        color: '#9fb0bd',
      })
      .setOrigin(0.5, 0);

    muteBtn.on(Phaser.Input.Events.POINTER_UP, () => {
      AudioManager.toggle(this.sound);
      muteBtn.setTexture(this.muteTexture());
      label.setText(this.muteLabel());
      playSfx(this, Sfx.ui);
    });
  }

  private muteTexture(): string {
    return AudioManager.isMuted() ? KEYS.ui_btn_mute_off : KEYS.ui_btn_mute_on;
  }

  private muteLabel(): string {
    return AudioManager.isMuted() ? t('menu_sound_off') : t('menu_sound_on');
  }

  private buildPromoCopyChip(x: number, y: number): void {
    const container = this.add.container(x, y);
    const chip = this.add.image(0, 0, KEYS.ui_promo_chip).setOrigin(0.5);
    const text = this.add
      .text(0, 0, `${t('results_promo_label')} ${ENV.promoCode}`, {
        fontFamily: 'monospace',
        fontSize: '24px',
        fontStyle: 'bold',
        color: '#20272e',
      })
      .setOrigin(0.5);
    container.add([chip, text]);
    container.setSize(400, 100);
    container.setInteractive(
      new Phaser.Geom.Rectangle(-200, -50, 400, 100),
      Phaser.Geom.Rectangle.Contains,
    );
    if (container.input) container.input.cursor = 'pointer';
    container.on(Phaser.Input.Events.POINTER_UP, () => this.copyPromoCode());
  }

  private async copyPromoCode(): Promise<void> {
    try {
      if (!navigator.clipboard) {
        return; // feature unavailable, silent no-op
      }
      await navigator.clipboard.writeText(ENV.promoCode);
      playSfx(this, Sfx.ui);
      this.showCopyConfirmation();
    } catch {
      // copy failed (e.g., no permission), silent no-op
      return;
    }
  }

  private showCopyConfirmation(): void {
    const cx = GAME_WIDTH / 2;
    const label = this.add
      .text(cx, 705, t('results_promo_copied'), {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '14px',
        fontStyle: 'bold',
        color: '#6cc04a',
      })
      .setOrigin(0.5)
      .setAlpha(1);
    this.tweens.add({
      targets: label,
      alpha: 0,
      duration: PROMO_COPY_FADE_MS,
      ease: 'Quad.in',
      onComplete: () => label.destroy(),
    });
  }
}
