// Makas AI — site etkileşimleri: açılış, kaydırma animasyonları, canlı gösterim, fiyat, dil.
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
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

  // --- Dil ---
  const T = window.MAKAS_TR ?? {};
  const EN = new Map();
  const getLang = () => store.get('makas-lang') || ((navigator.language || '').toLowerCase().startsWith('tr') ? 'tr' : 'en');
  function applyLang(lang) {
    document.documentElement.lang = lang;
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
  window.makasLang = getLang;
  window.makasT = (k, en) => (getLang() === 'tr' && T[k] != null ? T[k] : en);
  for (const b of $$('#lang button')) b.addEventListener('click', () => applyLang(b.dataset.lang));
  applyLang(getLang());

  // --- Açılış perdesi ---
  requestAnimationFrame(() => setTimeout(() => document.body.classList.add('loaded'), 60));
  const y = $('#year');
  if (y) y.textContent = new Date().getFullYear();

  // --- Menü ---
  const nav = $('#nav');
  $('#burger')?.addEventListener('click', () => nav.classList.toggle('open'));
  for (const a of $$('.nav nav a')) a.addEventListener('click', () => nav.classList.remove('open'));
  // Oturum açıksa menüde "Hesabım"
  if (store.get('makas-session')) {
    for (const a of $$('[data-auth="out"]')) {
      a.href = 'account.html';
      a.dataset.i18n = 'nav.account';
      a.textContent = window.makasT('nav.account', 'My account');
      EN.set(a, 'My account');
    }
  }

  // --- Kaydırma: ilerleme çubuğu, menü zemini, 3B yığın ---
  const progress = $('#progress');
  const stack = $('#stack');
  let mx = 0;
  let my = 0;
  let ticking = false;
  function frame() {
    ticking = false;
    const sy = scrollY;
    const max = document.documentElement.scrollHeight - innerHeight;
    if (progress) progress.style.transform = `scaleX(${max > 0 ? sy / max : 0})`;
    nav?.classList.toggle('scrolled', sy > 20);
    if (stack && !reduce) {
      const k = Math.min(1, sy / innerHeight);
      stack.style.setProperty('--rx', `${mx * 10 + k * 16}deg`);
      stack.style.setProperty('--ry', `${-my * 7 - k * 8}deg`);
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
        b.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.18}px, ${(e.clientY - r.top - r.height / 2) * 0.3}px)`;
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
  frame();

  // --- Görününce belirme ---
  const io = new IntersectionObserver(
    (es) => {
      for (const e of es) {
        if (!e.isIntersecting) continue;
        e.target.classList.add('in');
        io.unobserve(e.target);
        const n = e.target.querySelector?.('[data-count]') ?? (e.target.matches?.('[data-count]') ? e.target : null);
        if (n) count(n);
      }
    },
    { threshold: 0.15, rootMargin: '0px 0px -6% 0px' },
  );
  for (const el of $$('.rv')) io.observe(el);
  function count(el) {
    const to = Number(el.dataset.count);
    const suf = el.dataset.suffix ?? '';
    if (reduce) return void (el.textContent = to + suf);
    const t0 = performance.now();
    const step = (t) => {
      const k = Math.min(1, (t - t0) / 1400);
      el.textContent = Math.round(to * (1 - (1 - k) ** 3)) + suf;
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  // --- Kayan şerit: içeriği ikiye katla (kesintisiz döngü) ---
  const mq = $('#marquee');
  if (mq) mq.innerHTML += mq.innerHTML;

  // --- Canlı gösterim ---
  const demo = $('#demoBox');
  if (demo) {
    // Dalga biçimi çubukları (her açılışta aynı görünsün diye sabit tohum)
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (const seg of $$('#wave .seg')) {
      const gap = seg.classList.contains('gap');
      const n = Math.round(Number(seg.dataset.n) * 1.5);
      seg.innerHTML = Array.from({ length: n }, (_, i) => `<u style="--h:${gap ? 4 + rnd() * 5 : 22 + Math.abs(Math.sin(i * 0.7)) * 40 + rnd() * 34}%"></u>`).join('');
    }
    const steps = $$('#steps .step');
    const order = [0, 1, 2, 3, 4, 5];
    const dur = { 0: 1100, 1: 1500, 2: 1700, 3: 2600, 4: 2600, 5: 3000 };
    const labelOf = (s) => (s <= 2 ? 0 : s - 2); // 1-2 → kes, 3 → altyazı, 4 → renk, 5 → başlık
    let idx = 0;
    let timer = null;
    let capTimer = null;
    const words = $$('#cap span');
    function set(s) {
      demo.dataset.step = String(s);
      steps.forEach((b, i) => {
        const on = s > 0 && labelOf(s) === i;
        if (on && !b.classList.contains('on')) b.style.setProperty('--dur', `${(s === 1 ? dur[1] + dur[2] : dur[s]) / 1000}s`);
        b.classList.toggle('on', on);
      });
      clearInterval(capTimer);
      words.forEach((w) => w.classList.remove('hot'));
      if (s >= 3) {
        let w = 0;
        words[0].classList.add('hot');
        capTimer = setInterval(() => {
          words.forEach((x) => x.classList.remove('hot'));
          words[++w % words.length].classList.add('hot');
        }, 520);
      }
    }
    function run() {
      set(order[idx]);
      timer = setTimeout(() => {
        idx = (idx + 1) % order.length;
        run();
      }, dur[order[idx]]);
    }
    steps.forEach((b) =>
      b.addEventListener('click', () => {
        clearTimeout(timer);
        idx = order.indexOf(Number(b.dataset.go));
        run();
      }),
    );
    if (reduce) set(5);
    else {
      new IntersectionObserver(
        ([e]) => {
          clearTimeout(timer);
          if (e.isIntersecting) run();
        },
        { threshold: 0.35 },
      ).observe(demo);
    }
  }

  // --- Özellikler: yapışkan ekran ---
  const frameEl = $('#frame');
  if (frameEl) {
    const feats = $$('.feat');
    const fio = new IntersectionObserver(
      (es) => {
        for (const e of es) {
          if (!e.isIntersecting) continue;
          feats.forEach((f) => f.classList.toggle('on', f === e.target));
          for (const img of $$('img', frameEl)) img.classList.toggle('on', img.dataset.shot === e.target.dataset.shot);
          const i = feats.indexOf(e.target);
          frameEl.style.transform = `rotateY(${-9 + i * 6}deg) rotateX(${3 - i}deg)`;
        }
      },
      { rootMargin: '-45% 0px -45% 0px' },
    );
    feats.forEach((f) => fio.observe(f));
    feats[0]?.classList.add('on');
  }

  // --- Önce / sonra ---
  const cmp = $('#compare');
  if (cmp) {
    const move = (x) => {
      const r = cmp.getBoundingClientRect();
      cmp.style.setProperty('--p', `${Math.max(4, Math.min(96, ((x - r.left) / r.width) * 100))}%`);
    };
    let drag = false;
    cmp.addEventListener('pointerdown', (e) => {
      drag = true;
      cmp.setPointerCapture(e.pointerId);
      move(e.clientX);
    });
    cmp.addEventListener('pointermove', (e) => drag && move(e.clientX));
    cmp.addEventListener('pointerup', () => (drag = false));
    cmp.addEventListener('pointercancel', () => (drag = false));
    // İlk görünüşte kendiliğinden bir kez kaysın
    if (!reduce) {
      new IntersectionObserver(
        ([e], o) => {
          if (!e.isIntersecting) return;
          o.disconnect();
          const t0 = performance.now();
          const anim = (t) => {
            const k = (t - t0) / 2200;
            if (k >= 1 || drag) return;
            cmp.style.setProperty('--p', `${50 + Math.sin(k * Math.PI * 2) * 26}%`);
            requestAnimationFrame(anim);
          };
          requestAnimationFrame(anim);
        },
        { threshold: 0.5 },
      ).observe(cmp);
    }
    const after = $('#afterScene');
    const label = $('#lookLabel');
    for (const b of $$('#looks button')) {
      b.addEventListener('click', () => {
        $$('#looks button').forEach((x) => x.classList.toggle('on', x === b));
        after.style.filter = b.dataset.f;
        label.textContent = b.dataset.n;
      });
    }
  }

  // --- Fiyat ---
  const bill = $('#bill');
  if (bill) {
    const P = C.PRICES ?? { currency: '$', monthly: 12, yearly: 96 };
    let period = 'yearly';
    const fmt = (n) => `${P.currency}${Number.isInteger(n) ? n : n.toFixed(2)}`;
    const save = Math.round((1 - P.yearly / (P.monthly * 12)) * 100);
    function paint() {
      const tr = getLang() === 'tr';
      $('#price').textContent = fmt(period === 'yearly' ? Math.round((P.yearly / 12) * 100) / 100 : P.monthly);
      $('#trialPrice').textContent = `${P.currency}0`;
      $('#priceNote').textContent = period === 'yearly' ? (tr ? `Yıllık ${fmt(P.yearly)} olarak faturalanır` : `Billed ${fmt(P.yearly)} yearly`) : tr ? 'Aylık faturalanır' : 'Billed monthly';
      $('#save').textContent = save > 0 ? `−${save}%` : '';
      $('#buy').href = `signup.html?plan=pro&period=${period}`;
      for (const b of $$('button', bill)) b.classList.toggle('on', b.dataset.p === period);
    }
    for (const b of $$('button', bill)) b.addEventListener('click', () => ((period = b.dataset.p), paint()));
    document.addEventListener('makas-lang', paint);
    paint();
  }
})();
