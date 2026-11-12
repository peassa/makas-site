// Makas AI — site etkileşimleri: dil, açılış, kaydırma, canlı kurgu penceresi, deneme alanı, fiyat.
// Metinler: i18n.js (scripts/site-olustur.py üretir). Ayarlar: config.js.
(() => {
  window.makasReady = true;
  document.documentElement.classList.add('js');
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const root = document.documentElement;
  const C = window.MAKAS ?? {};
  // Tarayıcı depolaması kapalı olabilir (gizli pencere): site onsuz da çalışır
  const store = {
    get: (k) => {
      try {
        return localStorage.getItem(k);
      } catch {
        return null;
      }
    },
    set: (k, v) => {
      try {
        localStorage.setItem(k, v);
      } catch {
        /* yoksay */
      }
    },
  };
  window.makasStore = store;

  // ---------- Dil ----------
  const T = window.MAKAS_TR ?? {};
  const STR = window.MAKAS_STR ?? { en: {}, tr: {} };
  const EN = new Map();
  let lang = store.get('makas-lang') || ((navigator.language || '').toLowerCase().startsWith('tr') ? 'tr' : 'en');
  const str = (k) => STR[lang]?.[k] ?? STR.en?.[k] ?? k;
  function applyLang(next) {
    lang = next === 'tr' ? 'tr' : 'en';
    root.lang = lang;
    for (const el of $$('[data-i18n]')) {
      const k = el.dataset.i18n;
      if (!EN.has(el)) EN.set(el, el.innerHTML);
      el.innerHTML = lang === 'tr' && T[k] != null ? T[k] : EN.get(el);
    }
    for (const el of $$('[data-i18n-ph]')) {
      if (!el.dataset.ph) el.dataset.ph = el.placeholder;
      el.placeholder = lang === 'tr' && T[el.dataset.i18nPh] ? T[el.dataset.i18nPh] : el.dataset.ph;
    }
    for (const b of $$('#lang button')) b.classList.toggle('on', b.dataset.lang === lang);
    for (const el of $$('[data-lang-block]')) el.hidden = el.dataset.langBlock !== lang;
    store.set('makas-lang', lang);
    document.dispatchEvent(new CustomEvent('makas-lang', { detail: lang }));
  }
  const onLang = (fn) => document.addEventListener('makas-lang', fn);
  window.makasLang = () => lang;
  window.makasT = (k, en) => (lang === 'tr' && T[k] != null ? T[k] : en);
  for (const b of $$('#lang button')) b.addEventListener('click', () => applyLang(b.dataset.lang));

  // Oturum açıksa menüde "Hesabım"
  if (store.get('makas-session')) {
    for (const a of $$('[data-auth="out"]')) {
      a.href = 'account.html';
      a.dataset.i18n = 'nav.account';
      a.textContent = 'My account';
    }
  }

  // ---------- Açılış perdesi, menü ----------
  requestAnimationFrame(() => setTimeout(() => root.classList.add('loaded'), 40));
  const y = $('#year');
  if (y) y.textContent = new Date().getFullYear();
  const nav = $('#nav');
  $('#burger')?.addEventListener('click', () => nav.classList.toggle('open'));
  for (const a of $$('.nav nav a')) a.addEventListener('click', () => nav.classList.remove('open'));

  /** Öğe görünürken çalışan, görünmezken duran işler için. */
  function whenVisible(el, start, stop, threshold = 0.25) {
    new IntersectionObserver(([e]) => (e.isIntersecting ? start() : stop()), { threshold }).observe(el);
  }
  /** Öğe ilk kez göründüğünde bir kez. */
  function onceVisible(el, fn, threshold = 0.4) {
    new IntersectionObserver(
      ([e], o) => {
        if (!e.isIntersecting) return;
        o.disconnect();
        fn();
      },
      { threshold },
    ).observe(el);
  }
  const fill = (el) => el.style.setProperty('--v', `${((el.value - el.min) / (el.max - el.min)) * 100}%`);
  for (const r of $$('input[type=range]')) {
    fill(r);
    r.addEventListener('input', () => fill(r));
  }
  /** Tek seçimli düğme grubu. */
  function pick(group, fn) {
    const btns = $$('button', group);
    for (const b of btns)
      b.addEventListener('click', () => {
        btns.forEach((x) => x.classList.toggle('on', x === b));
        fn(b);
      });
  }

  // ---------- Kaydırma: ilerleme, menü zemini, kesim çizgileri, zaman kodu ----------
  const progress = $('#progress');
  const ed = $('#ed');
  const cuts = $$('.cut');
  const hudTc = $('#hudTc');
  const hudSec = $('#hudSec');
  const hudSecs = $$('[data-hud]');
  const two = (n) => String(n).padStart(2, '0');
  const timecode = (f) => `${two(Math.floor(f / 86400))}:${two(Math.floor(f / 1440) % 60)}:${two(Math.floor(f / 24) % 60)}:${two(f % 24)}`;
  let mx = 0;
  let my = 0;
  let ticking = false;
  function frame() {
    ticking = false;
    const sy = scrollY;
    const vh = innerHeight;
    const max = root.scrollHeight - vh;
    const k = max > 0 ? sy / max : 0;
    if (progress) progress.style.transform = `scaleX(${k})`;
    nav?.classList.toggle('scrolled', sy > 20);
    if (ed && !reduce) {
      const s = Math.min(1, sy / vh);
      ed.style.setProperty('--rx', `${(mx * 5 - s * 7).toFixed(2)}deg`);
      ed.style.setProperty('--ry', `${(-my * 4 - s * 3).toFixed(2)}deg`);
    }
    for (const c of cuts) {
      const top = c.getBoundingClientRect().top;
      c.style.setProperty('--k', clamp((vh * 0.94 - top) / (vh * 0.6), 0, 1).toFixed(3));
    }
    if (hudTc) {
      hudTc.textContent = timecode(Math.round(k * 154 * 24));
      let cur = hudSecs[0];
      for (const s of hudSecs) if (s.getBoundingClientRect().top <= vh * 0.5) cur = s;
      const [en, tr] = (cur?.dataset.hud ?? '').split('|');
      const label = lang === 'tr' ? tr || en : en;
      if (hudSec.textContent !== label) hudSec.textContent = label;
    }
  }
  const tick = () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(frame);
    }
  };
  addEventListener('scroll', tick, { passive: true });
  addEventListener('resize', tick);
  onLang(tick);
  if (!reduce && matchMedia('(pointer: fine)').matches) {
    addEventListener('pointermove', (e) => {
      mx = e.clientX / innerWidth - 0.5;
      my = e.clientY / innerHeight - 0.5;
      tick();
    });
    // Mıknatıs düğmeler
    for (const b of $$('[data-magnet]')) {
      b.addEventListener('pointermove', (e) => {
        const r = b.getBoundingClientRect();
        b.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.16}px, ${(e.clientY - r.top - r.height / 2) * 0.28}px)`;
      });
      b.addEventListener('pointerleave', () => (b.style.transform = ''));
    }
    // Kartlarda imleci izleyen ışık
    for (const c of $$('.card')) {
      c.addEventListener('pointermove', (e) => {
        const r = c.getBoundingClientRect();
        c.style.setProperty('--mx', `${e.clientX - r.left}px`);
        c.style.setProperty('--my', `${e.clientY - r.top}px`);
      });
    }
  }

  // ---------- Görününce belirme, sayaçlar ----------
  const io = new IntersectionObserver(
    (es) => {
      for (const e of es) {
        if (!e.isIntersecting) continue;
        e.target.classList.add('in');
        io.unobserve(e.target);
        const n = e.target.querySelector?.('[data-count]');
        if (n) count(n);
      }
    },
    { threshold: 0.12, rootMargin: '0px 0px -5% 0px' },
  );
  for (const el of $$('.rv')) io.observe(el);
  function count(el) {
    const to = Number(el.dataset.count);
    const suf = el.dataset.suffix ?? '';
    if (reduce) return;
    const t0 = performance.now();
    const step = (t) => {
      const k = Math.min(1, (t - t0) / 1300);
      el.textContent = Math.round(to * (1 - (1 - k) ** 3)) + suf;
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  // ---------- Açılış: kendi kendine kurgulayan pencere ----------
  if (ed) {
    const stage = $('#stage');
    const fitEl = $('#edFit');
    const fit = () => {
      const mobile = innerWidth <= 900;
      const sw = stage.clientWidth;
      const s = mobile ? sw / 560 : clamp(sw / 640, 0.7, 1.06);
      fitEl.style.setProperty('--s', s.toFixed(4));
      stage.style.height = `${Math.round(mobile ? 524 * s : 560 * s + 40)}px`;
    };
    fit();
    addEventListener('resize', fit);

    // Ses dalgası çubukları (her açılışta aynı görünsün diye sabit tohum)
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (const sg of $$('#edWave .sg')) {
      const gap = sg.classList.contains('gap');
      const n = Math.round(Number(sg.dataset.n) * 1.5);
      sg.firstElementChild.innerHTML = Array.from({ length: n }, (_, i) => `<u style="--h:${(gap ? 6 + rnd() * 8 : 22 + Math.abs(Math.sin(i * 0.7)) * 38 + rnd() * 34).toFixed(0)}%"></u>`).join('');
    }

    const rows = $$('.mk-row', ed);
    const btn = $('#mkBtn');
    const words = $$('.v-cap span', ed);
    const status = $('#edStatus');
    const tc = $('#edTc');
    const DUR = [1750, 1700, 1600, 2500, 2600, 3600];
    let ph = -1;
    let timers = [];
    let capT = 0;
    let frames = 12 * 24 + 8;
    const later = (fn, ms) => timers.push(setTimeout(fn, ms));
    const place = () => {
      if (!btn.offsetParent) return;
      let x = btn.offsetWidth * 0.6;
      let yy = btn.offsetHeight * 0.5;
      for (let el = btn; el && el !== ed; el = el.offsetParent) {
        x += el.offsetLeft;
        yy += el.offsetTop;
      }
      ed.style.setProperty('--cx', `${x - 5}px`);
      ed.style.setProperty('--cy', `${yy - 3}px`);
    };
    function set(p) {
      ph = p;
      ed.dataset.ph = p;
      const on = (c, v) => ed.classList.toggle(c, v);
      on('s-idle', p === 0);
      on('s-find', p === 1);
      on('s-busy', p >= 1 && p <= 4);
      on('s-cut', p >= 2);
      on('s-cap', p >= 3);
      on('s-col', p >= 4);
      on('s-done', p === 5);
      ed.style.setProperty('--prog', clamp(p / 4.3, 0, 1).toFixed(2));
      rows.forEach((r, i) => {
        r.classList.toggle('run', p === i + 1);
        r.classList.toggle('done', p > i + 1);
      });
      status.textContent = str(`ed.s${Math.max(0, p)}`);
      clearInterval(capT);
      words.forEach((w) => w.classList.remove('hot'));
      if (p >= 3) {
        let w = 0;
        words[0].classList.add('hot');
        capT = setInterval(() => {
          words.forEach((x) => x.classList.remove('hot'));
          words[++w % words.length].classList.add('hot');
          frames += 11;
          tc.textContent = timecode(frames);
        }, 460);
      }
    }
    function step() {
      set(ph);
      if (ph === 0) {
        place();
        later(() => ed.classList.add('press'), 1280);
        later(() => ed.classList.remove('press'), 1600);
      }
      later(() => {
        if (ph < 5) {
          ph++;
          return step();
        }
        // Başa dön: kısa bir kararma, sonra geçişsiz sıfırlama
        ed.classList.add('fade');
        later(() => {
          ed.classList.add('rst');
          set(-1);
          frames = 12 * 24 + 8;
          tc.textContent = timecode(frames);
          void ed.offsetWidth;
          ed.classList.remove('rst', 'fade');
          later(() => {
            ph = 0;
            step();
          }, 500);
        }, 380);
      }, DUR[ph]);
    }
    const stop = () => {
      timers.forEach(clearTimeout);
      timers = [];
      clearInterval(capT);
    };
    if (reduce) set(5);
    else {
      set(-1);
      whenVisible(
        ed,
        () => {
          stop();
          ed.classList.remove('press', 'fade');
          ph = ph < 0 ? 0 : ph;
          later(step, ph === 0 ? 1500 : 0);
        },
        stop,
        0.3,
      );
    }
    onLang(() => (status.textContent = str(`ed.s${Math.max(0, ph)}`)));
  }

  // ---------- 01 Sessizlik kesimi ----------
  const cv = $('#wave');
  if (cv) {
    const ctx = cv.getContext('2d');
    const STEP = 0.04;
    const PAD = 0.06;
    // [tür, süre (sn), duraklamanın taban gürültüsü (dB)] — s: konuşma, p: duraklama, f: "ııı"
    const SCRIPT = [['s', 1.9], ['p', 0.9, -52], ['s', 1.5], ['f', 0.6], ['p', 0.45, -45], ['s', 2.1], ['p', 1.3, -58], ['s', 1.7], ['p', 0.35, -41], ['s', 1.2], ['f', 0.5], ['s', 1.4], ['p', 1.1, -48], ['s', 1.9], ['p', 0.6, -37], ['s', 1.5], ['p', 1.0, -54]];
    let seed = 13;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const samples = [];
    const segs = [];
    let total = 0;
    let li = 0;
    SCRIPT.forEach(([kind, dur, floor], si) => {
      const n = Math.round(dur / STEP);
      const t0 = total;
      for (let i = 0; i < n; i++) {
        let db;
        if (kind === 's') {
          db = -30 + Math.sin((i / n) * Math.PI) * 8 + Math.abs(Math.sin(i * 0.55 + si)) * 14 + rnd() * 6;
          if (rnd() < 0.05) db -= 11;
        } else if (kind === 'f') db = -25 + rnd() * 4 + Math.sin((i / n) * Math.PI) * 3;
        else db = floor + (rnd() - 0.5) * 5;
        samples.push({ db, kind });
      }
      total += n * STEP;
      segs.push({ kind, t0, t1: total, li: kind === 'p' ? -1 : li++ });
    });
    const th = $('#th');
    const mp = $('#mp');
    const fil = $('#fil');
    const cutBtn = $('#cutBtn');
    const undoBtn = $('#undoBtn');
    const cutBtnT = $('#cutBtnT');
    let regs = [];
    let c = 0; // 0: kesilmedi, 1: kesildi
    let thNow = Number(th.value);
    let anim = 0;

    function findRegions() {
      const out = [];
      const N = samples.length;
      const minLen = Number(mp.value) - 1e-6;
      for (let i = 0; i < N; ) {
        if (samples[i].db >= thNow) {
          i++;
          continue;
        }
        let j = i;
        while (j < N && samples[j].db < thNow) j++;
        if ((j - i) * STEP >= minLen) out.push({ a: i * STEP + PAD, b: j * STEP - PAD, f: false });
        i = j;
      }
      if (fil.checked) for (const s of segs) if (s.kind === 'f') out.push({ a: s.t0, b: s.t1, f: true });
      out.sort((p, q) => p.a - q.a);
      const merged = [];
      for (const r of out) {
        const last = merged[merged.length - 1];
        if (last && r.a <= last.b + 0.14) last.b = Math.max(last.b, r.b);
        else merged.push({ ...r });
      }
      return merged.filter((r) => r.b - r.a > 0.05);
    }
    const mapT = (t) => {
      let shift = 0;
      for (const r of regs) {
        if (t >= r.b) shift += (r.b - r.a) * c;
        else {
          if (t > r.a) shift += (t - r.a) * c;
          break;
        }
      }
      return t - shift;
    };
    const inCut = (t) => regs.some((r) => t >= r.a && t < r.b);

    function draw() {
      const dpr = Math.min(2, devicePixelRatio || 1);
      const W = cv.clientWidth;
      const H = cv.clientHeight;
      if (!W) return;
      if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) {
        cv.width = Math.round(W * dpr);
        cv.height = Math.round(H * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const padX = 16;
      const top = 44;
      const bot = 30;
      const iw = W - padX * 2;
      const ih = H - top - bot;
      const mid = top + ih / 2;
      const X = (t) => padX + (t / total) * iw;
      const amp = (db) => clamp((db + 62) / 58, 0.02, 1) * (ih / 2);

      // Eşik bandı: bu bandın içinde kalan ses "sessizlik" sayılır
      const ta = amp(thNow);
      ctx.fillStyle = 'rgba(255,255,255,0.035)';
      ctx.fillRect(padX, mid - ta, iw, ta * 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.32)';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(padX, Math.round(mid - ta) + 0.5);
      ctx.lineTo(padX + iw, Math.round(mid - ta) + 0.5);
      ctx.moveTo(padX, Math.round(mid + ta) + 0.5);
      ctx.lineTo(padX + iw, Math.round(mid + ta) + 0.5);
      ctx.stroke();
      ctx.setLineDash([]);

      // Kesilecek bölgeler
      for (const r of regs) {
        const x0 = X(mapT(r.a));
        const x1 = X(mapT(r.b));
        if (x1 - x0 < 0.5) continue;
        ctx.fillStyle = `rgba(244,63,94,${0.16 * (1 - c * 0.6)})`;
        ctx.fillRect(x0, top - 6, x1 - x0, ih + 12);
        ctx.fillStyle = `rgba(251,113,133,${0.9 * (1 - c)})`;
        ctx.fillRect(x0, top - 6, 1.5, ih + 12);
        ctx.fillRect(x1 - 1.5, top - 6, 1.5, ih + 12);
      }

      // Dalga çubukları
      const grad = ctx.createLinearGradient(0, top, 0, top + ih);
      grad.addColorStop(0, '#f472b6');
      grad.addColorStop(0.5, '#c084fc');
      grad.addColorStop(1, '#818cf8');
      const bw = Math.max(1, (iw / samples.length) * 0.62);
      samples.forEach((s, i) => {
        const t = i * STEP;
        const cut = inCut(t + STEP / 2);
        const x = X(mapT(t));
        const w = cut ? bw * (1 - c) : bw;
        if (w < 0.3) return;
        const a = amp(s.db);
        ctx.globalAlpha = cut ? 0.9 * (1 - c) : 1;
        ctx.fillStyle = cut ? '#fb7185' : s.kind === 'f' ? '#fbbf24' : s.db < thNow ? 'rgba(255,255,255,0.3)' : grad;
        ctx.fillRect(x, mid - a, w, a * 2);
      });
      ctx.globalAlpha = 1;

      // Kelimeler: hepsi sığıyorsa gösterilir (dar ekranda yarım yamalak görünmesin)
      const labels = str('w.words').split('|');
      const mono = getComputedStyle(root).getPropertyValue('--mono');
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.font = '600 11.5px Inter, system-ui, sans-serif';
      const speech = segs.filter((s) => s.kind === 's');
      const fits = speech.filter((s) => ctx.measureText(labels[s.li] ?? '').width <= X(mapT(s.t1)) - X(mapT(s.t0)) + 14).length;
      if (fits >= speech.length * 0.8) {
        ctx.fillStyle = 'rgba(246,244,251,0.62)';
        for (const s of speech) ctx.fillText(labels[s.li] ?? '', (X(mapT(s.t0)) + X(mapT(s.t1))) / 2, top - 16);
      }
      // "Iıı"lar: kendi çubuklarının hemen üstünde
      ctx.font = '700 11px Inter, system-ui, sans-serif';
      for (const s of segs) {
        if (s.kind !== 'f') continue;
        const gone = inCut((s.t0 + s.t1) / 2);
        const cx = (X(mapT(s.t0)) + X(mapT(s.t1))) / 2;
        const text = labels[s.li] ?? '';
        const ty = mid - amp(-21) - 7;
        const tw = ctx.measureText(text).width;
        ctx.globalAlpha = gone ? 1 - c : 1;
        ctx.fillStyle = 'rgba(10,9,16,0.88)';
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(cx - tw / 2 - 6, ty - 12, tw + 12, 17, 8);
        else ctx.rect(cx - tw / 2 - 6, ty - 12, tw + 12, 17);
        ctx.fill();
        ctx.fillStyle = gone ? '#fda4af' : '#fbbf24';
        ctx.fillText(text, cx, ty);
        if (gone) ctx.fillRect(cx - tw / 2 - 1, ty - 4.5, tw + 2, 1.5);
      }
      // Kesilecek duraklamaların süresi
      ctx.globalAlpha = 1 - c;
      ctx.font = `600 10.5px ${mono}`;
      ctx.fillStyle = '#fb7185';
      for (const r of regs) {
        if (r.f) continue;
        const x0 = X(mapT(r.a));
        const x1 = X(mapT(r.b));
        const text = `−${(r.b - r.a).toFixed(1)}s`;
        if (ctx.measureText(text).width < x1 - x0 - 4) ctx.fillText(text, (x0 + x1) / 2, top - 16);
      }
      ctx.globalAlpha = 1;

      // Eşik etiketi (alt satırın sağında) ve zaman cetveli
      ctx.font = `500 10px ${mono}`;
      const thText = `${str('w.th')} ${Math.round(thNow)} dB`.replace('-', '−');
      const thW = ctx.measureText(thText).width;
      ctx.textAlign = 'right';
      ctx.fillStyle = 'rgba(246,244,251,0.7)';
      ctx.fillText(thText, padX + iw, H - 10);
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(246,244,251,0.34)';
      const every = iw < 520 ? 5 : 2;
      for (let t = every; t < total; t += every) if (X(t) < padX + iw - thW - 18) ctx.fillText(`${t}s`, X(t), H - 10);

      // Kesim sonrası boşalan yer
      const removed = regs.reduce((n, r) => n + (r.b - r.a), 0);
      if (c > 0.02 && removed > 0) {
        const x0 = X(total - removed * c) + 6;
        const x1 = X(total);
        if (x1 - x0 > 8) {
          ctx.globalAlpha = c;
          ctx.strokeStyle = 'rgba(196,181,253,0.55)';
          ctx.setLineDash([5, 5]);
          ctx.strokeRect(x0 + 0.5, top + 0.5, x1 - x0 - 1, ih - 1);
          ctx.setLineDash([]);
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          const big = `−${removed.toFixed(1)}s`;
          ctx.font = `800 ${Math.min(26, (x1 - x0) / 3.4)}px Poppins, sans-serif`;
          ctx.fillStyle = '#e9d5ff';
          if (x1 - x0 > 54) ctx.fillText(big, (x0 + x1) / 2, mid);
          ctx.globalAlpha = 1;
          ctx.textBaseline = 'alphabetic';
        }
      }
    }
    function stats() {
      const removed = regs.reduce((n, r) => n + (r.b - r.a), 0);
      $('#wsCuts').textContent = regs.length;
      $('#wsSaved').textContent = `${removed.toFixed(1)}s`;
      $('#wsLen').textContent = `${(total - removed).toFixed(1)}s`;
      $('#wsPct').textContent = `${removed > 0 ? '−' : ''}${Math.round((removed / total) * 100)}%`;
      $('#thOut').textContent = `${Math.round(thNow)} dB`.replace('-', '−');
      $('#mpOut').textContent = `${Number(mp.value).toFixed(2)} s`;
      cutBtn.disabled = c > 0 || !regs.length;
      undoBtn.disabled = c === 0;
      cutBtnT.textContent = c >= 1 ? str('w.done') : str('w.cut');
    }
    function update() {
      regs = findRegions();
      stats();
      draw();
    }
    function animate(to, ms) {
      cancelAnimationFrame(anim);
      const from = c;
      if (reduce) {
        c = to;
        return update(), stats();
      }
      const t0 = performance.now();
      const run = (t) => {
        const k = clamp((t - t0) / ms, 0, 1);
        const e = k < 0.5 ? 4 * k ** 3 : 1 - (-2 * k + 2) ** 3 / 2;
        c = from + (to - from) * e;
        draw();
        if (k < 1) anim = requestAnimationFrame(run);
        else stats();
      };
      cutBtn.disabled = true;
      undoBtn.disabled = true;
      anim = requestAnimationFrame(run);
    }
    const change = () => {
      cancelAnimationFrame(anim);
      c = 0;
      thNow = Number(th.value);
      update();
    };
    th.addEventListener('input', change);
    mp.addEventListener('input', change);
    fil.addEventListener('change', change);
    cutBtn.addEventListener('click', () => animate(1, 1000));
    undoBtn.addEventListener('click', () => animate(0, 600));
    new ResizeObserver(draw).observe(cv);
    onLang(() => (stats(), draw()));
    document.fonts?.ready.then(draw);
    update();
    // İlk görünüşte eşik kendiliğinden yerine otursun: neyin değiştiği anlaşılır
    if (!reduce) {
      thNow = -62;
      update();
      onceVisible(cv, () => {
        const target = Number(th.value);
        const t0 = performance.now();
        const run = (t) => {
          const k = clamp((t - t0) / 1100, 0, 1);
          if (Number(th.value) !== target || c > 0) return;
          thNow = -62 + (target + 62) * (1 - (1 - k) ** 3);
          update();
          if (k < 1) requestAnimationFrame(run);
        };
        requestAnimationFrame(run);
      });
    }
  }

  // ---------- 02 Altyazı ----------
  const capLine = $('#capLine');
  if (capLine) {
    const shot = $('#capShot');
    const PHR = {
      en: [['nobody', 'tells', 'you'], ['how', 'long'], ['editing', 'really', 'takes']],
      tr: [['kimse', 'söylemez'], ['kurgunun'], ['ne', 'kadar', 'sürdüğünü']],
      es: [['nadie', 'te', 'dice'], ['cuánto', 'tarda'], ['la', 'edición']],
      de: [['niemand', 'sagt', 'dir'], ['wie', 'lange'], ['der', 'Schnitt', 'dauert']],
      fr: [['personne', 'ne', 'dit'], ['combien', 'de', 'temps'], ['prend', 'le', 'montage']],
    };
    let cl = 'en';
    let pi = 0;
    let wi = 0;
    let timer = 0;
    const mark = () =>
      [...capLine.children].forEach((s, i) => {
        s.classList.toggle('hot', i === wi);
        s.classList.toggle('said', i < wi);
      });
    const render = () => {
      capLine.lang = cl;
      capLine.innerHTML = PHR[cl][pi].map((w, i) => `<span style="--i:${i}">${w}</span>`).join(' ');
      mark();
    };
    const next = () => {
      if (++wi >= PHR[cl][pi].length) {
        pi = (pi + 1) % PHR[cl].length;
        wi = 0;
        render();
      } else mark();
    };
    render();
    whenVisible(shot, () => (clearInterval(timer), (timer = setInterval(next, 430))), () => clearInterval(timer), 0.2);
    pick($('#capStyles'), (b) => {
      capLine.className = `capline st-${b.dataset.s}`;
      wi = 0;
      render();
    });
    pick($('#capAcc'), (b) => capLine.style.setProperty('--acc', b.dataset.c));
    pick($('#capPos'), (b) => (shot.dataset.pos = b.dataset.p));
    pick($('#capLang'), (b) => {
      cl = b.dataset.l;
      pi = 0;
      wi = 0;
      render();
    });
  }

  // ---------- 03 Renk ----------
  const cmp = $('#cmp');
  if (cmp) {
    const ID = [0, 0.25, 0.5, 0.75, 1];
    // Görünümler: doygunluk + kanal başına ton eğrisi (gölgeden parlağa 5 nokta)
    const LOOKS = {
      natural: { s: 1, r: ID, g: ID, b: ID },
      teal: { s: 1.16, r: [0, 0.2, 0.52, 0.82, 1], g: [0.02, 0.26, 0.5, 0.74, 0.97], b: [0.1, 0.33, 0.49, 0.66, 0.86] },
      warm: { s: 0.96, r: [0.05, 0.31, 0.57, 0.81, 0.99], g: [0.03, 0.26, 0.5, 0.74, 0.95], b: [0.02, 0.19, 0.41, 0.64, 0.84] },
      cool: { s: 0.94, r: [0, 0.2, 0.44, 0.69, 0.93], g: [0.01, 0.25, 0.5, 0.75, 0.98], b: [0.06, 0.32, 0.58, 0.82, 1] },
      matte: { s: 0.8, r: [0.1, 0.3, 0.5, 0.71, 0.9], g: [0.1, 0.3, 0.5, 0.71, 0.9], b: [0.12, 0.31, 0.5, 0.7, 0.88] },
      vivid: { s: 1.42, r: [0, 0.19, 0.5, 0.83, 1], g: [0, 0.19, 0.5, 0.83, 1], b: [0, 0.19, 0.5, 0.83, 1] },
      vintage: { s: 0.68, r: [0.09, 0.33, 0.57, 0.79, 0.95], g: [0.07, 0.29, 0.51, 0.72, 0.9], b: [0.11, 0.27, 0.42, 0.59, 0.77] },
      night: { s: 0.78, r: [0, 0.13, 0.33, 0.57, 0.82], g: [0, 0.19, 0.42, 0.66, 0.89], b: [0.06, 0.31, 0.57, 0.81, 1] },
      pastel: { s: 0.74, r: [0.14, 0.38, 0.6, 0.8, 0.96], g: [0.13, 0.36, 0.58, 0.78, 0.95], b: [0.16, 0.38, 0.59, 0.78, 0.94] },
      bw: { s: 0, r: [0, 0.19, 0.5, 0.83, 1], g: [0, 0.19, 0.5, 0.83, 1], b: [0, 0.19, 0.5, 0.83, 1] },
    };
    // Log profilleri: ne kadar düz ve soluk göründükleri (yaklaşık; gerçek dönüşüm eklentide yapılır)
    const CAMS = {
      slog3: { n: 'S-LOG3', s: 0.36, c: [0.2, 0.36, 0.5, 0.62, 0.72], t: [1, 1, 1] },
      vlog: { n: 'V-LOG', s: 0.42, c: [0.17, 0.34, 0.5, 0.64, 0.76], t: [0.98, 1.02, 0.98] },
      clog3: { n: 'C-LOG3', s: 0.5, c: [0.12, 0.31, 0.51, 0.68, 0.82], t: [1.02, 1, 0.97] },
      flog2: { n: 'F-LOG2', s: 0.38, c: [0.19, 0.35, 0.5, 0.63, 0.74], t: [0.99, 1, 1.02] },
      nlog: { n: 'N-LOG', s: 0.44, c: [0.16, 0.34, 0.5, 0.65, 0.78], t: [1, 1, 0.98] },
      dlog: { n: 'D-LOG', s: 0.52, c: [0.11, 0.3, 0.51, 0.7, 0.85], t: [1, 1.01, 1] },
      applelog: { n: 'APPLE LOG', s: 0.46, c: [0.15, 0.33, 0.5, 0.66, 0.79], t: [1, 1, 1] },
      bmd: { n: 'BMD FILM', s: 0.42, c: [0.17, 0.34, 0.5, 0.64, 0.76], t: [1.01, 1, 0.98] },
      logc4: { n: 'LOGC4', s: 0.38, c: [0.2, 0.36, 0.5, 0.62, 0.73], t: [1, 1, 1.01] },
      log3g10: { n: 'LOG3G10', s: 0.36, c: [0.21, 0.37, 0.5, 0.61, 0.71], t: [1.01, 1, 1] },
    };
    const table = (id, arr) => $(`#${id}`).setAttribute('tableValues', arr.map((v) => clamp(v, 0, 1).toFixed(3)).join(' '));
    const cam = $('#cam');
    const ls = $('#ls');
    let look = 'natural';
    function applyLook() {
      const L = LOOKS[look];
      const k = ls.value / 100;
      $('#gS').setAttribute('values', (1 + (L.s - 1) * k).toFixed(3));
      table('gR', L.r.map((v, i) => ID[i] + (v - ID[i]) * k));
      table('gG', L.g.map((v, i) => ID[i] + (v - ID[i]) * k));
      table('gB', L.b.map((v, i) => ID[i] + (v - ID[i]) * k));
      $('#lookLabel').textContent = str(`look.${look}`);
      $('#lsOut').textContent = `${ls.value}%`;
    }
    function applyCam() {
      const p = CAMS[cam.value];
      $('#lS').setAttribute('values', p.s);
      table('lR', p.c.map((v) => v * p.t[0]));
      table('lG', p.c.map((v) => v * p.t[1]));
      table('lB', p.c.map((v) => v * p.t[2]));
      $('#logLabel').textContent = p.n;
    }
    cam.addEventListener('change', applyCam);
    ls.addEventListener('input', applyLook);
    pick($('#looks'), (b) => {
      look = b.dataset.k;
      applyLook();
    });
    for (const b of $$('#fx button'))
      b.addEventListener('click', () => {
        const on = b.classList.toggle('on');
        $(`.fx[data-fx="${b.dataset.fx}"]`, cmp).classList.toggle('on', on);
      });
    onLang(applyLook);
    applyCam();
    applyLook();

    let pos = 50;
    let drag = false;
    const setP = (p) => {
      pos = clamp(p, 3, 97);
      cmp.style.setProperty('--p', `${pos}%`);
      cmp.setAttribute('aria-valuenow', Math.round(pos));
    };
    const move = (x) => {
      const r = cmp.getBoundingClientRect();
      setP(((x - r.left) / r.width) * 100);
    };
    cmp.addEventListener('pointerdown', (e) => {
      drag = true;
      cmp.setPointerCapture(e.pointerId);
      move(e.clientX);
    });
    cmp.addEventListener('pointermove', (e) => drag && move(e.clientX));
    cmp.addEventListener('pointerup', () => (drag = false));
    cmp.addEventListener('pointercancel', () => (drag = false));
    cmp.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') setP(pos - 4);
      else if (e.key === 'ArrowRight') setP(pos + 4);
      else return;
      e.preventDefault();
    });
    // İlk görünüşte kendiliğinden bir kez kaysın
    if (!reduce) {
      onceVisible(cmp, () => {
        const t0 = performance.now();
        const run = (t) => {
          const k = (t - t0) / 2400;
          if (k >= 1 || drag) return;
          setP(50 + Math.sin(k * Math.PI * 2) * 30);
          requestAnimationFrame(run);
        };
        requestAnimationFrame(run);
      }, 0.5);
    }
  }

  // ---------- 04 Alt bant ----------
  const lt = $('#lt');
  if (lt) {
    const play = () => {
      lt.classList.remove('play');
      void lt.offsetWidth;
      lt.classList.add('play');
    };
    const bind = (input, out) => $(input).addEventListener('input', (e) => ($(out).textContent = e.target.value || ' '));
    bind('#ltNameIn', '#ltName');
    bind('#ltRoleIn', '#ltRole');
    // Varsayılan ünvan sayfa diline uyar (büyük harfe çevrilirken İ/I doğru çıksın)
    const ROLES = { en: 'Filmmaker', tr: 'Yönetmen' };
    onLang(() => {
      const input = $('#ltRoleIn');
      if (!Object.values(ROLES).includes(input.value)) return;
      input.value = ROLES[lang];
      $('#ltRole').textContent = ROLES[lang];
    });
    let style = 'line';
    pick($('#ltStyles'), (b) => {
      style = b.dataset.s;
      lt.className = `lt st-${style}`;
      play();
    });
    pick($('#ltAcc'), (b) => lt.style.setProperty('--acc', b.dataset.c));
    $('#ltLogo').addEventListener('change', (e) => {
      $('.lt-logo', lt).hidden = !e.target.checked;
      play();
    });
    $('#ltReplay').addEventListener('click', play);
    if (reduce) lt.classList.add('play');
    else onceVisible(lt, play, 0.5);
  }

  // ---------- Fiyat ----------
  const bill = $('#bill');
  if (bill) {
    const P = C.PRICES ?? { currency: '$', monthly: 12, yearly: 96 };
    let period = 'yearly';
    const fmt = (n) => `${P.currency}${Number.isInteger(n) ? n : n.toFixed(2)}`;
    const save = Math.round((1 - P.yearly / (P.monthly * 12)) * 100);
    const paint = () => {
      $('#price').textContent = fmt(period === 'yearly' ? Math.round((P.yearly / 12) * 100) / 100 : P.monthly);
      $('#trialPrice').textContent = `${P.currency}0`;
      $('#priceNote').textContent = period === 'yearly' ? str('pr.billedY').replace('{p}', fmt(P.yearly)) : str('pr.billedM');
      $('#save').textContent = save > 0 ? `−${save}%` : '';
      $('#buy').href = `signup.html?plan=pro&period=${period}`;
      for (const b of $$('button', bill)) b.classList.toggle('on', b.dataset.p === period);
    };
    for (const b of $$('button', bill)) b.addEventListener('click', () => ((period = b.dataset.p), paint()));
    onLang(paint);
    paint();
  }

  applyLang(lang);
  frame();
})();
