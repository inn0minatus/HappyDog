/**
 * track.ts — the SINGLE analytics choke point (spec §7.1).
 *
 * Game code never touches gtag/fbq directly; it calls the typed `track()`
 * overloads, which fan out to GA4 (gtag) and Meta Pixel (fbq) with the EXACT
 * event names + param shapes from spec §7.2:
 *   GA4:   gtag('event', <name>, <params>)
 *   Pixel: fbq('trackCustom', <name>, <params>)
 *
 * Everything here is SAFE when the pixels are absent/blocked/misconfigured:
 *  - Vendor scripts are injected at runtime by initAnalytics(), and ONLY when a
 *    real (non-empty, non-placeholder) ID is present — so with no `.env` (dev,
 *    previews) nothing loads and no network request is made.
 *  - Every dispatch is `typeof`-guarded, so a missing gtag/fbq global never throws.
 *  - A consent gate wraps both loading AND dispatch (spec §7.4).
 */

import { ENV } from '../config/env';

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    fbq?: ((...args: unknown[]) => void) & { callMethod?: (...args: unknown[]) => void };
    dataLayer?: unknown[];
    _fbq?: unknown;
  }
}

/** The three funnel events — names are FIXED by the brief (§3B); do not rename. */
export type AnalyticsEvent = 'start_game' | 'finish_game' | 'click_buy';

/** `start_game` — a round begins. No params required (spec §7.2). */
export type StartGameParams = Record<string, never>;

/** `finish_game` — a round ends (win OR lose) (spec §7.2). */
export interface FinishGameParams {
  result: 'win' | 'lose';
  score: number;
  /** Active play time in seconds, EXCLUDING paused time. */
  duration_s: number;
}

/** `click_buy` — the results-screen CTA was tapped (spec §7.2). */
export interface ClickBuyParams {
  destination: string;
  promo_code: string;
}

// ── Config guard (treats empty AND example placeholders as "not configured") ──
// The .env.example ships illustrative placeholders (G-XXXXXXXXXX, an all-zero
// pixel id). If someone copies it verbatim, analytics must stay a safe no-op —
// so we reject empty strings and any obvious placeholder shape here.
function isConfigured(id: string | undefined): boolean {
  const v = (id ?? '').trim().toLowerCase();
  if (v === '') return false;
  if (/^g-x+$/.test(v)) return false; // GA4 placeholder, e.g. G-XXXXXXXXXX
  if (/^x+$/.test(v)) return false; // generic all-X placeholder
  if (/^0+$/.test(v)) return false; // all-zero pixel id, e.g. 000000000000000
  return true;
}

// ── Consent gate (spec §7.4) ───────────────────────────────────────────────
// The adapter ships "consent-ready": a single flag every event passes through.
// A future CMP flips it via setAnalyticsConsent(); until then it defaults to
// granted so the funnel is observable in dev/QA. Vendor scripts are only loaded
// (and events only dispatched) while consent is granted.
let consentGranted = true;

export function setAnalyticsConsent(granted: boolean): void {
  consentGranted = granted;
  // A deferred grant (e.g. a CMP banner accepted after boot) should still bring
  // the vendors up — initAnalytics() is idempotent, so this is safe to re-call.
  if (granted) initAnalytics();
}

function hasConsent(): boolean {
  return consentGranted;
}

// ── track() — typed overloads so call sites get the right param shape ──────
export function track(event: 'start_game', params?: StartGameParams): void;
export function track(event: 'finish_game', params: FinishGameParams): void;
export function track(event: 'click_buy', params: ClickBuyParams): void;
// Implementation signature: `object` is the loosest supertype of every event's
// param shape (interfaces aren't assignable to Record<string, unknown> in TS).
export function track(event: AnalyticsEvent, params: object = {}): void {
  if (!hasConsent()) return;

  // GA4 — one custom event per funnel step (spec §7.2). `typeof` guard so an
  // absent/blocked gtag never throws.
  if (typeof window.gtag === 'function') {
    window.gtag('event', event, params);
  }
  // Meta Pixel — the brief's three names are CUSTOM events (trackCustom), not
  // Meta standard events (spec §7.3). `typeof` guard for the same reason.
  if (typeof window.fbq === 'function') {
    window.fbq('trackCustom', event, params);
  }

  if (ENV.debugAnalytics) {
    // Intentional QA mirror, gated behind VITE_DEBUG_ANALYTICS.
    console.debug('[track]', event, params);
  }
}

// ── initAnalytics() — env-gated loader (called once from main.ts) ──────────
// Injects the GA4 / Pixel bootstraps ONLY when a real ID is present AND consent
// is granted. With no IDs (dev/preview) or placeholder IDs this is a no-op and
// track() stays safe. Idempotent: safe to call again after a deferred consent.
let ga4Loaded = false;
let pixelLoaded = false;

export function initAnalytics(): void {
  if (!hasConsent()) return;

  if (!ga4Loaded && isConfigured(ENV.ga4Id)) {
    ga4Loaded = true;
    loadGa4(ENV.ga4Id);
  }
  if (!pixelLoaded && isConfigured(ENV.fbPixelId)) {
    pixelLoaded = true;
    loadPixel(ENV.fbPixelId);
  }
}

function loadGa4(measurementId: string): void {
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  document.head.appendChild(s);

  window.dataLayer = window.dataLayer ?? [];
  const gtag: (...args: unknown[]) => void = (...args) => {
    window.dataLayer?.push(args);
  };
  window.gtag = gtag;
  gtag('js', new Date());
  gtag('config', measurementId);
}

function loadPixel(pixelId: string): void {
  if (!window.fbq) {
    const fbq = ((...args: unknown[]) => {
      fbq.callMethod ? fbq.callMethod(...args) : fbq.queue.push(args);
    }) as ((...args: unknown[]) => void) & {
      callMethod?: (...args: unknown[]) => void;
      queue: unknown[][];
      loaded: boolean;
      version: string;
    };
    fbq.queue = [];
    fbq.loaded = true;
    fbq.version = '2.0';
    window.fbq = fbq;
    window._fbq = window._fbq ?? fbq;

    const s = document.createElement('script');
    s.async = true;
    s.src = 'https://connect.facebook.net/en_US/fbevents.js';
    document.head.appendChild(s);
  }
  window.fbq('init', pixelId);
  window.fbq('track', 'PageView');
}
