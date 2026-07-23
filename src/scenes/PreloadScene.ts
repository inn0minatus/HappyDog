import Phaser from 'phaser';
import { SceneKey } from './keys';
import { ASSET_MANIFEST } from '../config/assetManifest';
import { t } from '../i18n/strings';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/gameConfig';

/**
 * PreloadScene — loads EVERY asset from the shared manifest (as SVGs at their
 * logical sizes) behind a loading bar, then advances to the menu. Nothing
 * critical is lazy-loaded (spec §10.5). (Audio unlock is installed once in
 * BootScene on a long-lived window listener, not here.)
 */
export class PreloadScene extends Phaser.Scene {
  constructor() {
    super({ key: SceneKey.Preload });
  }

  preload(): void {
    this.buildLoadingBar();

    // Fail LOUD if any manifest key is missing on disk (e.g. a new key added to
    // assetManifest.ts without regenerating placeholders → a silent 404). This
    // is a real error path, not log spam.
    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) => {
      console.error(`[assets] failed to load "${file.key}" from ${file.src} — is the SVG present?`);
    });

    // The manifest is the single source of truth: iterate & load each SVG.
    for (const a of ASSET_MANIFEST) {
      this.load.svg(a.key, a.path, { width: a.width, height: a.height });
    }
  }

  create(): void {
    this.scene.start(SceneKey.Menu);
  }

  private buildLoadingBar(): void {
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    const barW = 520;
    const barH = 26;

    this.add
      .text(cx, cy - 48, t('loading'), {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '22px',
        color: '#f4f7fa',
      })
      .setOrigin(0.5);

    const frame = this.add.graphics();
    frame.lineStyle(2, 0x5b6670, 1);
    frame.strokeRect(cx - barW / 2, cy - barH / 2, barW, barH);

    const fill = this.add.graphics();
    const pct = this.add
      .text(cx, cy + 40, '0%', {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '16px',
        color: '#9fb0bd',
      })
      .setOrigin(0.5);

    this.load.on(Phaser.Loader.Events.PROGRESS, (value: number) => {
      fill.clear();
      fill.fillStyle(0x6cc04a, 1);
      fill.fillRect(cx - barW / 2 + 3, cy - barH / 2 + 3, (barW - 6) * value, barH - 6);
      pct.setText(`${Math.round(value * 100)}%`);
    });
  }
}
