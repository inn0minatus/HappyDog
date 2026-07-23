/**
 * gameEvents.ts — the event contract GameScene emits on `scene.events` for the
 * HUD / audio layer to subscribe to (spec §8 integration seam). Kept in its own
 * module so both the emitter (GameScene) and subscribers (Hud) import it without
 * a circular dependency. Payloads are primitives / small plain objects.
 */
export const GameEvents = {
  hp: 'hud:hp', // (hp: number)
  score: 'hud:score', // (score: number)
  progress: 'hud:progress', // (progress: number 0..1)
  armor: 'hud:armor', // (state: ArmorState)
  runStart: 'run:start', // ()
  runEnd: 'run:end', // (payload: FinishGameParams)
} as const;

/** Payload of the `hud:armor` event. */
export interface ArmorState {
  active: boolean;
  remainingMs: number;
}
