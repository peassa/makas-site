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
  $('#signupForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    const email = f.email.value.trim();
    if (!validEmail(email)) return msg(tr() ? 'Geçerli bir e-posta yazın.' : 'Enter a valid email address.');
    if (f.password.value.length < 8) return msg(tr() ? 'Şifre en az 8 karakter olmalı.' : 'Password must be at least 8 characters.');
    if (f.password.value !== f.password2.value) return msg(tr() ? 'Şifreler aynı değil.' : 'Passwords do not match.');
    if (!API) return soon();
    busy(f, true);
    try {
      const r = await post('/web/register', { email, password: f.password.value, lang: lang() });
      session.set(r.session);
      const q = new URLSearchParams(location.search);
      location.href = q.get('plan') === 'pro' ? `account.html?buy=${q.get('period') || 'yearly'}` : 'account.html?welcome=1';
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
    const fmtDate = (ms) => new Date(ms).toLocaleDateString(tr() ? 'tr-TR' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' });
    function paint(a) {
      $('#accEmail').textContent = a.email;
      const pro = a.plan === 'pro';
      const trial = a.plan === 'trial';
      $('#planPill').textContent = pro ? 'Pro' : trial ? (tr() ? 'Deneme' : 'Trial') : tr() ? 'Süresi doldu' : 'Expired';
      $('#planText').textContent = pro
        ? `${tr() ? 'Makas Pro etkin. Yenilenme:' : 'Makas Pro is active. Renews on'} ${fmtDate(a.until)}`
        : trial
          ? `${tr() ? 'Deneme süreniz şu tarihte biter:' : 'Your trial ends on'} ${fmtDate(a.until)}`
          : tr()
            ? 'Deneme süreniz bitti. Devam etmek için abone olun.'
            : 'Your trial has ended. Subscribe to keep editing.';
      $('#planBtnText').textContent = pro ? (tr() ? 'Aboneliği yönet' : 'Manage subscription') : tr() ? 'Makas Pro’ya geç' : 'Get Makas Pro';
      $('#planBtn').onclick = async (e) => {
        e.preventDefault();
        if (demo) return soon();
        try {
          const r = await post(pro ? '/portal' : '/checkout', { session: session.get(), period: q.get('buy') === 'monthly' ? 'aylik' : 'yillik' });
          location.href = r.url;
        } catch (err) {
          msg(err.message);
        }
      };
      const list = $('#devices');
      list.innerHTML = '';
      if (!a.devices?.length) list.innerHTML = `<p>${tr() ? 'Henüz cihaz yok. Eklentiyi kurup giriş yapınca burada görünür.' : 'No devices yet. They appear here after you sign in inside the plugin.'}</p>`;
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
      if (q.get('welcome')) msg(tr() ? 'Hoş geldiniz! 7 günlük denemeniz başladı. Şimdi eklentiyi indirin.' : 'Welcome! Your 7-day trial has started. Download the plugin next.', 'ok');
      if (q.get('buy') && !pro && !demo) $('#planBtn').click();
    }
    $('#logout').onclick = async () => {
      if (!demo) await post('/auth/logout', { session: session.get() }).catch(() => {});
      session.clear();
      location.href = 'index.html';
    };
    if (demo) {
      paint({ email: 'you@studio.com', plan: 'trial', until: Date.now() + 7 * 86400000, devices: [{ id: 'x', name: 'MacBook Pro', platform: 'darwin' }] });
      msg(tr() ? 'Önizleme: hesaplar yayın günü açılacak. Buradaki bilgiler örnektir.' : 'Preview: accounts open at launch. The details below are sample data.', 'info');
    } else {
      post('/web/account', { session: session.get() })
        .then(paint)
        .catch((err) => {
          if (err.status === 401) {
            session.clear();
            location.href = 'login.html';
          } else msg(err.message);
        });
    }
    document.addEventListener('makas-lang', () => location.reload());
  }
})();
