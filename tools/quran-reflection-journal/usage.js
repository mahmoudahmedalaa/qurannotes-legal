'use strict';

(() => {
  // Public write-only ingestion token for the QuranNotes EU PostHog project.
  const projectToken = 'phc_B96AGYbeiMKD4txQQndu9inrUQ7GSxeGZZc2WmeW6mTN';
  const receiver = 'https://eu.i.posthog.com/i/v0/e/';
  const withdrawalChannel = 'qurannotes-journal-usage';
  const activeThreshold = 30_000;
  const events = Object.freeze({
    view: 'journal_view',
    active: 'journal_active_30s',
    reflection: 'journal_reflection_start',
    copy: 'journal_copy_success',
    print: 'journal_print_open',
    blank: 'journal_blank_print_open',
    download: 'journal_pdf_download',
    store: 'journal_app_store_click',
  });

  const control = document.querySelector('#usage-consent');
  const toggle = document.querySelector('#share-usage');
  const reflection = document.querySelector('#reflection');
  const testMode = window.location.hash === '#journal-qa'
    || ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);
  let session = null;
  let sharing = false;

  function browserAllowsSharing() {
    const doNotTrack = [navigator.doNotTrack, window.doNotTrack, navigator.msDoNotTrack];
    return navigator.globalPrivacyControl !== true && !doNotTrack.some(value => value === '1' || value === 'yes');
  }

  function sourceBucket() {
    if (!document.referrer) return 'direct';
    try {
      const hostname = new URL(document.referrer).hostname.toLowerCase();
      if (/^(www\.)?google\.(com|[a-z]{2}|(?:com|co)\.[a-z]{2})$/.test(hostname)) return 'google';
      if (/^(www\.)?(bing\.com|duckduckgo\.com|ecosia\.org|yandex\.ru)$/.test(hostname)
        || ['search.brave.com', 'search.yahoo.com'].includes(hostname)) return 'search';
    } catch {
      // An unrecognized referrer is still just an aggregate bucket.
    }
    return 'other';
  }

  function record(key) {
    const current = session;
    if (!sharing || !current || !browserAllowsSharing() || !Object.hasOwn(events, key)) return;
    const controller = new AbortController();
    current.pending.add(controller);
    void fetch(receiver, {
      method: 'POST',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        api_key: projectToken,
        event: events[key],
        distinct_id: current.id,
        properties: {
          $geoip_disable: true,
          $process_person_profile: false,
          test_mode: testMode,
          ...(key === 'view' ? { source: sourceBucket() } : {}),
        },
      }),
    }).catch(() => undefined).finally(() => current.pending.delete(controller));
  }

  function trackAttention(attentive = document.visibilityState === 'visible' && document.hasFocus()) {
    const current = session;
    if (!sharing || !current || current.activeSent) return;
    clearTimeout(current.timer);
    const now = performance.now();
    if (current.attentiveSince !== null) current.activeMs += now - current.attentiveSince;
    current.attentiveSince = attentive ? now : null;
    const remaining = activeThreshold - current.activeMs;
    if (remaining <= 0) {
      current.activeSent = true;
      record('active');
    } else if (attentive) {
      current.timer = setTimeout(() => trackAttention(), remaining);
    }
  }

  function enable() {
    if (sharing || !browserAllowsSharing()) return;
    sharing = true;
    if (!session) {
      session = {
        id: crypto.randomUUID(),
        pending: new Set(),
        startedWriting: false,
        copyStarted: false,
        printRequested: false,
        activeMs: 0,
        attentiveSince: null,
        activeSent: false,
        timer: null,
      };
      record('view');
    }
    trackAttention();
  }

  function disable() {
    sharing = false;
    toggle.checked = false;
    if (!session) return;
    clearTimeout(session.timer);
    if (session.attentiveSince !== null) {
      session.activeMs += performance.now() - session.attentiveSince;
      session.attentiveSince = null;
    }
    session.copyStarted = false;
    session.printRequested = false;
    for (const controller of session.pending) controller.abort();
    session.pending.clear();
  }

  if (!browserAllowsSharing() || typeof crypto.randomUUID !== 'function') return;

  let withdrawals;
  try {
    withdrawals = new BroadcastChannel(withdrawalChannel);
    withdrawals.addEventListener('message', (event) => {
      if (event.data === 'withdrawn') disable();
    });
  } catch {
    // The control still works for this visit if cross-tab messages are unavailable.
  }

  toggle.addEventListener('change', () => {
    if (toggle.checked) enable();
    else {
      disable();
      withdrawals?.postMessage('withdrawn');
    }
  });
  window.addEventListener('focus', () => trackAttention());
  window.addEventListener('blur', () => trackAttention(false));
  window.addEventListener('pageshow', () => trackAttention());
  window.addEventListener('pagehide', () => trackAttention(false));
  document.addEventListener('visibilitychange', () => trackAttention());

  reflection.addEventListener('input', (event) => {
    if (!sharing || session.startedWriting || !event.isTrusted || !event.inputType?.startsWith('insert')) return;
    session.startedWriting = true;
    record('reflection');
  });
  window.addEventListener('quranjournal:copy-start', () => {
    if (sharing) session.copyStarted = true;
  });
  window.addEventListener('quranjournal:copy-success', () => {
    if (!session?.copyStarted) return;
    session.copyStarted = false;
    record('copy');
  });
  window.addEventListener('quranjournal:print-request', () => {
    if (sharing) session.printRequested = true;
  });
  function recordPrint(key) {
    if (!session?.printRequested) return;
    session.printRequested = false;
    record(key);
  }
  window.addEventListener('quranjournal:print-open', () => recordPrint('print'));
  window.addEventListener('quranjournal:blank-print-open', () => recordPrint('blank'));
  document.querySelector('#download-blank-pdf')?.addEventListener('click', (event) => {
    if (event.isTrusted) record('download');
  });
  for (const link of document.querySelectorAll('.store-link, .app-button')) {
    link.addEventListener('click', (event) => {
      if (event.isTrusted) record('store');
    });
  }

  control.hidden = false;
  toggle.checked = false;
})();
