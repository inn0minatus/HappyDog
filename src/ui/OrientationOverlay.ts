import { t } from '../i18n/strings';

/**
 * Orientation guard STUB (Phase 1). A DOM overlay above the canvas that shows a
 * centered "rotate to landscape" hint while the viewport is portrait and hides
 * in landscape. Minimal inline styling — Phase 2 may brand/restyle it. It lives
 * in the DOM (not a Phaser scene) so it works across every scene at once.
 */
export function installOrientationGuard(): void {
  if (document.getElementById('orientation-guard')) return;

  const overlay = document.createElement('div');
  overlay.id = 'orientation-guard';
  overlay.setAttribute('role', 'alertdialog');
  overlay.setAttribute('aria-live', 'polite');

  const inner = document.createElement('div');
  const title = document.createElement('div');
  title.textContent = t('rotate_title');
  const body = document.createElement('div');
  body.textContent = t('rotate_body');
  inner.append(title, body);
  overlay.append(inner);

  Object.assign(overlay.style, {
    position: 'fixed',
    top: '0',
    left: '0',
    width: '100%',
    height: '100%',
    display: 'none',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(15, 20, 24, 0.92)',
    color: '#f4f7fa',
    zIndex: '9999',
    textAlign: 'center',
    fontFamily: 'system-ui, sans-serif',
    padding: '24px',
    boxSizing: 'border-box',
  });
  Object.assign(title.style, { fontSize: '24px', fontWeight: '700', marginBottom: '10px' });
  Object.assign(body.style, { fontSize: '16px', opacity: '0.85' });

  document.body.append(overlay);

  const portrait = window.matchMedia('(orientation: portrait)');
  const update = (): void => {
    overlay.style.display = portrait.matches ? 'flex' : 'none';
  };

  if (typeof portrait.addEventListener === 'function') {
    portrait.addEventListener('change', update);
  }
  window.addEventListener('resize', update);
  window.addEventListener('orientationchange', update);
  update();
}
