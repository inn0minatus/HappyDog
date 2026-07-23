import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, BACKGROUND_COLOR } from './config/gameConfig';
import { BootScene } from './scenes/BootScene';
import { PreloadScene } from './scenes/PreloadScene';
import { MenuScene } from './scenes/MenuScene';
import { GameScene } from './scenes/GameScene';
import { ResultsScene } from './scenes/ResultsScene';
import { initAnalytics } from './analytics/track';
import { installOrientationGuard } from './ui/OrientationOverlay';

// One-time page bootstrap: env-gated analytics loader (safe no-op without
// VITE_* ids) and the DOM orientation guard, both independent of Phaser.
initAnalytics();
installOrientationGuard();

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  width: GAME_WIDTH, // fixed logical resolution 1280×720 (landscape 16:9)
  height: GAME_HEIGHT,
  backgroundColor: BACKGROUND_COLOR,
  scale: {
    mode: Phaser.Scale.FIT, // scale the logical canvas to fit any viewport…
    autoCenter: Phaser.Scale.CENTER_BOTH, // …and center it (letterbox on portrait)
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 }, // per-body gravity is set by entities in Phase 2
      debug: false,
    },
  },
  render: { antialias: true },
  // Scene order = boot flow: Boot → Preload → Menu → Game → Results.
  scene: [BootScene, PreloadScene, MenuScene, GameScene, ResultsScene],
};

new Phaser.Game(config);
