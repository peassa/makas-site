// Makas AI — ödeme sayfası (checkout.html).
// Kimlik site oturumundan ya da eklentinin açtığı bağlantıdaki biletten (?t=…) gelir.
// Kart formu Paddle'dan gelir ve sayfanın içinde açılır; kart bilgisi Makas'a ulaşmaz.
// Paddle'ın kendi gönderdiği bağlantılar (?_ptxn=…) da bu sayfada açılır: Paddle > Checkout settings > Default payment link.
(() => {
  const root = document.querySelector('#checkout');
  if (!root) return;
  const $ = (s) => root.querySelector(s);
  const C = window.MAKAS ?? {};
  const API = String(C.API || '').replace(/\/+$/, '');
  const tr = () => window.makasLang?.() === 'tr';
  const q = new URLSearchParams(location.search);
  const ticket = q.get('t');
  const ptxn = q.get('_ptxn');
  const P = C.PRICES ?? { currency: '$', monthly: 6, yearly: 48 };
  const PADDLE_JS = 'https://cdn.paddle.com/paddle/v2/paddle.js';

  let period = /^(aylik|monthly)$/.test(q.get('p') || '') ? 'monthly' : 'yearly';
  let info = null; // sunucunun yanıtı: kim ödüyor, Paddle ayarları
  let preview = null; // Paddle'ın bu ziyaretçi için hesapladığı fiyatlar: { currency, monthly: {sub,tax,total}, yearly: {…} }
  let live = null; // açık ödeme formunun tutarları: { currency, sub, tax, total }
  let opened = false;
  let finished = false;
  let agreed = false; // Ön bilgilendirme + mesafeli satış onayı (bu sayfa açıkken bir kez)

  const session = {
    get: () => window.makasStore?.get('makas-session') ?? null,
    clear: () => {
      try {
        localStorage.removeItem('makas-session');
        localStorage.removeItem('makas-account');
      } catch {
        /* yoksay */
      }
    },
  };

  async function post(path, body) {
    let r;
    try {
      r = await fetch(`${API}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    } catch {
      throw new Error(tr() ? 'Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edin.' : 'Could not reach the server. Check your connection.');
    }
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(data.error || (tr() ? 'Bir şeyler ters gitti.' : 'Something went wrong.')), { status: r.status });
    return data;
  }

  const msg = (text, kind = 'err') => {
    const el = $('#msg');
    el.className = text ? `msg show ${kind}` : 'msg';
    el.textContent = text || '';
  };

  /** Sağdaki kutuda tek bir durum gösterilir: load | login | soon | pro | error | done | pay (Paddle formu). */
  function show(state) {
    for (const el of root.querySelectorAll('[data-state]')) el.hidden = el.dataset.state !== state;
    $('#payFrame').hidden = state !== 'pay';
    root.dataset.view = state;
  }

  // ---------- Tutarlar ----------
  const num = (v) => {
    const n = typeof v === 'string' && v.trim() === '' ? NaN : Number(v);
    return Number.isFinite(n) ? n : null;
  };
  /** Para biçimi: Paddle para birimi bildirdiyse o, yoksa config.js'teki simge. */
  function money(n, currency) {
    if (n == null) return '—';
    if (currency) {
      try {
        return new Intl.NumberFormat(tr() ? 'tr-TR' : 'en-US', { style: 'currency', currency, minimumFractionDigits: Number.isInteger(n) ? 0 : 2 }).format(n);
      } catch {
        /* bilinmeyen para birimi: aşağıdaki yalın biçim */
      }
    }
    return `${currency ? `${currency} ` : P.currency}${Number.isInteger(n) ? n : n.toFixed(2)}`;
  }
  /** Bir dönemin vergisiz tutarı: Paddle'ın bildirdiği, yoksa config.js'teki. */
  const listPrice = (p) => preview?.[p]?.sub ?? (p === 'monthly' ? P.monthly : P.yearly);

  function paint() {
    const cur = preview?.currency;
    const per = tr() ? ' / ay' : ' / mo';
    const m = listPrice('monthly');
    const y = listPrice('yearly');
    $('#pmPrice').textContent = `${money(m, cur)}${per}`;
    $('#pyPrice').textContent = `${money(Math.round((y / 12) * 100) / 100, cur)}${per}`;
    const save = m > 0 ? Math.round((1 - y / (m * 12)) * 100) : 0;
    $('#pySave').textContent = save > 0 ? `−${save}%` : '';
    for (const b of root.querySelectorAll('#payPlans .acc-plan')) {
      b.classList.toggle('on', b.dataset.period === period);
      b.setAttribute('aria-pressed', String(b.dataset.period === period));
    }
    $('#payBill').textContent =
      period === 'yearly'
        ? tr() ? `Yılda bir kez ${money(y, cur)} olarak faturalanır.` : `Billed ${money(y, cur)} once a year.`
        : tr() ? `Her ay ${money(m, cur)} olarak faturalanır.` : `Billed ${money(m, cur)} every month.`;

    // Tutar satırları: ödeme formu açıksa onun bildirdiği kesin tutar, değilse Paddle'ın ön hesabı, o da yoksa liste fiyatı
    const t = live ?? (preview?.[period] ? { currency: cur, ...preview[period] } : null);
    if (t) {
      $('#paySub').textContent = money(t.sub, t.currency);
      $('#payTax').textContent = t.tax == null ? '—' : money(t.tax, t.currency);
      $('#payTotal').textContent = money(t.total, t.currency);
    } else {
      $('#paySub').textContent = money(listPrice(period), cur);
      $('#payTax').textContent = tr() ? 'Ödeme adımında hesaplanır' : 'Calculated at checkout';
      $('#payTotal').textContent = `${money(listPrice(period), cur)}${tr() ? ' + vergi' : ' + tax'}`;
    }
    $('#payRenew').textContent =
      period === 'yearly'
        ? tr() ? 'Abonelik her yıl kendiliğinden yenilenir. Hesap sayfanızdan istediğiniz zaman iptal edebilirsiniz.' : 'The subscription renews every year. Cancel anytime from your account page.'
        : tr() ? 'Abonelik her ay kendiliğinden yenilenir. Hesap sayfanızdan istediğiniz zaman iptal edebilirsiniz.' : 'The subscription renews every month. Cancel anytime from your account page.';

    const who = $('#payWho');
    who.hidden = !info?.email;
    if (info?.email) {
      who.textContent = tr() ? 'Makas Pro şu hesaba tanımlanır: ' : 'Makas Pro will be added to: ';
      const b = document.createElement('b');
      b.textContent = info.email;
      who.append(b);
    }
    $('#payLogin').href = `login.html?next=checkout&p=${period}`;
    $('#paySignup').href = `signup.html?plan=pro&period=${period}`;
    // Paddle'ın gönderdiği hazır işlemde (ör. başarısız ödemeyi yenileme) dönem değiştirilemez
    $('#payPlans').hidden = Boolean(ptxn);
    $('#payBill').hidden = Boolean(ptxn);
  }

  // ---------- Paddle ----------
  function loadPaddle() {
    if (window.Paddle) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = PADDLE_JS;
      s.onload = () => (window.Paddle ? resolve() : reject(new Error('paddle')));
      s.onerror = () => reject(new Error('paddle'));
      document.head.append(s);
    });
  }
  const priceId = () => (period === 'monthly' ? info.paddle.monthly : info.paddle.yearly);

  /** Paddle'ın bu ziyaretçi için (ülkesine göre) hesapladığı fiyatlar; başarısız olursa config.js'teki fiyat gösterilir. */
  async function loadPreview() {
    try {
      const r = await window.Paddle.PricePreview({ items: [{ priceId: info.paddle.monthly, quantity: 1 }, { priceId: info.paddle.yearly, quantity: 1 }] });
      const d = r?.data ?? {};
      const currency = d.currencyCode ?? d.currency_code;
      if (!currency) return;
      // API tutarları en küçük birimle verir (ör. kuruş/sent): para biriminin basamak sayısına göre çevrilir
      const digits = new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits;
      const unit = (v) => (num(v) == null ? null : num(v) / 10 ** digits);
      const out = { currency };
      for (const li of d.details?.lineItems ?? d.details?.line_items ?? []) {
        const key = li.price?.id === info.paddle.monthly ? 'monthly' : li.price?.id === info.paddle.yearly ? 'yearly' : null;
        const sub = unit(li.totals?.subtotal);
        if (key && sub != null) out[key] = { sub, tax: unit(li.totals?.tax), total: unit(li.totals?.total) ?? sub };
      }
      if (out.monthly && out.yearly) {
        preview = out;
        paint();
      }
    } catch {
      /* ön hesap alınamadı: liste fiyatı kalır */
    }
  }

  function onEvent(e) {
    const d = e?.data;
    if (d?.totals && num(d.totals.total) != null) {
      live = { currency: d.currency_code ?? d.currencyCode ?? preview?.currency, sub: num(d.totals.subtotal), tax: num(d.totals.tax), total: num(d.totals.total) };
      paint();
    }
    if (root.dataset.view === 'load' && String(e?.name ?? '').startsWith('checkout.') && e.name !== 'checkout.error') show('pay');
    if (e?.name === 'checkout.completed') done();
    else if (e?.name === 'checkout.payment.failed') msg(tr() ? 'Ödeme tamamlanamadı. Kart bilgilerinizi kontrol edin ya da başka bir kart deneyin.' : 'The payment did not go through. Check your card details or try another card.');
    else if (e?.name === 'checkout.error') msg(e.error?.detail || e.detail || (tr() ? 'Ödeme formunda bir hata oluştu. Sayfayı yenileyip yeniden deneyin.' : 'The payment form reported an error. Reload the page and try again.'));
  }

  async function openCheckout() {
    show('load');
    try {
      await loadPaddle();
    } catch {
      return fail(tr() ? 'Ödeme formu yüklenemedi. Reklam engelleyici kullanıyorsanız bu sayfa için kapatıp yeniden deneyin.' : 'The payment form could not load. If you use an ad blocker, turn it off for this page and try again.');
    }
    try {
      const Paddle = window.Paddle;
      if (!opened) {
        if (info.paddle.sandbox) Paddle.Environment.set('sandbox');
        Paddle.Initialize({
          token: info.paddle.token,
          eventCallback: onEvent,
          // Paddle'ın kendi açtığı işlemler (?_ptxn=…) de bu ayarlarla, sayfanın içinde açılır
          checkout: {
            settings: {
              displayMode: 'inline',
              frameTarget: 'paddle-frame',
              frameInitialHeight: 450,
              frameStyle: 'width: 100%; min-width: 312px; background-color: transparent; border: none;',
              variant: 'one-page',
              theme: 'dark',
              locale: tr() ? 'tr' : 'en',
              allowLogout: false,
            },
          },
        });
        opened = true;
        loadPreview();
      }
      // Form gizliyken ölçü alamaz: kap görünür olmalı
      $('#payFrame').hidden = false;
      if (!ptxn) Paddle.Checkout.open({ items: [{ priceId: priceId(), quantity: 1 }], customer: { email: info.email }, customData: { user_id: info.userId } });
      // Paddle "yüklendi" demezse (ağ, engelleyici) kullanıcı boş kutuya bakmasın
      setTimeout(() => {
        if (root.dataset.view !== 'load') return;
        if ($('#payFrame iframe')) show('pay');
        else fail(tr() ? 'Ödeme formu yanıt vermedi. Bağlantınızı kontrol edip yeniden deneyin.' : 'The payment form did not respond. Check your connection and try again.');
      }, 20000);
    } catch (err) {
      fail(String(err?.message || err));
    }
  }

  function fail(text) {
    $('#payErr').textContent = text;
    show('error');
  }

  /** Ödeme bitti: Paddle'ın bildirimi sunucuya ulaşınca hesap Pro olur; kısa süre beklenir. */
  async function done() {
    if (finished) return;
    finished = true;
    msg('');
    show('done');
    const set = (h, p) => (($('#payDoneH').textContent = h), ($('#payDoneP').textContent = p));
    const waiting = () => set(tr() ? 'Ödemeniz alındı' : 'Payment received', tr() ? 'Hesabınız Makas Pro’ya yükseltiliyor…' : 'Upgrading your account to Makas Pro…');
    const ready = () =>
      set(
        tr() ? 'Makas Pro hazır' : 'Makas Pro is ready',
        tr() ? 'Aboneliğiniz başladı. Makas açıksa Hesap > Yenile’ye basın; Pro olarak görünecek. Faturanız e-postanıza gönderildi.' : 'Your subscription has started. If Makas is open, press Account > Refresh and it will show as Pro. Your invoice is in your inbox.',
      );
    const later = () =>
      set(
        tr() ? 'Ödemeniz alındı' : 'Payment received',
        tr() ? 'Teşekkürler! Hesabınız birkaç dakika içinde Makas Pro olur. Faturanız e-postanıza gönderildi.' : 'Thank you! Your account becomes Makas Pro within a few minutes. Your invoice is in your inbox.',
      );
    const id = ticket ? { ticket } : session.get() ? { session: session.get() } : null;
    if (!id) return later();
    waiting();
    for (let i = 0; i < 24; i++) {
      await new Promise((r) => setTimeout(r, 2500));
      try {
        const a = await post('/web/checkout', id);
        if (a.plan === 'pro' && a.hasSubscription) {
          if (!ticket) window.makasStore?.set('makas-account', JSON.stringify({ plan: a.plan, until: a.until }));
          return ready();
        }
      } catch {
        /* bilet süresi dolmuş ya da ağ kesilmiş olabilir: beklemeye devam */
      }
    }
    later();
  }

  // ---------- Başlangıç ----------
  async function start() {
    msg('');
    show('load');
    paint();
    if (!API) return show('soon');
    try {
      info = await post('/web/checkout', ticket ? { ticket } : session.get() ? { session: session.get() } : {}).catch((err) => {
        if (err.status === 410 && session.get()) return post('/web/checkout', { session: session.get() });
        throw err;
      });
    } catch (err) {
      if (err.status === 404) return show('soon'); // sunucu henüz bu sayfayı tanımıyor: ödeme açılmamış demektir
      if (err.status === 401) {
        session.clear();
        info = null;
        paint();
        return show('login');
      }
      return fail(err.message);
    }
    paint();
    if (!info.payments || !info.paddle) return show('soon');
    if (ptxn) return openCheckout(); // Paddle'ın hazırladığı işlem: kimlik işlemin içindedir
    if (!info.email) return show('login');
    if (info.plan === 'pro' && info.hasSubscription) return show('pro');
    if (!agreed) return show('agree');
    openCheckout();
  }

  // Ödemeden önce: Ön Bilgilendirme Formu ve Mesafeli Satış Sözleşmesi onayı (sunucuda kayıt altına alınır)
  $('#agreeBtn').onclick = async () => {
    if (!$('#agreeBox').checked) return msg(tr() ? 'Devam etmek için Ön Bilgilendirme Formu’nu ve Mesafeli Satış Sözleşmesi’ni onaylayın.' : 'Please accept the Pre-Contract Information and the Distance Sales Agreement to continue.');
    msg('');
    const b = $('#agreeBtn');
    b.disabled = true;
    try {
      await post('/web/agree', { ...(ticket ? { ticket } : {}), ...(session.get() ? { session: session.get() } : {}), period });
      agreed = true;
      openCheckout();
    } catch (err) {
      msg(err.message);
    } finally {
      b.disabled = false;
    }
  };

  for (const b of root.querySelectorAll('#payPlans .acc-plan')) {
    b.onclick = () => {
      if (period === b.dataset.period || finished) return;
      period = b.dataset.period;
      live = null;
      paint();
      if (!opened || root.dataset.view !== 'pay') return;
      try {
        window.Paddle.Checkout.updateItems([{ priceId: priceId(), quantity: 1 }]);
      } catch {
        openCheckout();
      }
    };
  }
  $('#payRetry').onclick = () => (opened ? location.reload() : start());
  // Dil değişince form da o dilde açılmalı: ödeme sürerken sayfa yenilenmez, yalnızca yazılar güncellenir
  document.addEventListener('makas-lang', () => (opened || finished ? paint() : start()));
  start();
})();
