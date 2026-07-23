/// <reference types="vite/client" />

// Typed contract for the VITE_* env vars this app reads (see src/config/env.ts).
// All optional: the app is correct when they are absent.
interface ImportMetaEnv {
  readonly VITE_GA4_ID?: string;
  readonly VITE_FB_PIXEL_ID?: string;
  readonly VITE_PROMO_CODE?: string;
  readonly VITE_BUY_URL?: string;
  readonly VITE_UTM_SOURCE?: string;
  readonly VITE_UTM_MEDIUM?: string;
  readonly VITE_UTM_CAMPAIGN?: string;
  readonly VITE_DEBUG_ANALYTICS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
