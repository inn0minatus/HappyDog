import Phaser from 'phaser';
import { SceneKey } from './keys';
import { GAME_WIDTH, GAME_HEIGHT } from '../config/gameConfig';
import { KEYS } from '../config/assetManifest';
import { t } from '../i18n/strings';
import { track, type FinishGameParams } from '../analytics/track';
import { createButton } from '../ui/Button';
import { ENV, buildBuyUrl, buyDestination } from '../config/env';

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

    // Promo chip + code.
    this.add.image(cx, 460, KEYS.ui_promo_chip);
    this.add
      .text(cx, 460, `${t('results_promo_label')} ${ENV.promoCode}`, {
        fontFamily: 'monospace',
        fontSize: '26px',
        fontStyle: 'bold',
        color: '#20272e',
      })
      .setOrigin(0.5);

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
      onClick: () => this.scene.start(SceneKey.Game),
    });

    // Tertiary: back to the menu — closes the Boot→…→Results→Menu loop.
    this.add
      .text(90, 44, `← ${t('results_menu')}`, {
        fontFamily: 'system-ui, sans-serif',
        fontSize: '22px',
        color: '#20272e',
      })
      .setOrigin(0, 0.5)
      .setInteractive({ useHandCursor: true })
      .on(Phaser.Input.Events.POINTER_UP, () => this.scene.start(SceneKey.Menu));
  }

  private onBuy(): void {
    track('click_buy', { destination: buyDestination(), promo_code: ENV.promoCode });
    window.open(buildBuyUrl(), '_blank', 'noopener');
  }
}
