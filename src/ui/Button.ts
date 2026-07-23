import Phaser from 'phaser';

/**
 * createButton — a small reusable button factory used across scenes (Play, CTA,
 * Play-again, the Phase-1 debug finish buttons). Backed by an SVG texture when
 * one is given, otherwise a drawn rectangle (handy for temporary/debug buttons).
 * Returns an interactive Container with hover/press feedback.
 */
export interface ButtonOptions {
  x: number;
  y: number;
  onClick: () => void;
  /** Background texture key. If omitted, a rectangle is drawn instead. */
  texture?: string;
  /** Centered label text. */
  label?: string;
  /** Explicit hit size; defaults to the texture size, or 220×64 for the rect. */
  width?: number;
  height?: number;
  /** Overrides merged onto the default label text style. */
  labelStyle?: Phaser.Types.GameObjects.Text.TextStyle;
}

const DEFAULT_LABEL_STYLE: Phaser.Types.GameObjects.Text.TextStyle = {
  fontFamily: 'system-ui, sans-serif',
  fontSize: '26px',
  fontStyle: 'bold',
  color: '#f4f7fa',
};

export function createButton(scene: Phaser.Scene, opts: ButtonOptions): Phaser.GameObjects.Container {
  const container = scene.add.container(opts.x, opts.y);

  let width = opts.width ?? 0;
  let height = opts.height ?? 0;

  if (opts.texture) {
    const bg = scene.add.image(0, 0, opts.texture).setOrigin(0.5);
    width = width || bg.width;
    height = height || bg.height;
    container.add(bg);
  } else {
    width = width || 220;
    height = height || 64;
    const rect = scene.add
      .rectangle(0, 0, width, height, 0x2b3a46)
      .setStrokeStyle(2, 0x5b6670)
      .setOrigin(0.5);
    container.add(rect);
  }

  if (opts.label !== undefined) {
    const style: Phaser.Types.GameObjects.Text.TextStyle = { ...DEFAULT_LABEL_STYLE, ...opts.labelStyle };
    const text = scene.add.text(0, 0, opts.label, style).setOrigin(0.5);
    container.add(text);
  }

  container.setSize(width, height);
  container.setInteractive(
    new Phaser.Geom.Rectangle(-width / 2, -height / 2, width, height),
    Phaser.Geom.Rectangle.Contains,
  );
  if (container.input) {
    container.input.cursor = 'pointer';
  }

  container.on(Phaser.Input.Events.POINTER_OVER, () => container.setScale(1.04));
  container.on(Phaser.Input.Events.POINTER_OUT, () => container.setScale(1));
  container.on(Phaser.Input.Events.POINTER_DOWN, () => container.setScale(0.96));
  container.on(Phaser.Input.Events.POINTER_UP, () => {
    container.setScale(1.04);
    opts.onClick();
  });

  return container;
}
