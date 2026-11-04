/* Keep one requested booking navigation aligned while late reviews change layout. */
(() => {
  'use strict';
  const target = document.getElementById('booking');
  if (!target) return;

  const header = document.querySelector('.db-header');
  const scrollKeys = ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' ', 'Spacebar'];
  let stopCurrent = () => {};
  const pagePath = path => path.replace(/\/index\.html$/, '/');

  function start() {
    stopCurrent();
    let active = true, frame = 0, observer, lastDestination;
    const destination = () => {
      const offset = Math.max(0, header ? header.getBoundingClientRect().bottom : 0) + 12;
      const max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      return Math.min(max, Math.max(0, window.scrollY + target.getBoundingClientRect().top - offset));
    };
    const align = initial => {
      frame = 0;
      if (!active) return;
      const top = destination();
      // The observer's first notification must not cancel a smooth scroll in progress.
      if (!initial && Math.abs(top - lastDestination) < 1.5) return;
      lastDestination = top;
      if (Math.abs(window.scrollY - top) > 1.5) {
        const smooth = initial && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        window.scrollTo({top, behavior: smooth ? 'smooth' : 'instant'});
      }
    };
    const changed = () => {
      if (active && !frame) frame = window.requestAnimationFrame(() => align(false));
    };
    const cancel = event => {
      if (event.type === 'keydown' && !scrollKeys.includes(event.key)) return;
      stop();
    };
    const events = ['wheel', 'touchstart', 'pointerdown', 'keydown'];
    const stop = () => {
      if (!active) return;
      active = false;
      if (frame) window.cancelAnimationFrame(frame);
      if (observer) observer.disconnect();
      window.clearTimeout(timer);
      events.forEach(type => window.removeEventListener(type, cancel, true));
      window.removeEventListener('load', changed);
      window.removeEventListener('resize', changed);
    };
    // Event-driven and finite: never turn a booking link into a permanent scroll lock.
    const timer = window.setTimeout(stop, 15000);
    stopCurrent = stop;
    events.forEach(type => window.addEventListener(type, cancel, {capture: true, passive: true}));
    window.addEventListener('load', changed);
    window.addEventListener('resize', changed);
    if (window.ResizeObserver) {
      observer = new window.ResizeObserver(changed);
      [document.body, header, document.getElementById('reviews')].filter(Boolean).forEach(el => observer.observe(el));
    } else if (window.MutationObserver) {
      observer = new window.MutationObserver(changed);
      observer.observe(document.body, {subtree: true, childList: true, attributes: true});
    }
    frame = window.requestAnimationFrame(() => align(true));
  }

  document.addEventListener('click', event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target && event.target.closest ? event.target.closest('a[href]') : null;
    if (!link || link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
    const url = new URL(link.href, window.location.href);
    if (url.origin !== window.location.origin || pagePath(url.pathname) !== pagePath(window.location.pathname) || url.search !== window.location.search || url.hash !== '#booking') return;
    event.preventDefault();
    if (window.location.hash !== '#booking') window.history.pushState(window.history.state, '', '#booking');
    start();
  });
  window.addEventListener('hashchange', () => {
    if (window.location.hash === '#booking') start();
    else stopCurrent();
  });
  if (window.location.hash === '#booking') start();
})();
