import Phaser from 'phaser';
import { SceneKey } from './keys';
import { AudioManager } from '../systems/AudioManager';

/**
 * BootScene — the first, minimal scene. Applies the persisted mute preference to
 * the sound manager, installs the long-lived audio-unlock gesture listener, and
 * hands straight off to PreloadScene. (Scale/physics are configured once in
 * main.ts; nothing to load for the boot screen itself.)
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: SceneKey.Boot });
  }

  create(): void {
    AudioManager.apply(this.sound);
    // Attach the first-gesture audio unlock on `window` (not scene.input) so it
    // survives the immediate hand-off to Preload/Menu and fires on the REAL tap.
    AudioManager.installAudioUnlock(this.sound);
    this.scene.start(SceneKey.Preload);
  }
}
