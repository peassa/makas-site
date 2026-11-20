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
  const EVENT = { kayit: 'Kayıt', 'satin-alma': 'Satın alma', yenileme: 'Yenileme', iptal: 'İptal', 'odeme-gecikti': 'Ödeme gecikti', 'admin-sure': 'Elle Pro süresi', 'admin-deneme': 'Deneme ayarlandı', 'admin-bitir': 'Erişim bitirildi', 'admin-cihaz': 'Cihaz çıkarıldı', 'admin-sil': 'Hesap silindi', 'deneme-tekrar': 'Deneme reddedildi (aynı bilgisayar)', 'deneme-yok': 'Deneme verilmedi (aynı ağ)', 'admin-kayit': 'Kayıt kipi değişti', 'admin-kurucu': 'İlk kullanıcı rozeti', 'izin-ileti': 'Ticari ileti izni verildi', 'izin-geri': 'Ticari ileti izni geri alındı', 'sozlesme-onay': 'Ödeme öncesi sözleşme onayı', 'hata-raporu': 'Hata raporu gönderdi', 'admin-yonetici': 'Eklenti yöneticiliği' };
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
      card(s.pro, 'Pro (ödeyen)', `${s.monthly} aylık · ${s.yearly} yıllık · dönüşüm %${s.total ? Math.round((s.pro / s.total) * 100) : 0}`, 'hi'),
      card(s.trial, 'Denemede', s.ending3 != null ? `${s.ending3} tanesi 3 günde bitecek` : ''),
      card(s.expired, 'Süresi bitti'),
      card(s.active7, 'Etkin kullanan', `7 gün · 30 günde ${s.active30}`),
      card(s.purchases30, 'Satın alma', `30 gün · ${s.cancels30} iptal`),
    ].join('');
    const max = Math.max(1, ...s.days.map((d) => d.n));
    $('#days').innerHTML = s.days.map((d) => `<i title="${date(d.day)}: ${d.n} kayıt" style="--h:${(d.n / max) * 100}%"></i>`).join('');
    $('#daysNote').textContent = `${s.new30} kayıt`;
    // Kurulum durumu: eksik olan servisler burada görünür
    const todo = [];
    const sg = s.setup?.signing;
    if (sg && !sg.ok)
      todo.push(
        `<b>Lisans imza anahtarı ${sg.length ? 'hatalı' : 'tanımlı değil'}: eklentiden kimse giriş yapamaz.</b> Cloudflare > makas-lisans > Settings > Variables and Secrets > SIGNING_KEY değerini yeniden girin (SIGNING_KEY.txt dosyasındaki 64 karakterlik tek satır). Şu anki değer ${sg.length} karakter${sg.reason ? ', hata: ' + esc(sg.reason) : ''}.`,
      );
    if (s.setup && !s.setup.payments) todo.push('<b>Ödeme kurulu değil.</b> Kullanıcılar satın alamaz; satın alma ve iptal kayıtları boş kalır. (docs/LISANS.md > Paddle)');
    if (s.setup && !s.setup.email) todo.push('<b>E-posta kurulu değil.</b> Kayıtta e-posta onayı istenemiyor (uydurma adreslerle hesap açılabilir) ve “Şifremi unuttum” çalışmıyor. (docs/LISANS.md > E-posta)');
    const me = s.setup?.mailError;
    if (me) todo.push(`<b>E-posta gönderilemiyor</b> (son deneme ${ago(me.at)}): kayıt onayı ve “Şifremi unuttum” kodları ulaşmıyor.<br>Servisin yanıtı: <code>${esc(me.detail)}</code><br><b>Yapılacak:</b> ${esc(me.hint)}`);
    paintMail(s.setup);
    $('#setup').hidden = !todo.length;
    $('#setup').innerHTML = todo.map((t) => `<div>${t}</div>`).join('');
  }

  // ---------- Kullanıcılar ----------
  let users = [];
  let total = 0;
  let plan = 'all';
  const row = (u) =>
    `<tr data-email="${esc(u.email)}"><td class="em">${esc(u.email)}${u.admin ? ' <span class="adm-pill admin" title="Eklenti yöneticisi">Yönetici</span>' : ''}${u.founder ? ` <span class="adm-pill founder" title="İlk kullanıcı">★ #${u.founder}</span>` : ''}${u.note ? ' <span class="adm-note" title="' + esc(u.note) + '">not</span>' : ''}</td><td><span class="adm-pill ${u.plan}">${PLAN[u.plan]}${u.plan === 'pro' && u.subPeriod ? ' · ' + PERIOD[u.subPeriod] : ''}</span></td><td>${date(u.until)}<small>${left(u.until)}</small></td><td>${date(u.createdAt)}</td><td>${u.subStartedAt ? date(u.subStartedAt) : '—'}</td><td>${u.devices}</td><td>${ago(u.lastSeen)}</td></tr>`;
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
      const lines = [['e-posta', 'plan', 'donem', 'bitis', 'kayit', 'satin_alma', 'cihaz', 'son_kullanim', 'ileti_izni', 'ileti_izni_tarih', 'kosul_surumu', 'not'], ...all.map((u) => [u.email, u.plan, u.subPeriod ?? '', iso(u.until), iso(u.createdAt), iso(u.subStartedAt), u.devices, iso(u.lastSeen), u.marketing ? 'evet' : 'hayir', iso(u.marketingAt), u.termsVersion ?? '', u.note])];
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
      for (const t of ['users', 'events', 'reports']) $(`#tab-${t}`).hidden = b.dataset.t !== t;
    });

  // ---------- Hata raporları (eklentideki "Bize gönder") ----------
  const HOST = { premiere: 'Premiere Pro', resolve: 'DaVinci Resolve', tarayıcı: 'Tarayıcı' };
  const OS = { darwin: 'macOS', win32: 'Windows', linux: 'Linux' };
  async function loadReports() {
    let r;
    try {
      r = await api('reports', { limit: 200 });
    } catch (err) {
      if (err.status === 403) throw err;
      // Eski sunucu kodunda bu bölüm yok
      $('#reports').innerHTML = '<tr><td colspan="5" class="muted">Bu bölüm için yeni sunucu kodunu Cloudflare’e yapıştırmanız gerekiyor.</td></tr>';
      return;
    }
    const badge = $('#reportsNew');
    badge.hidden = !r.unseen;
    badge.textContent = r.unseen;
    $('#reports').innerHTML =
      r.reports
        .map(
          (x) =>
            `<tr data-id="${x.id}" class="${x.seen ? '' : 'new'}"><td>${dateTime(x.at)}<small>${ago(x.at)}</small></td><td class="em">${x.email ? esc(x.email) : `${x.claimed_email ? esc(x.claimed_email) : 'giriş yapılmamış'}<small>${x.claimed_email ? 'giriş yapılmamış · ' : ''}${esc(x.ip || '')}${x.country ? ` (${esc(x.country)})` : ''}</small>`}</td><td>${esc(x.action || '—')}${x.note ? `<small>“${esc(x.note)}”</small>` : ''}</td><td class="adm-err">${esc(x.error || '—')}</td><td>${esc(x.version || '—')}<small>${esc(HOST[x.host] ?? x.host ?? '')}${x.platform ? ' · ' + esc(OS[x.platform] ?? x.platform) : ''}</small></td></tr>`,
        )
        .join('') || `<tr><td colspan="5" class="muted">${r.missing ? 'Rapor tablosu henüz oluşturulmamış.' : 'Henüz rapor yok.'}</td></tr>`;
  }
  async function openReport(id) {
    const { report: x } = await api('report', { id });
    modal.innerHTML = `
      <button class="adm-x" data-r="close" aria-label="Kapat">×</button>
      <h2>Hata raporu #${x.id}</h2>
      <dl class="adm-dl">
        <dt>Gönderen</dt><dd>${x.email ? `${esc(x.email)} <button class="adm-link" data-r="user">hesabı aç</button>` : `giriş yapılmamış${x.claimed_email ? ` · yazdığı e-posta: <b>${esc(x.claimed_email)}</b> (doğrulanmamış) <button class="adm-link" data-r="claimed">bu adresle hesap var mı?</button>` : ''}`}</dd>
        ${x.email ? '' : `<dt>Kimlik</dt><dd>IP ${esc(x.ip || '—')}${x.country ? ` (${esc(x.country)})` : ''}${x.machine ? ` · cihaz ${esc(String(x.machine).slice(0, 12))}` : ''}</dd>`}
        <dt>Zaman</dt><dd>${dateTime(x.at)} · ${ago(x.at)}</dd>
        <dt>İşlem</dt><dd>${esc(x.action || '—')}</dd>
        <dt>Hata</dt><dd class="adm-err">${esc(x.error || '—')}</dd>
        ${x.note ? `<dt>Açıklama</dt><dd>${esc(x.note)}</dd>` : ''}
        <dt>Sürüm</dt><dd>${esc(x.version || '—')} · ${esc(HOST[x.host] ?? x.host ?? '—')} · ${esc(OS[x.platform] ?? x.platform ?? '—')}</dd>
        <dt>Bilgisayar</dt><dd>${esc(x.device || '—')}</dd>
      </dl>
      <h3>Tanılama raporu</h3>
      <pre class="adm-pre" id="reportBody">${esc(x.body || '(boş)')}</pre>
      <div class="adm-actions"><div class="danger"><button class="btn primary sm" data-r="copy">Raporu kopyala</button><button class="btn ghost sm" data-r="delete">Raporu sil</button></div></div>
      <div class="msg" id="modalMsg"></div>`;
    overlay.hidden = false;
    modal.onclick = async (e) => {
      const a = e.target.closest('[data-r]')?.dataset.r;
      if (!a) return;
      if (a === 'close') return close();
      if (a === 'user') return guard(openUser)(x.email);
      if (a === 'claimed') return guard(openUser)(x.claimed_email);
      if (a === 'copy') {
        const text = `Gönderen: ${x.email ?? `giriş yapılmamış${x.claimed_email ? ` (yazdığı e-posta: ${x.claimed_email})` : ''} · IP ${x.ip || '-'}${x.country ? ` (${x.country})` : ''}`}\nİşlem: ${x.action || '-'}\nHata: ${x.error || '-'}${x.note ? `\nAçıklama: ${x.note}` : ''}\n\n${x.body || ''}`;
        try {
          await navigator.clipboard.writeText(text);
          show($('#modalMsg'), 'Kopyalandı.', 'ok');
        } catch {
          show($('#modalMsg'), 'Kopyalanamadı; metni seçip kopyalayın.');
        }
        return;
      }
      if (a === 'delete') {
        if (!confirm('Bu rapor silinsin mi?')) return;
        try {
          await api('report-delete', { id: x.id });
          close();
          await loadReports();
        } catch (err) {
          show($('#modalMsg'), err.message);
        }
      }
    };
    loadReports().catch(() => {});
  }
  $('#reports').addEventListener('click', (e) => {
    const tr = e.target.closest('tr[data-id]');
    if (tr) guard(openReport)(Number(tr.dataset.id));
  });

  // ---------- Kullanıcı ayrıntısı ve işlemler ----------
  const overlay = $('#overlay');
  const modal = $('#modal');
  const close = () => (overlay.hidden = true);
  overlay.addEventListener('click', (e) => e.target === overlay && close());
  addEventListener('keydown', (e) => e.key === 'Escape' && close());
  async function openUser(email) {
    const { user: u, devices, events, sameNetwork = [] } = await api('user', { email });
    modal.innerHTML = `
      <button class="adm-x" data-a="close" aria-label="Kapat">×</button>
      <h2>${esc(u.email)}</h2>
      <p><span class="adm-pill ${u.plan}">${PLAN[u.plan]}${u.plan === 'pro' && u.subPeriod ? ' · ' + PERIOD[u.subPeriod] : ''}</span> <span class="muted">${date(u.until)} · ${left(u.until)}</span>${u.admin ? ' <span class="adm-pill admin">Yönetici</span>' : ''}${u.founder ? ` <span class="adm-pill founder">★ İlk Kullanıcı #${u.founder}</span>` : ''}</p>
      <dl class="adm-dl">
        <dt>Kayıt</dt><dd>${dateTime(u.createdAt)}</dd>
        <dt>İlk satın alma</dt><dd>${u.subStartedAt ? dateTime(u.subStartedAt) : '—'}</dd>
        <dt>Abonelik durumu</dt><dd>${esc(u.subStatus ?? '—')}${u.paddle ? ' · Paddle' : u.subStatus ? ' · elle verildi' : ''}</dd>
        <dt>Deneme bitişi</dt><dd>${date(u.trialEndsAt)}</dd>
        <dt>Son kullanım</dt><dd>${ago(u.lastSeen)}</dd>
        <dt>Koşulların kabulü</dt><dd>${u.termsAt ? `${dateTime(u.termsAt)} · sürüm ${esc(u.termsVersion)}` : '—'}</dd>
        <dt>Ticari ileti izni</dt><dd>${u.marketing ? `Var · ${dateTime(u.marketingAt)}` : u.marketingAt ? `Yok · geri alındı ${dateTime(u.marketingAt)}` : 'Yok'}</dd>
      </dl>
      <h3>Cihazlar (${devices.length}/2)</h3>
      <div class="adm-list">${devices.map((d) => `<div><span>${esc(d.name || 'Bilgisayar')} · ${d.platform === 'darwin' ? 'macOS' : d.platform === 'win32' ? 'Windows' : esc(d.platform || '')} · ${ago(d.lastSeen)}</span><button data-a="device" data-id="${esc(d.id)}">Çıkar</button></div>`).join('') || '<div class="muted">Henüz cihaz yok.</div>'}</div>
      ${sameNetwork.length ? `<h3>Aynı ağdan açılan diğer hesaplar (${sameNetwork.length})</h3><div class="adm-list">${sameNetwork.map((m) => `<div><span>${esc(m)}</span><button data-a="open" data-email="${esc(m)}">Aç</button></div>`).join('')}</div>` : ''}
      <h3>İşlemler</h3>
      <div class="adm-actions">
        <label>Pro süresi ver <input type="number" id="grantDays" min="1" value="30"> gün <button class="btn primary sm" data-a="grant">Ver</button></label>
        <label>Denemeyi bugünden <input type="number" id="trialDays" min="0" value="7"> gün yap <button class="btn ghost sm" data-a="trial">Ayarla</button></label>
        <label class="wide">İlk kullanıcı rozeti (ilk 20 hesap; eklentide altın etiket) <button class="btn ghost sm" data-a="founder" data-on="${u.founder ? '' : '1'}">${u.founder ? 'Rozeti al' : 'Rozet ver'}</button></label>
        <label class="wide">Eklenti yöneticisi (kullanıcılara kapalı ekranları ve test turunu görür; ödeme durumu değişmez) <button class="btn ghost sm" data-a="role" data-on="${u.admin ? '' : '1'}">${u.admin ? 'Yöneticiliği al' : 'Yönetici yap'}</button></label>
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
      if (a === 'open') return openUser(e.target.dataset.email).catch(() => {});
      const m = $('#modalMsg');
      try {
        if (a === 'grant') await api('grant', { email, days: Number($('#grantDays').value) });
        else if (a === 'trial') await api('trial', { email, days: Number($('#trialDays').value) });
        else if (a === 'note') await api('note', { email, note: $('#note').value });
        else if (a === 'founder') await api('founder', { email, on: Boolean(e.target.dataset.on) });
        else if (a === 'role') await api('role', { email, on: Boolean(e.target.dataset.on) });
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

  // Kayıt kipi: herkese açık / davet koduyla / kapalı
  const GATE = { acik: 'Herkes kayıt olabilir', davet: 'Yalnızca davet koduyla', kapali: 'Yeni kayıt alınmıyor' };
  let gateMode = 'acik';
  const paintGate = (g) => {
    gateMode = g.signup;
    $$('#gateMode button').forEach((b) => b.classList.toggle('on', b.dataset.m === gateMode));
    $('#gateCode').value = g.invite ?? '';
    $('#gateCode').hidden = gateMode !== 'davet';
    $('#gateState').textContent = GATE[gateMode];
  };
  async function loadGate() {
    try {
      paintGate(await api('settings'));
    } catch (err) {
      if (err.status === 403) throw err;
      // Eski sunucu kodunda bu ayar yok
      $('#gateState').textContent = 'Sunucu kodu güncellenince etkinleşir';
      show($('#gateMsg'), 'Bu ayar için yeni sunucu kodunu Cloudflare’e yapıştırmanız gerekiyor. O zamana kadar kayıt yalnızca sitede kısıtlıdır.', 'info');
    }
  }
  for (const b of $$('#gateMode button'))
    b.addEventListener('click', () => {
      gateMode = b.dataset.m;
      $$('#gateMode button').forEach((x) => x.classList.toggle('on', x === b));
      $('#gateCode').hidden = gateMode !== 'davet';
    });
  $('#gateSave').addEventListener('click', async () => {
    try {
      paintGate(await api('settings', { signup: gateMode, invite: $('#gateCode').value.trim().toUpperCase() }));
      show($('#gateMsg'), 'Kaydedildi.', 'ok');
      loadEvents().catch(() => {});
    } catch (err) {
      if (err.status === 403) return signOut('Oturum sona erdi; anahtarı yeniden yazın.');
      show($('#gateMsg'), err.message);
    }
  });
  // ---------- E-posta gönderimi: durum ve tek tıkla deneme ----------
  const MAIL = { brevo: 'Brevo', cloudflare: 'Cloudflare Email', resend: 'Resend' };
  function paintMail(setup) {
    // Eski sunucu kodu bu bilgiyi vermez
    if (!setup || !('mailError' in setup)) {
      $('#mailState').textContent = 'Sunucu kodu güncellenince etkinleşir';
      $('#mailTest').disabled = true;
      return;
    }
    $('#mailTest').disabled = false;
    $('#mailState').textContent = !setup.email ? 'Kurulu değil' : `${MAIL[setup.mailProvider] ?? setup.mailProvider} · ${setup.mailError ? 'son gönderim başarısız' : 'sorun görünmüyor'}`;
  }
  $('#mailTest').addEventListener('click', async () => {
    const to = $('#mailTo').value.trim();
    if (!to) return show($('#mailMsg'), 'Deneme iletisinin gideceği adresi yazın (kendi adresiniz).');
    $('#mailTest').disabled = true;
    show($('#mailMsg'), 'Gönderiliyor…', 'info');
    try {
      const r = await api('mail-test', { to });
      if (r.ok) show($('#mailMsg'), `Gönderildi (${MAIL[r.provider] ?? r.provider}, gönderen ${r.from}). Gelen kutunuza ve spam klasörüne bakın; ileti geldiyse kayıt onayı ve şifre sıfırlama da çalışır.`, 'ok');
      else show($('#mailMsg'), `Gönderilemedi${r.provider ? ` (${MAIL[r.provider] ?? r.provider}, gönderen ${r.from})` : ''}.\nServisin yanıtı: ${r.detail}\n\nYapılacak: ${r.hint}`);
      loadStats().catch(() => {});
    } catch (err) {
      if (err.status === 403) return signOut('Oturum sona erdi; anahtarı yeniden yazın.');
      show($('#mailMsg'), err.status === 404 ? 'Bu düğme için yeni sunucu kodunu Cloudflare’e yapıştırmanız gerekiyor.' : err.message);
    } finally {
      $('#mailTest').disabled = false;
    }
  });

  const loadAll = () => Promise.all([loadStats(), loadUsers(), loadEvents(), loadGate(), loadReports()]);
  $('#refresh').addEventListener('click', guard(loadAll));
  if (key) {
    loadAll()
      .then(() => signedIn(true))
      .catch((err) => signOut(err.status === 403 ? 'Oturum sona erdi; anahtarı yeniden yazın.' : err.message));
  } else signedIn(false);
})();
