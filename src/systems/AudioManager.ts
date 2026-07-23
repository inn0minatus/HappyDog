import Phaser from 'phaser';
import { MUTE_STORAGE_KEY } from '../config/gameConfig';

/**
 * AudioManager — mute state + persistence (spec §6.3) and the iOS audio-unlock
 * hook (spec §10.2). No audio assets are loaded in Phase 1; this manages the
 * game's sound manager (`scene.sound`) so mute is honoured the moment SFX/music
 * land in a later phase. Mute is a single persisted flag shared across scenes.
 */

function readStoredMute(): boolean {
  try {
    return localStorage.getItem(MUTE_STORAGE_KEY) === '1';
  } catch {
    return false; // private mode / storage disabled
  }
}

function persistMute(value: boolean): void {
  try {
    localStorage.setItem(MUTE_STORAGE_KEY, value ? '1' : '0');
  } catch {
    /* ignore — non-persistent session is acceptable */
  }
}

let muted = readStoredMute();
let unlockInstalled = false;

export const AudioManager = {
  isMuted(): boolean {
    return muted;
  },

  /** Push the persisted mute state onto a game's sound manager. */
  apply(sound: Phaser.Sound.BaseSoundManager): void {
    sound.mute = muted;
  },

  /** Toggle mute, persist, and apply. Returns the new muted state. */
  toggle(sound: Phaser.Sound.BaseSoundManager): boolean {
    muted = !muted;
    sound.mute = muted;
    persistMute(muted);
    return muted;
  },

  /**
   * iOS Safari / autoplay audio-unlock. WebAudio is suspended until a real user
   * gesture, so resume the context on the first one.
   *
   * This MUST NOT bind to a scene's InputPlugin: PreloadScene's input shuts down
   * the instant it hands off to Menu (InputPlugin.shutdown removes the listener),
   * so the gesture would never be seen. Instead attach a single LONG-LIVED
   * window listener (survives every scene transition) that resumes once, then
   * removes itself. Idempotent — safe to call before any audio assets exist.
   * TODO(phase-5): verify on real iOS Safari, and confirm a muted player who
   * taps Play stays muted through the unlock.
   */
  installAudioUnlock(sound: Phaser.Sound.BaseSoundManager): void {
    if (unlockInstalled) return;
    unlockInstalled = true;

    const resume = (): void => {
      if (
        sound instanceof Phaser.Sound.WebAudioSoundManager &&
        sound.context.state === 'suspended'
      ) {
        void sound.context.resume();
      }
      window.removeEventListener('pointerdown', resume);
      window.removeEventListener('touchend', resume);
    };

    // Either gesture unlocks; whichever fires first tears both down.
    window.addEventListener('pointerdown', resume);
    window.addEventListener('touchend', resume);
  },
};
