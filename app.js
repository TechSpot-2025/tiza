/* Tiza landing page behaviour. No framework. Everything here is progressive: the page reads and the
   download buttons work with scripts off; this file promotes the detected OS, runs the demo, and wires the
   copy/share helpers. Rules: site/DESIGN.md. */
(() => {
  'use strict';

  // Publishing config: site/config.json, rendered into the page by site/build.mjs (version from package.json).
  const CONFIG = JSON.parse(document.getElementById('config').textContent);

  const T = JSON.parse(document.getElementById('i18n').textContent);
  const t = (key, vars) => (T[key] || key).replace(/\{(\w+)\}/g, (_, k) => (vars && vars[k]) || '');
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode, blocked storage */ } },
  };

  // ---- OS detection ----
  function detectOS() {
    const ua = navigator.userAgent || '';
    const uad = navigator.userAgentData;
    const platform = (uad && uad.platform) || navigator.platform || '';
    const touch = (navigator.maxTouchPoints || 0) > 1;
    if ((uad && uad.mobile) || /iPhone|iPad|iPod|Android/i.test(ua) || /CrOS/.test(ua)) return 'other';
    if (/Mac/i.test(platform) && touch) return 'other'; // iPadOS reports MacIntel
    if (/Mac/i.test(platform) || /Mac OS X/.test(ua)) return 'mac';
    if (/Win/i.test(platform) || /Windows/.test(ua)) return 'win';
    if (/Linux|X11/i.test(platform) || /Linux/.test(ua)) return 'linux';
    return 'other';
  }
  const os = detectOS();
  const other = os === 'mac' ? 'win' : 'mac';
  const dlHref = (which) => CONFIG.downloads[which].url || '#download';

  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
  }
  async function shareOrCopy(text, onCopied) {
    const url = location.href.split('#')[0];
    if (navigator.share) {
      try { await navigator.share({ title: 'Tiza', text, url }); return; }
      catch (err) { if (err && err.name === 'AbortError') return; }
    }
    onCopied(await copyText(url), url);
  }
  // Status lines: emptied first so a repeated message is announced again; a success clears itself, a failure
  // (which may carry an address to copy by hand) stays.
  const say = (el, text, keep) => {
    if (!el) return;
    clearTimeout(el.sayWrite);
    clearTimeout(el.sayClear);
    el.textContent = '';
    el.sayWrite = setTimeout(() => { el.textContent = text; }, 60);
    if (!keep) el.sayClear = setTimeout(() => { el.textContent = ''; }, 10000);
  };

  // Every CTA group: promote the detected OS, link the other one as text, hand phones a share/copy action.
  // data-compact = the nav pill; data-quiet = a next-step text link at the end of a section.
  $$('[data-cta]').forEach((group) => {
    const compact = group.hasAttribute('data-compact');
    const quiet = group.hasAttribute('data-quiet');
    const links = $$('[data-os]', group);
    if (os === 'linux') {
      if (compact) {
        // Neither build is this visitor's, and below 1180px the nav keeps only its first pill (the Mac one):
        // at every width, one neutral "Download" link to the panel instead.
        links.slice(1).forEach((b) => b.remove());
        links[0].removeAttribute('data-os');
        links[0].href = '#download';
        links[0].textContent = t('dl_h3');
      } else if (!quiet) {
        const n = document.createElement('p'); n.className = 'note'; n.textContent = t('linux_note'); group.append(n);
      }
      return; // elsewhere both links stay, equal weight
    }
    if (os === 'other') {
      links.forEach((b) => b.remove());
      const note = document.createElement(quiet ? 'span' : 'p');
      note.className = compact ? 'sr-only' : quiet ? 'status small' : 'note';
      note.setAttribute('role', 'status');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = quiet ? 'linklike' : compact ? 'btn btn-primary btn-sm' : 'btn btn-primary';
      btn.textContent = t('cta_mobile');
      btn.addEventListener('click', () => shareOrCopy(t('share_text'), (ok) => say(note, ok ? t('cta_mobile_copied') : t('cta_mobile_fail'), true)));
      group.append(btn);
      if (!compact && !quiet) {
        // A second way home that needs no share sheet and no clipboard: a draft email to yourself.
        const mail = document.createElement('a');
        mail.className = 'other';
        const body = `${t('share_text')}\r\n\r\n${location.href.split('#')[0]}`; // CRLF: RFC 6068
        mail.href = `mailto:?subject=${encodeURIComponent(t('mail_self_subject'))}&body=${encodeURIComponent(body)}`;
        mail.textContent = t('cta_mobile_mail');
        group.append(mail);
        note.textContent = t('cta_mobile_note');
      }
      group.append(note);
      return;
    }
    links.forEach((b) => {
      if (b.dataset.os === os) b.href = dlHref(os);
      else b.remove();
    });
    const unpubNote = $('[data-unpub-note]', group);
    if (unpubNote && CONFIG.downloads[os].url) unpubNote.remove();
    if (!compact && !quiet) {
      const link = document.createElement('a');
      link.className = 'other';
      link.href = dlHref(other);
      link.textContent = t(other === 'win' ? 'cta_other_win' : 'cta_other_mac');
      group.append(link);
    }
  });

  // ---- Download panel ----
  (() => {
    const panel = $('[data-download]');
    if (!panel) return;
    const anyUnpublished = !CONFIG.downloads.mac.url || !CONFIG.downloads.win.url;
    const notify = $('[data-dl-notify]', panel);
    if (anyUnpublished && CONFIG.contactEmail) {
      $('[data-dl-notify-link]', notify).href = `mailto:${CONFIG.contactEmail}?subject=${encodeURIComponent(t('dl_notify_subject'))}`;
      notify.hidden = false;
    }
    // First-run steps: one OS at a time. theme.js picked the visitor's OS before first paint (html[data-run-os], which
    // the stylesheet reads for both the list and the pressed chip), so nothing moves or flips when this script
    // arrives; the chips only switch that attribute, and aria-pressed follows for assistive technology.
    const root = document.documentElement;
    const tabs = $$('[data-os-tab]', panel);
    const showRun = (which) => {
      root.dataset.runOs = which;
      tabs.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.osTab === which)));
    };
    tabs.forEach((b) => b.addEventListener('click', () => showRun(b.dataset.osTab)));
    showRun(root.dataset.runOs === 'win' ? 'win' : 'mac');
  })();

  // ---- After the click: the browser handles the download, and the page says what to do with the file ----
  // The card is a non-modal dialog: it takes focus so a keyboard user lands on the next step, and never blocks the page.
  // It stays until closed, because the steps are needed while the installer is open in another window.
  (() => {
    const dock = $('[data-dock]');
    const whichDownload = (a) => ['mac', 'win'].find((w) => CONFIG.downloads[w].url && a.getAttribute('href') === CONFIG.downloads[w].url);
    const sheet = window.matchMedia('(max-width: 600px)');
    let trigger = null;
    // As a bottom sheet the card spans the width: keep anything focused or jumped to out from under it, and keep
    // that in step with rotation, resizing and the card's own height.
    const pad = () => { document.documentElement.style.scrollPaddingBottom = dock && dock.open && sheet.matches ? `${dock.offsetHeight + 16}px` : ''; };
    const close = () => {
      if (!dock || !dock.open) return;
      const inside = dock.contains(document.activeElement);
      dock.close();
      pad();
      if (inside && trigger && trigger.isConnected) trigger.focus({ preventScroll: true });
    };
    const open = (which, from) => {
      if (!dock || typeof dock.show !== 'function') return;
      const title = $('[data-dock-title]', dock);
      title.textContent = t(`dock_title_${which}`);
      // The panel's own list for that OS (scoped to the panel: the card holds a copy of an earlier one).
      const steps = $(`[data-download] [data-run="${which}"] .run`);
      $('[data-dock-steps]', dock).replaceChildren(...(steps ? [steps.cloneNode(true)] : []));
      $('[data-dock-retry]', dock).href = CONFIG.downloads[which].url;
      trigger = from;
      if (!dock.open) dock.show();
      pad();
      title.focus({ preventScroll: true });
    };
    document.addEventListener('click', (e) => {
      // A modified click opens the file elsewhere (new tab, new window, save as): leave it alone.
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target instanceof Element ? e.target.closest('a[href]') : null;
      const which = a && whichDownload(a);
      if (!which) return; // not a published download: nothing to explain
      // The version this link serves, remembered in this browser only, so a later visit can say when a newer one is out.
      store.set('tiza-dl', JSON.stringify({ v: CONFIG.downloads[which].version, os: which }));
      if (!a.closest('[data-dock]')) open(which, a);
    });
    if (dock) {
      $('[data-dock-close]', dock).addEventListener('click', close);
      // Esc closes it from anywhere on the page, not only while focus is inside.
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && dock.open) { e.preventDefault(); close(); } });
      if (sheet.addEventListener) sheet.addEventListener('change', pad);
      if ('ResizeObserver' in window) new ResizeObserver(pad).observe(dock);
    }

    // A returning visitor whose last download here was an older version: there is no auto-update, so say it.
    let prev = null;
    try { prev = JSON.parse(store.get('tiza-dl') || 'null'); } catch { /* not ours */ }
    const parts = (v) => String(v).split('.').map((n) => parseInt(n, 10) || 0);
    const newer = (a, b) => {
      const x = parts(a), y = parts(b);
      for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0);
      return false;
    };
    // Only when that download was for this computer's OS: then the hero button right above the line is the new build.
    const now = prev && prev.os === os && (os === 'mac' || os === 'win') && CONFIG.downloads[os].url ? CONFIG.downloads[os].version : '';
    const slot = $('[data-returning]');
    if (slot && now && typeof prev.v === 'string' && /^\d+(\.\d+){0,2}$/.test(prev.v) && newer(now, prev.v)) {
      // The sentence replaces the "free during beta" line instead of adding one. It is shorter than that line and
      // set in the same weight, and the line keeps its height: nothing below it moves.
      slot.style.minHeight = `${slot.offsetHeight}px`;
      slot.textContent = t('returning_new', { new: now, old: prev.v });
      slot.classList.add('returning');
    }
  })();

  // ---- Contact ----
  if (CONFIG.contactEmail) {
    const wrap = $('[data-contact]');
    const link = $('[data-contact-link]', wrap);
    link.href = `mailto:${CONFIG.contactEmail}`;
    link.textContent = CONFIG.contactEmail;
    wrap.hidden = false;
  }

  // ---- The demo: one component, one state machine ----
  const CLOUDS = { drive: 'Google Drive', onedrive: 'OneDrive', dropbox: 'Dropbox', icloud: 'iCloud Drive' };
  const PLATFORMS = { zoom: 'Zoom', teams: 'Teams', meet: 'Meet' };
  const ORDER = ['ready', 'joining', 'recording', 'uploading', 'saved'];
  const DUR = { ready: 6000, joining: 2000, recording: 6000, uploading: 2600, saved: 3200 };
  const READY_SECONDS = 6; // the countdown runs in real seconds, so it never lies
  const TODAY = (() => { const d = new Date(), two = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`; })();

  class Demo {
    constructor(el, { auto }) {
      this.el = el;
      this.auto = auto;
      this.playing = auto && !reduced.matches;
      this.state = 'ready';
      this.cloud = el.dataset.cloud || 'drive';
      this.platform = el.dataset.platform || 'zoom';
      this.timer = null;
      this.tick = null;
      this.hoverPaused = false;
      this.deadline = 0; this.remaining = null; this.elapsed = 0;
      this.q = (name) => $(`[data-demo="${name}"]`, el);
      this.toggle = $('[data-toggle]', el);
      $$('[data-set]', el).forEach((b) => b.addEventListener('click', () => { this.setPlaying(false, true); this.set(b.dataset.set); this.announce(); }));
      if (this.toggle) {
        if (!auto) this.toggle.remove();
        else this.toggle.addEventListener('click', () => { this.setPlaying(!this.playing, true); this.announce(); });
      }
      // Hover and focus pause silently; a pointer that is a finger never pauses by accident.
      el.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') this.hover(true); });
      el.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') this.hover(false); });
      el.addEventListener('focusin', () => this.hover(true));
      el.addEventListener('focusout', (e) => { if (!el.contains(e.relatedTarget)) this.hover(false); });
      document.addEventListener('visibilitychange', () => { if (document.hidden) this.clearAll(); else this.resume(); });
      if (reduced.addEventListener) reduced.addEventListener('change', () => { if (reduced.matches) this.setPlaying(false, false); });
      this.render();
      this.renderToggle();
      this.schedule();
    }
    setCloud(c) { this.cloud = c; this.el.dataset.cloud = c; this.render(); }
    setPlatform(p) { this.platform = p; this.el.dataset.platform = p; this.render(); }
    renderToggle() {
      if (!this.toggle) return;
      this.toggle.textContent = this.playing ? t('demo_pause') : t('demo_play');
    }
    setPlaying(on, announce) {
      if (!this.auto) return;
      this.playing = on;
      this.renderToggle();
      if (announce) this.q('note').textContent = on ? '' : t('demo_stopped');
      if (on) { this.hoverPaused = false; this.resume(); } // an explicit Play wins over a hover or focus pause
      else this.clearAll();
    }
    hover(on) {
      this.hoverPaused = on;
      if (on) this.clearAll(); else this.resume();
    }
    clearTimer() {
      if (this.timer && this.deadline) this.remaining = Math.max(0, this.deadline - Date.now());
      clearTimeout(this.timer); this.timer = null;
    }
    clearTick() { clearInterval(this.tick); this.tick = null; }
    clearAll() { this.clearTimer(); this.clearTick(); }
    resume() { this.render(); this.schedule(); }
    announce() { const live = this.q('live'); if (live) live.textContent = `${t('demo_live_prefix')} ${this.q('status').textContent}`; }
    schedule() {
      if (!this.playing || this.hoverPaused || document.hidden) return;
      clearTimeout(this.timer);
      const wait = this.remaining ?? DUR[this.state];
      this.remaining = null;
      this.deadline = Date.now() + wait;
      this.timer = setTimeout(() => { this.timer = null; this.set(ORDER[(ORDER.indexOf(this.state) + 1) % ORDER.length]); }, wait);
    }
    set(state) {
      this.remaining = null; this.deadline = 0;
      this.state = state;
      this.el.dataset.state = state;
      $$('[data-set]', this.el).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.set === state)));
      this.render();
      this.schedule();
    }
    render() {
      const { state } = this;
      const cloud = CLOUDS[this.cloud];
      const icloud = this.cloud === 'icloud';
      this.q('platform').textContent = PLATFORMS[this.platform];
      this.q('title').textContent = t('demo_title');
      const status = this.q('status'), timer = this.q('timer'), file = this.q('file'), pill = this.q('pill');
      this.clearTick();
      file.textContent = '';
      const mmss = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
      if (state === 'ready') {
        status.textContent = t('demo_st_ready');
        pill.textContent = t('demo_pill_ready');
        let left = this.playing ? Math.ceil((this.remaining ?? (this.deadline ? this.deadline - Date.now() : DUR.ready)) / 1000) : 120;
        if (left > READY_SECONDS || left < 0) left = READY_SECONDS;
        const show = () => { timer.textContent = `${t('demo_st_countdown')} ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`; };
        show();
        if (this.playing && !this.hoverPaused) this.tick = setInterval(() => { if (left > 0) left -= 1; show(); }, 1000);
      } else if (state === 'joining') {
        status.textContent = t('demo_st_joining'); timer.textContent = ''; pill.textContent = t('demo_pill_ready');
      } else if (state === 'recording') {
        status.textContent = t('demo_st_recording'); pill.textContent = t('demo_pill_rec');
        const spent = this.deadline ? DUR.recording - (this.remaining ?? (this.deadline - Date.now())) : 0;
        let s = 7 + Math.max(0, Math.floor(spent / 1000));
        timer.textContent = `00:${mmss(s)}`;
        // The pinned copy (auto off) is driven by scroll and always ticks; the hero clock stops with its loop.
        if (!reduced.matches && (!this.auto || (this.playing && !this.hoverPaused))) this.tick = setInterval(() => { s += 1; timer.textContent = `00:${mmss(s)}`; }, 1000);
      } else if (state === 'uploading') {
        status.textContent = icloud ? t('demo_st_uploading_icloud') : t('demo_st_uploading', { cloud });
        timer.textContent = ''; pill.textContent = t('demo_pill_rec');
        file.textContent = t('demo_file', { date: TODAY });
      } else if (state === 'saved') {
        status.textContent = icloud ? t('demo_st_saved_icloud') : t('demo_st_saved', { cloud });
        timer.textContent = ''; pill.textContent = t('demo_pill_done');
        file.textContent = t('demo_file', { date: TODAY });
      }
    }
  }

  const heroEl = $('#demo-hero');
  const hero = heroEl ? new Demo(heroEl, { auto: true }) : null;

  // The pinned copy in "How it works": the same markup, driven by the steps and the selectors, not by a clock.
  const slot = $('#demo-how-slot');
  let how = null;
  if (heroEl && slot) {
    const clone = heroEl.cloneNode(true);
    clone.id = 'demo-how';
    clone.querySelector('.win').setAttribute('aria-hidden', 'true');
    clone.querySelector('[data-demo="live"]').remove();
    clone.querySelector('[data-demo="note"]').textContent = '';
    slot.append(clone);
    how = new Demo(clone, { auto: false });
    const stepsEl = $('.steps');
    const steps = $$('.step');
    const activate = (step) => {
      steps.forEach((s) => s.classList.toggle('on', s === step));
      how.set(step.dataset.step);
    };
    if ('IntersectionObserver' in window) {
      stepsEl.classList.add('live');
      const io = new IntersectionObserver((entries) => {
        entries.filter((e) => e.isIntersecting).forEach((e) => activate(e.target));
      }, { rootMargin: window.matchMedia('(max-width: 900px)').matches ? '-45% 0px -25% 0px' : '-30% 0px -45% 0px', threshold: 0 });
      steps.forEach((s) => io.observe(s));
    }
    activate(steps[0]);
    const setCloudName = (c) => { $$('[data-demo="cloudname"], [data-demo="cloudname2"]').forEach((n) => { n.textContent = CLOUDS[c]; }); };
    $$('.seg [data-platform]').forEach((b) => b.addEventListener('click', () => {
      $$('.seg [data-platform]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      how.setPlatform(b.dataset.platform); if (hero) { hero.setPlatform(b.dataset.platform); hero.announce(); }
    }));
    $$('.seg [data-cloud]').forEach((b) => b.addEventListener('click', () => {
      $$('.seg [data-cloud]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      how.setCloud(b.dataset.cloud); if (hero) hero.setCloud(b.dataset.cloud);
      setCloudName(b.dataset.cloud);
      if (hero) hero.announce();
    }));
  }

  // ---- Privacy diagram: draw in once ----
  const diagram = $('[data-diagram]');
  if (diagram && (reduced.matches || !('IntersectionObserver' in window))) $$('[data-arrow]', diagram).forEach((p) => p.setAttribute('marker-end', 'url(#arr)'));
  if (diagram && !reduced.matches && 'IntersectionObserver' in window) {
    const paths = $$('path.arrow, path.cross', diagram);
    paths.forEach((p) => { const len = p.getTotalLength(); p.style.strokeDasharray = `${len}`; p.style.strokeDashoffset = `${len}`; });
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      paths.forEach((p, i) => { p.style.transition = `stroke-dashoffset 600ms ${i * 120}ms ease-out`; p.style.strokeDashoffset = '0'; if (p.hasAttribute('data-arrow')) setTimeout(() => p.setAttribute('marker-end', 'url(#arr)'), 400 + i * 120); });
      io.disconnect();
    }, { threshold: 0.4 });
    io.observe(diagram);
  }

  // ---- Copy helpers ----
  $$('[data-copy]').forEach((btn) => btn.addEventListener('click', async () => {
    const src = $(btn.dataset.copy);
    const ok = await copyText(src ? src.textContent.trim() : '');
    say(btn.parentElement.querySelector('.status'), ok ? btn.dataset.ok : btn.dataset.fail, !ok);
  }));
  $$('[data-share]').forEach((btn) => btn.addEventListener('click', () => {
    const status = btn.parentElement.querySelector('.status');
    shareOrCopy(btn.dataset.text, (ok, url) => say(status, ok ? btn.dataset.ok : `${btn.dataset.fail || ''} ${url}`.trim(), !ok));
  }));

  // ---- Theme ----
  const applyTheme = (v) => {
    if (v !== 'light' && v !== 'dark') v = 'auto';
    if (v === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.dataset.theme = v;
    $$('[data-theme-set]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.themeSet === v)));
  };
  applyTheme(store.get('tiza-theme') || 'auto');
  $$('[data-theme-set]').forEach((b) => b.addEventListener('click', () => { store.set('tiza-theme', b.dataset.themeSet); applyTheme(b.dataset.themeSet); }));

  // ---- FAQ deep links ----
  const openHash = () => {
    let el = null;
    try { el = location.hash.length > 1 ? document.getElementById(decodeURIComponent(location.hash.slice(1))) : null; } catch { /* bad hash */ }
    if (el && el.tagName === 'DETAILS') el.open = true;
  };
  openHash();
  window.addEventListener('hashchange', openHash);
})();
