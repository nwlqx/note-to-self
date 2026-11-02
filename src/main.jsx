import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(<App />);

if (!__PREVIEW__ && 'serviceWorker' in navigator && location.protocol === 'https:') {
  // An app added to the home screen or Dock is rarely closed, so check for a new version
  // whenever it comes back to the front, not only when it starts.
  const hadVersion = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('./sw.js').then((reg) => {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') reg.update().catch(() => {});
    });
  }).catch(() => {});

  // When a new version takes over, reload once to show it, but never mid-typing or with a
  // sheet open: then wait until the app is next put away. Changes are already saved on the
  // device, so a reload loses nothing.
  let reloading = false;
  const reload = () => { if (!reloading) { reloading = true; location.reload(); } };
  const busy = () => !!document.querySelector('.sheet') || ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadVersion) return; // first install: this page is already the latest
    if (document.visibilityState === 'hidden' || !busy()) reload();
    else document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && reload());
  });
}
