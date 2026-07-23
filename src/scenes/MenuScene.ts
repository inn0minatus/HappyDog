import Phaser from 'phaser';
import { SceneKey } from './keys';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/gameConfig';
import { KEYS } from '../config/assetManifest';
import { t } from '../i18n/strings';
import { createButton } from '../ui/Button';
import { AudioManager } from '../systems/AudioManager';

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
      onClick: () => this.scene.start(SceneKey.Game),
    });

    this.add
      .text(cx, 550, t('menu_hint'), {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '20px',
        color: '#3a444d',
      })
      .setOrigin(0.5);

    this.buildMuteToggle();
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
    });
  }

  private muteTexture(): string {
    return AudioManager.isMuted() ? KEYS.ui_btn_mute_off : KEYS.ui_btn_mute_on;
  }

  private muteLabel(): string {
    return AudioManager.isMuted() ? t('menu_sound_off') : t('menu_sound_on');
  }
}
