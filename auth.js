// Makas AI — hesap sayfaları: kayıt, giriş, şifre sıfırlama, hesap paneli.
// Lisans sunucusu (config.js → API) tanımlı değilse sayfalar "yakında" kipinde çalışır.
(() => {
  const $ = (s) => document.querySelector(s);
  const C = window.MAKAS ?? {};
  const API = String(C.API || '').replace(/\/+$/, '');
  const t = (k, en) => window.makasT?.(k, en) ?? en;
  const tr = () => window.makasLang?.() === 'tr';
  const msg = (text, kind = 'err') => {
    const el = $('#msg');
    if (!el) return;
    el.className = `msg show ${kind}`;
    el.textContent = text;
  };
  const session = {
    get: () => window.makasStore?.get('makas-session') ?? null,
    set: (v) => window.makasStore?.set('makas-session', v),
    clear: () => {
      try {
        localStorage.removeItem('makas-session');
      } catch {
        /* yoksay */
      }
    },
  };
  /** Menüde plan ve kalan günü gösterebilmek için küçük özet (e-posta saklanmaz). */
  const remember = (a) => window.makasStore?.set('makas-account', JSON.stringify({ plan: a.plan, until: a.until }));
  const forget = () => {
    try {
      localStorage.removeItem('makas-account');
    } catch {
      /* yoksay */
    }
  };
  const soon = () => msg(tr() ? 'Hesaplar çok yakında açılıyor. Haberdar olmak için @makasai.co hesabını takip edin.' : 'Accounts open at launch. Follow @makasai.co to hear first.', 'info');

  async function post(path, body) {
    let r;
    try {
      r = await fetch(`${API}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    } catch {
      throw new Error(tr() ? 'Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edin.' : 'Could not reach the server. Check your connection.');
    }
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(data.error || (tr() ? 'Bir şeyler ters gitti.' : 'Something went wrong.')), { status: r.status, data });
    return data;
  }
  const busy = (form, on) => {
    const b = form.querySelector('button[type=submit]');
    b.disabled = on;
    b.style.opacity = on ? 0.6 : 1;
  };
  const validEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  const lang = () => (tr() ? 'tr' : 'en');

  // --- Kayıt ---
  // Kapalı test: kayıt kipi sunucudan okunur (açık / davet koduyla / kapalı); okunamazsa config.js'teki geçerlidir
  let gate = C.SIGNUP || 'acik';
  const paintGate = () => {
    const f = $('#signupForm');
    if (!f) return;
    const invite = gate === 'davet';
    const closed = gate === 'kapali';
    $('#inviteRow').hidden = !invite;
    const note = $('#gateNote');
    note.hidden = !invite && !closed;
    note.textContent = closed
      ? tr() ? 'Makas şu an kapalı testte ve yeni kayıt almıyor. Çok yakında açılacak.' : 'Makas is in a closed test and is not accepting new accounts yet. Opening soon.'
      : tr() ? 'Makas şu an kapalı testte: kayıt için davet kodu gerekiyor.' : 'Makas is in a closed test: you need an invite code to sign up.';
    for (const el of f.querySelectorAll('input:not([name=makas_hp]), button[type=submit]')) el.disabled = closed;
  };
  if ($('#signupForm')) {
    paintGate();
    new MutationObserver(paintGate).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
    if (API) post('/web/config', {}).then((r) => ((gate = r.signup || gate), paintGate())).catch(() => {});
  }
  $('#signupForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    if (gate === 'kapali') return;
    const email = f.email.value.trim();
    if (!validEmail(email)) return msg(tr() ? 'Geçerli bir e-posta yazın.' : 'Enter a valid email address.');
    if (f.password.value.length < 8) return msg(tr() ? 'Şifre en az 8 karakter olmalı.' : 'Password must be at least 8 characters.');
    if (f.password.value !== f.password2.value) return msg(tr() ? 'Şifreler aynı değil.' : 'Passwords do not match.');
    const invite = (f.invite?.value ?? '').trim();
    if (gate === 'davet' && !invite) return msg(tr() ? 'Davet kodunu yazın.' : 'Enter your invite code.');
    if (!API) return soon();
    busy(f, true);
    try {
      const r = await post('/web/register', { email, password: f.password.value, lang: lang(), hp: f.makas_hp?.value ?? '', invite });
      session.set(r.session);
      remember(r);
      const q = new URLSearchParams(location.search);
      location.href = q.get('plan') === 'pro' ? `account.html?buy=${q.get('period') || 'yearly'}` : r.trialDenied ? 'account.html?notrial=1' : 'account.html?welcome=1';
    } catch (err) {
      msg(err.message);
    } finally {
      busy(f, false);
    }
  });

  // --- Giriş ---
  $('#loginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    if (!validEmail(f.email.value.trim()) || !f.password.value) return msg(tr() ? 'E-posta ve şifrenizi yazın.' : 'Enter your email and password.');
    if (!API) return soon();
    busy(f, true);
    try {
      const r = await post('/web/login', { email: f.email.value.trim(), password: f.password.value });
      session.set(r.session);
      remember(r);
      location.href = 'account.html';
    } catch (err) {
      msg(err.message);
    } finally {
      busy(f, false);
    }
  });

  // --- Şifre sıfırlama: önce kod, sonra yeni şifre ---
  const reset = $('#resetForm');
  if (reset) {
    let step = 1;
    reset.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = reset.email.value.trim();
      if (!validEmail(email)) return msg(tr() ? 'Geçerli bir e-posta yazın.' : 'Enter a valid email address.');
      if (!API) return soon();
      busy(reset, true);
      try {
        if (step === 1) {
          await post('/web/reset/start', { email, lang: lang() });
          step = 2;
          $('#resetStep2').hidden = false;
          $('#resetBtn').textContent = tr() ? 'Şifreyi değiştir' : 'Change password';
          msg(tr() ? 'Kod gönderildi. E-postanızı kontrol edin.' : 'Code sent. Check your email.', 'ok');
        } else {
          if (reset.password.value.length < 8) return msg(tr() ? 'Şifre en az 8 karakter olmalı.' : 'Password must be at least 8 characters.');
          const r = await post('/web/reset/finish', { email, code: reset.code.value.trim(), password: reset.password.value });
          session.set(r.session);
          remember(r);
          location.href = 'account.html';
        }
      } catch (err) {
        msg(err.message);
      } finally {
        busy(reset, false);
      }
    });
  }

  // --- Hesap paneli ---
  const acc = $('#account');
  if (acc) {
    const demo = !API;
    if (!demo && !session.get()) return void (location.href = 'login.html');
    const q = new URLSearchParams(location.search);
    const DAY = 86400000;
    const P = C.PRICES ?? { currency: '$', monthly: 12, yearly: 96 };
    const money = (n) => `${P.currency}${Number.isInteger(n) ? n : n.toFixed(2)}`;
    const fmtDate = (ms) => new Date(ms).toLocaleDateString(tr() ? 'tr-TR' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' });
    let period = q.get('buy') === 'monthly' ? 'monthly' : 'yearly';
    function paint(a) {
      if (!demo) remember(a);
      $('#accEmail').textContent = a.email;
      const pro = a.plan === 'pro';
      const trial = a.plan === 'trial';
      const days = Math.max(0, Math.ceil((a.until - Date.now()) / DAY));
      $('#planPill').textContent = pro ? 'Pro' : trial ? (tr() ? 'Deneme' : 'Trial') : tr() ? 'Süresi doldu' : 'Expired';

      // Kalan süre: büyük ve net
      $('#accStatus').hidden = false;
      $('#accStatus').className = `acc-status ${a.plan}`;
      $('#accDays').textContent = pro
        ? tr() ? 'Makas Pro etkin' : 'Makas Pro is active'
        : trial
          ? tr() ? `Denemenizin bitmesine ${days} gün kaldı` : `${days} day${days === 1 ? '' : 's'} left in your trial`
          : a.createdAt && a.until < a.createdAt
            ? tr() ? 'Bu hesapta ücretsiz deneme yok' : 'This account has no free trial'
            : tr() ? 'Deneme süreniz bitti' : 'Your trial has ended';
      $('#accUntil').textContent = pro
        ? `${tr() ? 'Yenilenme:' : 'Renews on'} ${fmtDate(a.until)}`
        : trial
          ? `${tr() ? 'Bitiş:' : 'Ends on'} ${fmtDate(a.until)}`
          : tr() ? 'Devam etmek için Makas Pro’ya geçin.' : 'Get Makas Pro to keep editing.';
      $('#accBar').style.width = `${pro ? 100 : trial ? Math.min(100, (days / 7) * 100) : 0}%`;

      // Plan: dönem seçimi ve satın alma
      const canPay = a.payments !== false; // eski sunucu bu alanı göndermez: açık varsay
      $('#planText').textContent = pro
        ? tr() ? `Makas Pro${a.subPeriod ? (a.subPeriod === 'aylik' ? ' · aylık' : ' · yıllık') : ''}: tüm özellikler açık.` : `Makas Pro${a.subPeriod ? (a.subPeriod === 'aylik' ? ' · monthly' : ' · yearly') : ''}: every feature unlocked.`
        : tr() ? 'Makas Pro: tüm özellikler, 2 cihaz, SFX kütüphanesi ve güncellemeler.' : 'Makas Pro: every feature, 2 devices, SFX library and updates.';
      $('#plans').hidden = pro;
      $('#pmPrice').textContent = `${money(P.monthly)}${tr() ? ' / ay' : ' / mo'}`;
      $('#pyPrice').textContent = `${money(Math.round((P.yearly / 12) * 100) / 100)}${tr() ? ' / ay' : ' / mo'}`;
      const save = Math.round((1 - P.yearly / (P.monthly * 12)) * 100);
      $('#pySave').textContent = save > 0 ? `−${save}%` : '';
      const pickPeriod = () => document.querySelectorAll('.acc-plan').forEach((b) => b.classList.toggle('on', b.dataset.period === period));
      document.querySelectorAll('.acc-plan').forEach((b) => (b.onclick = () => ((period = b.dataset.period), pickPeriod())));
      pickPeriod();
      $('#planBtn').hidden = pro;
      $('#planBtnText').textContent = canPay ? (tr() ? 'Makas Pro’ya geç' : 'Get Makas Pro') : tr() ? 'Ödeme yakında açılıyor' : 'Checkout opens soon';
      $('#planBtn').style.opacity = canPay ? 1 : 0.55;
      $('#planBtn').onclick = async (e) => {
        e.preventDefault();
        if (demo) return soon();
        if (!canPay) return msg(tr() ? 'Ödeme sayfası çok yakında açılıyor. Denemeniz bitmeden haber vereceğiz.' : 'Checkout opens very soon. We will let you know before your trial ends.', 'info');
        try {
          const r = await post('/checkout', { session: session.get(), period: period === 'monthly' ? 'aylik' : 'yillik' });
          location.href = r.url;
        } catch (err) {
          msg(err.message);
        }
      };

      // Ödeme ve faturalar: kart bilgisi ödeme sağlayıcısında durur
      const hasSub = pro && a.hasSubscription !== false;
      $('#billText').textContent = hasSub
        ? tr() ? 'Kartınızı değiştirin, faturalarınızı indirin ya da aboneliği iptal edin.' : 'Change your card, download invoices or cancel your subscription.'
        : pro
          ? tr() ? 'Bu hesaba süre elle tanımlandı; ödeme yöntemi yok.' : 'Access on this account was granted manually; there is no payment method.'
          : tr() ? 'Henüz bir ödeme yönteminiz yok. Makas Pro’ya geçtiğinizde kartınız ve faturalarınız burada görünür.' : 'No payment method yet. Your card and invoices appear here once you get Makas Pro.';
      $('#billBtn').hidden = !hasSub;
      $('#billBtn').onclick = async (e) => {
        e.preventDefault();
        if (demo) return soon();
        try {
          const r = await post('/portal', { session: session.get() });
          location.href = r.url;
        } catch (err) {
          msg(err.message);
        }
      };

      const list = $('#devices');
      list.innerHTML = '';
      if (!a.devices?.length) list.innerHTML = `<p>${tr() ? 'Henüz cihaz yok. Eklentiyi kurup giriş yapınca burada görünür (en fazla 2).' : 'No devices yet. They appear here after you sign in inside the plugin (up to 2).'}</p>`;
      for (const d of a.devices ?? []) {
        const row = document.createElement('div');
        row.className = 'dev';
        const name = document.createElement('span');
        name.textContent = `${d.name || (tr() ? 'Bilgisayar' : 'Computer')} · ${d.platform === 'darwin' ? 'macOS' : d.platform === 'win32' ? 'Windows' : d.platform || ''}`;
        const rm = document.createElement('button');
        rm.textContent = tr() ? 'Çıkar' : 'Remove';
        rm.onclick = async () => {
          if (demo) return soon();
          try {
            const r = await post('/devices/remove', { session: session.get(), deviceId: d.id });
            paint({ ...a, devices: r.devices });
          } catch (err) {
            msg(err.message);
          }
        };
        row.append(name, rm);
        list.append(row);
      }
      for (const [id, url] of [['#dlMac', C.DOWNLOADS?.mac], ['#dlWin', C.DOWNLOADS?.win]]) {
        const el = $(id);
        if (url) el.href = url;
        else el.onclick = (e) => (e.preventDefault(), msg(tr() ? 'İndirme bağlantısı yayın günü burada olacak.' : 'The download link will be here on launch day.', 'info'));
      }
      if (q.get('notrial')) msg(tr() ? 'Hesabınız açıldı. Bu internet bağlantısından son 30 gün içinde zaten bir ücretsiz deneme başlatıldığı için bu hesaba deneme tanımlanmadı. Makas Pro’ya geçerek hemen kullanabilirsiniz; bir yanlışlık varsa bize yazın.' : 'Your account is ready. A free trial was already started from this internet connection in the last 30 days, so this account has no free trial. You can start right away with Makas Pro; if this is a mistake, contact us.', 'info');
      if (q.get('welcome')) msg(tr() ? 'Hoş geldiniz! 7 günlük denemeniz başladı. Şimdi eklentiyi indirin.' : 'Welcome! Your 7-day trial has started. Download the plugin next.', 'ok');
      if (q.get('buy') && !pro && !demo && canPay) $('#planBtn').click();
    }
    $('#logout').onclick = async () => {
      if (!demo) await post('/auth/logout', { session: session.get() }).catch(() => {});
      session.clear();
      forget();
      location.href = 'index.html';
    };
    if (demo) {
      paint({ email: 'you@studio.com', plan: 'trial', until: Date.now() + 5 * DAY, devices: [{ id: 'x', name: 'MacBook Pro', platform: 'darwin' }] });
      msg(tr() ? 'Önizleme: hesaplar yayın günü açılacak. Buradaki bilgiler örnektir.' : 'Preview: accounts open at launch. The details below are sample data.', 'info');
    } else {
      post('/web/account', { session: session.get() })
        .then(paint)
        .catch((err) => {
          if (err.status === 401) {
            session.clear();
            forget();
            location.href = 'login.html';
          } else msg(err.message);
        });
    }
    document.addEventListener('makas-lang', () => location.reload());
  }
})();
