'use client';

import { useEffect } from 'react';

/**
 * Registers /sw.js in production. Dev is skipped — Turbopack rewrites chunk
 * URLs on every refresh, so a SW caching them would serve stale code.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

    navigator.serviceWorker
      .register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .catch((err) => {
        console.error('Service worker registration failed', err);
      });
  }, []);

  return null;
}
