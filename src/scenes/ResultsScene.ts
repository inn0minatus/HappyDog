import Phaser from 'phaser';
import { SceneKey } from './keys';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/gameConfig';
import { KEYS } from '../config/assetManifest';
import { t } from '../i18n/strings';
import { track, type FinishGameParams } from '../analytics/track';
import { createButton } from '../ui/Button';
import { ENV, buildBuyUrl, buyDestination } from '../config/env';
import { playSfx, Sfx, stopMusic } from '../systems/audio';
import { PROMO_COPY_FADE_MS } from '../config/gameConfig';

/**
 * ResultsScene — Victory or Game Over depending on the `result` param, the final
 * score, the promo-code chip, the buy CTA (fires `click_buy` then opens the
 * UTM-tagged buy URL in a new tab), and Play-again (→ a fresh run).
 */
export class ResultsScene extends Phaser.Scene {
  constructor() {
    super({ key: SceneKey.Results });
  }

  create(data: Partial<FinishGameParams> = {}): void {
    // Robust if entered without/with partial data (e.g. deep-link, hot reload):
    // default to a Game-Over result and a zero score.
    const win = data.result === 'win';
    const score = typeof data.score === 'number' ? data.score : 0;
    const cx = GAME_WIDTH / 2;

    // The gameplay loop already stops its music on run-end; this is a defensive
    // stop for any entry path (deep-link / hot reload) so Results is silent.
    stopMusic();

    this.add.image(cx, GAME_HEIGHT / 2, win ? KEYS.screen_bg_victory : KEYS.screen_bg_gameover);
    this.add.image(cx, 250, win ? KEYS.dog_victory : KEYS.dog_defeat);

    this.add
      .text(cx, 90, win ? t('results_victory_title') : t('results_gameover_title'), {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '48px',
        fontStyle: 'bold',
        color: '#20272e',
      })
      .setOrigin(0.5);

    this.add
      .text(cx, 380, t('results_score', { score }), {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '30px',
        color: '#20272e',
      })
      .setOrigin(0.5);

    // Promo chip + code (tap-to-copy).
    this.buildPromoCopyChip(cx, 460);

    // The conversion CTA.
    createButton(this, {
      x: cx,
      y: 565,
      texture: KEYS.ui_btn_cta,
      label: t('results_cta'),
      onClick: () => this.onBuy(),
    });

    // Secondary: play again → fresh run (a new start_game fires in GameScene).
    createButton(this, {
      x: cx,
      y: 660,
      texture: KEYS.ui_btn_play_again,
      label: t('results_play_again'),
      onClick: () => {
        playSfx(this, Sfx.ui);
        this.scene.start(SceneKey.Game);
      },
    });

    // Tertiary: back to the menu — closes the Boot→…→Results→Menu loop. The
    // vertical padding grows the tap target to ~48px tall for touch a11y (§10.4).
    this.add
      .text(90, 44, `← ${t('results_menu')}`, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '22px',
        color: '#20272e',
        padding: { y: 12 },
      })
      .setOrigin(0, 0.5)
      .setInteractive({ useHandCursor: true })
      .on(Phaser.Input.Events.POINTER_UP, () => {
        playSfx(this, Sfx.ui);
        this.scene.start(SceneKey.Menu);
      });
  }

  private buildPromoCopyChip(x: number, y: number): void {
    const container = this.add.container(x, y);
    const chip = this.add.image(0, 0, KEYS.ui_promo_chip).setOrigin(0.5);
    const text = this.add
      .text(0, 0, `${t('results_promo_label')} ${ENV.promoCode}`, {
        fontFamily: 'monospace',
        fontSize: '26px',
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
      .text(cx, 410, t('results_promo_copied'), {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '16px',
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

  private onBuy(): void {
    playSfx(this, Sfx.ui);
    track('click_buy', { destination: buyDestination(), promo_code: ENV.promoCode });
    window.open(buildBuyUrl(), '_blank', 'noopener');
  }
}
