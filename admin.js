// Makas AI — yönetici paneli. Lisans sunucusunun /admin/* uçlarını kullanır; her istekte
// yönetici anahtarı (ADMIN_KEY) gönderilir. Anahtar yalnızca bu sekmenin oturum belleğinde durur.
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const API = String(window.MAKAS?.API || '').replace(/\/+$/, '');
  const DAY = 86400000;
  let key = '';
  try {
    key = sessionStorage.getItem('makas-admin') || '';
  } catch {
    /* oturum belleği kapalı */
  }
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const date = (ms) => (ms ? new Date(ms).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
  const dateTime = (ms) => (ms ? new Date(ms).toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
  const ago = (ms) => {
    if (!ms) return '—';
    const d = Date.now() - ms;
    if (d < 3600000) return `${Math.max(1, Math.round(d / 60000))} dk önce`;
    if (d < DAY) return `${Math.round(d / 3600000)} sa önce`;
    return `${Math.round(d / DAY)} gün önce`;
  };
  const left = (ms) => {
    const d = Math.ceil((ms - Date.now()) / DAY);
    return d > 0 ? `${d} gün kaldı` : `${-d} gün önce bitti`;
  };
  const PLAN = { pro: 'Pro', trial: 'Deneme', expired: 'Süresi bitti' };
  const EVENT = { kayit: 'Kayıt', 'satin-alma': 'Satın alma', yenileme: 'Yenileme', iptal: 'İptal', 'odeme-gecikti': 'Ödeme gecikti', 'admin-sure': 'Elle Pro süresi', 'admin-deneme': 'Deneme ayarlandı', 'admin-bitir': 'Erişim bitirildi', 'admin-cihaz': 'Cihaz çıkarıldı', 'admin-sil': 'Hesap silindi' };
  const PERIOD = { aylik: 'Aylık', yillik: 'Yıllık' };

  const show = (el, text, kind = 'err') => {
    el.className = `msg show ${kind}`;
    el.textContent = text;
  };
  async function api(path, body = {}) {
    let r;
    try {
      r = await fetch(`${API}/admin/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key, ...body }) });
    } catch {
      throw new Error('Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edin.');
    }
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(data.error || 'Bir şeyler ters gitti.'), { status: r.status });
    return data;
  }

  // ---------- Giriş ----------
  const login = $('#login');
  const app = $('#app');
  function signedIn(on) {
    login.hidden = on;
    app.hidden = !on;
    for (const id of ['#logout', '#refresh', '#grantOpen']) $(id).hidden = !on;
  }
  function signOut(message) {
    key = '';
    try {
      sessionStorage.removeItem('makas-admin');
    } catch {
      /* yoksay */
    }
    signedIn(false);
    if (message) show($('#loginMsg'), message);
  }
  login.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!API) return show($('#loginMsg'), 'Lisans sunucusu adresi tanımlı değil (config.js > API).');
    key = $('#key').value.trim();
    try {
      await loadAll();
      try {
        sessionStorage.setItem('makas-admin', key);
      } catch {
        /* yoksay */
      }
      $('#key').value = '';
      $('#loginMsg').className = 'msg';
      signedIn(true);
    } catch (err) {
      key = '';
      show($('#loginMsg'), err.status === 403 ? 'Anahtar yanlış.' : err.message);
    }
  });
  $('#logout').addEventListener('click', () => signOut());
  const guard = (fn) => async (...a) => {
    try {
      $('#msg').className = 'msg';
      return await fn(...a);
    } catch (err) {
      if (err.status === 403) return signOut('Oturum sona erdi; anahtarı yeniden yazın.');
      show($('#msg'), err.message);
      return null;
    }
  };

  // ---------- Özet ----------
  async function loadStats() {
    const s = await api('stats');
    const card = (n, label, sub = '', tone = '') => `<div class="adm-stat ${tone}"><b>${n}</b><span>${label}</span>${sub ? `<small>${sub}</small>` : ''}</div>`;
    $('#stats').innerHTML = [
      card(s.total, 'Toplam hesap', `son 7 günde +${s.new7}`),
      card(s.pro, 'Pro (ödeyen)', `${s.monthly} aylık · ${s.yearly} yıllık`, 'hi'),
      card(s.trial, 'Denemede'),
      card(s.expired, 'Süresi bitti'),
      card(s.active7, 'Etkin kullanan', `7 gün · 30 günde ${s.active30}`),
      card(s.purchases30, 'Satın alma', `30 gün · ${s.cancels30} iptal`),
    ].join('');
    const max = Math.max(1, ...s.days.map((d) => d.n));
    $('#days').innerHTML = s.days.map((d) => `<i title="${date(d.day)}: ${d.n} kayıt" style="--h:${(d.n / max) * 100}%"></i>`).join('');
    $('#daysNote').textContent = `${s.new30} kayıt`;
  }

  // ---------- Kullanıcılar ----------
  let users = [];
  let total = 0;
  let plan = 'all';
  const row = (u) =>
    `<tr data-email="${esc(u.email)}"><td class="em">${esc(u.email)}${u.note ? ' <span class="adm-note" title="' + esc(u.note) + '">not</span>' : ''}</td><td><span class="adm-pill ${u.plan}">${PLAN[u.plan]}${u.plan === 'pro' && u.subPeriod ? ' · ' + PERIOD[u.subPeriod] : ''}</span></td><td>${date(u.until)}<small>${left(u.until)}</small></td><td>${date(u.createdAt)}</td><td>${u.subStartedAt ? date(u.subStartedAt) : '—'}</td><td>${u.devices}</td><td>${ago(u.lastSeen)}</td></tr>`;
  async function loadUsers(reset = true) {
    const r = await api('users', { search: $('#search').value, plan, offset: reset ? 0 : users.length, limit: 50 });
    users = reset ? r.users : [...users, ...r.users];
    total = r.total;
    $('#users').innerHTML = users.map(row).join('') || '<tr><td colspan="7" class="muted">Kayıt yok.</td></tr>';
    $('#userCount').textContent = `${total} hesap`;
    $('#more').hidden = users.length >= total;
  }
  let timer = 0;
  $('#search').addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(guard(loadUsers), 300);
  });
  for (const b of $$('#planFilter button'))
    b.addEventListener('click', () => {
      $$('#planFilter button').forEach((x) => x.classList.toggle('on', x === b));
      plan = b.dataset.p;
      guard(loadUsers)();
    });
  $('#more').addEventListener('click', guard(() => loadUsers(false)));
  $('#users').addEventListener('click', (e) => {
    const tr = e.target.closest('tr[data-email]');
    if (tr) guard(openUser)(tr.dataset.email);
  });
  $('#csv').addEventListener(
    'click',
    guard(async () => {
      const all = [];
      for (let off = 0; ; off += 200) {
        const r = await api('users', { search: $('#search').value, plan, offset: off, limit: 200 });
        all.push(...r.users);
        if (all.length >= r.total || !r.users.length) break;
      }
      const iso = (ms) => (ms ? new Date(ms).toISOString() : '');
      const lines = [['e-posta', 'plan', 'donem', 'bitis', 'kayit', 'satin_alma', 'cihaz', 'son_kullanim', 'not'], ...all.map((u) => [u.email, u.plan, u.subPeriod ?? '', iso(u.until), iso(u.createdAt), iso(u.subStartedAt), u.devices, iso(u.lastSeen), u.note])];
      const csv = lines.map((l) => l.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv' }));
      a.download = `makas-kullanicilar-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
    }),
  );

  // ---------- Olaylar ----------
  let eventType = '';
  async function loadEvents() {
    const r = await api('events', { type: eventType, limit: 200 });
    $('#events').innerHTML =
      r.events.map((e) => `<tr${e.email ? ` data-email="${esc(e.email)}"` : ''}><td>${dateTime(e.at)}</td><td><span class="adm-pill ev-${esc(e.type)}">${esc(EVENT[e.type] ?? e.type)}</span></td><td class="em">${esc(e.email ?? '—')}</td><td>${esc(e.detail ?? '')}</td></tr>`).join('') ||
      `<tr><td colspan="4" class="muted">${r.missing ? 'Olay kaydı tablosu henüz oluşturulmamış.' : 'Kayıt yok.'}</td></tr>`;
  }
  for (const b of $$('#eventFilter button'))
    b.addEventListener('click', () => {
      $$('#eventFilter button').forEach((x) => x.classList.toggle('on', x === b));
      eventType = b.dataset.e;
      guard(loadEvents)();
    });
  $('#events').addEventListener('click', (e) => {
    const tr = e.target.closest('tr[data-email]');
    if (tr) guard(openUser)(tr.dataset.email);
  });
  for (const b of $$('#tabs button'))
    b.addEventListener('click', () => {
      $$('#tabs button').forEach((x) => x.classList.toggle('on', x === b));
      $('#tab-users').hidden = b.dataset.t !== 'users';
      $('#tab-events').hidden = b.dataset.t !== 'events';
    });

  // ---------- Kullanıcı ayrıntısı ve işlemler ----------
  const overlay = $('#overlay');
  const modal = $('#modal');
  const close = () => (overlay.hidden = true);
  overlay.addEventListener('click', (e) => e.target === overlay && close());
  addEventListener('keydown', (e) => e.key === 'Escape' && close());
  async function openUser(email) {
    const { user: u, devices, events } = await api('user', { email });
    modal.innerHTML = `
      <button class="adm-x" data-a="close" aria-label="Kapat">×</button>
      <h2>${esc(u.email)}</h2>
      <p><span class="adm-pill ${u.plan}">${PLAN[u.plan]}${u.plan === 'pro' && u.subPeriod ? ' · ' + PERIOD[u.subPeriod] : ''}</span> <span class="muted">${date(u.until)} · ${left(u.until)}</span></p>
      <dl class="adm-dl">
        <dt>Kayıt</dt><dd>${dateTime(u.createdAt)}</dd>
        <dt>İlk satın alma</dt><dd>${u.subStartedAt ? dateTime(u.subStartedAt) : '—'}</dd>
        <dt>Abonelik durumu</dt><dd>${esc(u.subStatus ?? '—')}${u.paddle ? ' · Paddle' : u.subStatus ? ' · elle verildi' : ''}</dd>
        <dt>Deneme bitişi</dt><dd>${date(u.trialEndsAt)}</dd>
        <dt>Son kullanım</dt><dd>${ago(u.lastSeen)}</dd>
      </dl>
      <h3>Cihazlar (${devices.length}/2)</h3>
      <div class="adm-list">${devices.map((d) => `<div><span>${esc(d.name || 'Bilgisayar')} · ${d.platform === 'darwin' ? 'macOS' : d.platform === 'win32' ? 'Windows' : esc(d.platform || '')} · ${ago(d.lastSeen)}</span><button data-a="device" data-id="${esc(d.id)}">Çıkar</button></div>`).join('') || '<div class="muted">Henüz cihaz yok.</div>'}</div>
      <h3>İşlemler</h3>
      <div class="adm-actions">
        <label>Pro süresi ver <input type="number" id="grantDays" min="1" value="30"> gün <button class="btn primary sm" data-a="grant">Ver</button></label>
        <label>Denemeyi bugünden <input type="number" id="trialDays" min="0" value="7"> gün yap <button class="btn ghost sm" data-a="trial">Ayarla</button></label>
        <label class="wide">Not <input type="text" id="note" maxlength="500" value="${esc(u.note)}" placeholder="Yalnızca siz görürsünüz"> <button class="btn ghost sm" data-a="note">Kaydet</button></label>
        <div class="danger"><button class="btn ghost sm" data-a="expire">Erişimi şimdi bitir</button><button class="btn ghost sm" data-a="delete">Hesabı sil</button></div>
      </div>
      <div class="msg" id="modalMsg"></div>
      <h3>Geçmiş</h3>
      <div class="adm-list">${events.map((e) => `<div><span>${dateTime(e.at)} · <b>${esc(EVENT[e.type] ?? e.type)}</b>${e.detail ? ' · ' + esc(e.detail) : ''}</span></div>`).join('') || '<div class="muted">Kayıt yok.</div>'}</div>`;
    overlay.hidden = false;
    modal.onclick = async (e) => {
      const a = e.target.closest('[data-a]')?.dataset.a;
      if (!a) return;
      if (a === 'close') return close();
      const m = $('#modalMsg');
      try {
        if (a === 'grant') await api('grant', { email, days: Number($('#grantDays').value) });
        else if (a === 'trial') await api('trial', { email, days: Number($('#trialDays').value) });
        else if (a === 'note') await api('note', { email, note: $('#note').value });
        else if (a === 'device') await api('device-remove', { email, deviceId: e.target.dataset.id });
        else if (a === 'expire') {
          if (!confirm(`${email} hesabının erişimi şimdi bitsin mi?`)) return;
          const r = await api('expire', { email });
          if (r.paddle) alert('Bu hesabın Paddle aboneliği var. Ödemenin de durması için aboneliği Paddle panelinden iptal edin.');
        } else if (a === 'delete') {
          if (prompt(`Hesap kalıcı olarak silinecek. Onaylamak için e-postayı yazın:\n${email}`) !== email) return;
          await api('delete', { email });
          close();
          await Promise.all([loadStats(), loadUsers(), loadEvents()]);
          return;
        }
        await Promise.all([loadStats(), loadUsers(), loadEvents()]);
        await openUser(email);
        show($('#modalMsg'), 'Kaydedildi.', 'ok');
      } catch (err) {
        if (err.status === 403) return signOut('Oturum sona erdi; anahtarı yeniden yazın.');
        show(m, err.message);
      }
    };
  }
  // Henüz hesabı olmayan birine de süre verilebilir
  $('#grantOpen').addEventListener(
    'click',
    guard(async () => {
      const email = (prompt('Pro süresi verilecek e-posta:') || '').trim().toLowerCase();
      if (!email) return;
      const days = Number(prompt('Kaç gün?', '30'));
      if (!days) return;
      await api('grant', { email, days });
      await Promise.all([loadStats(), loadUsers(), loadEvents()]);
      await openUser(email);
    }),
  );

  const loadAll = () => Promise.all([loadStats(), loadUsers(), loadEvents()]);
  $('#refresh').addEventListener('click', guard(loadAll));
  if (key) {
    loadAll()
      .then(() => signedIn(true))
      .catch((err) => signOut(err.status === 403 ? 'Oturum sona erdi; anahtarı yeniden yazın.' : err.message));
  } else signedIn(false);
})();
