/** Canonical scene keys — the ONLY place scene name strings are defined. */
export const SceneKey = {
  Boot: 'Boot',
  Preload: 'Preload',
  Menu: 'Menu',
  Game: 'Game',
  Results: 'Results',
} as const;

export type SceneKey = (typeof SceneKey)[keyof typeof SceneKey];
