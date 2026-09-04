let data = { version: '3.0.0.0', sections: [], announcements: [], about: {}, admin: { username: 'admin', passwordHash: '' } };
let stack = [];
let upFile = null;
const REPO = 'alhashedalfatimy/al-hashd-fatimi';
const BRANCH = 'main';
const THEME_KEY = 'alhashd_theme';

function getToken() {
  return localStorage.getItem('gh_token') || sessionStorage.getItem('gh_token') || '';
}
function setToken(t) {
  localStorage.setItem('gh_token', t);
  sessionStorage.setItem('gh_token', t);
}

// ===== SHA-256 helper =====
async function sha256(str) {
  const buf = new TextEncoder().encode(str);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ===== Theme =====
function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  const btn = document.getElementById('theme-toggle');
  if (btn) btn.textContent = t === 'dark' ? '☀️' : '🌙';
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) metaTheme.setAttribute('content', t === 'dark' ? '#000000' : '#ffffff');
}
function toggleTheme() {
  const t = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  localStorage.setItem(THEME_KEY, t);
  applyTheme(t);
}
window.addEventListener('storage', (e) => {
  if (e.key === THEME_KEY) applyTheme(e.newValue || 'dark');
});

document.addEventListener('DOMContentLoaded', async () => {
  if (!sessionStorage.getItem('admin_auth')) { location.href = 'index.html'; return; }
  applyTheme(localStorage.getItem(THEME_KEY) || 'dark');
  let t = getToken();
  if (!t) {
    t = prompt('توكن GitHub:');
    if (!t) { toast('التوكن مطلوب', 'bad'); return; }
    setToken(t);
  }
  try { await load(); setup(); renderSections(); } catch (e) { toast('خطأ في التحميل', 'bad'); }
});

async function load() {
  try {
    const r = await fetch('https://raw.githubusercontent.com/' + REPO + '/' + BRANCH + '/content.json?n=' + Date.now());
    if (r.ok) {
      data = await r.json();
      if (!data.sections) data = { version: '3.0.0.0', sections: [], announcements: [], about: {}, admin: { username: 'admin', passwordHash: '' } };
      if (!data.announcements) data.announcements = [];
      if (!data.about) data.about = {};
      if (!data.admin) data.admin = { username: 'admin', passwordHash: '' };
    }
  } catch (e) { data = { version: '3.0.0.0', sections: [], announcements: [], about: {}, admin: { username: 'admin', passwordHash: '' } }; }
}

async function api(path, method, body) {
  const url = path.startsWith('http') ? path : 'https://api.github.com/repos/' + REPO + path;
  const opts = {
    method,
    headers: {
      'Authorization': 'token ' + getToken(),
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    }
  };
  if (body) opts.body = JSON.stringify(body);
  const r = await fetch(url, opts);
  if (!r.ok) throw new Error(await r.text());
  if (r.status === 204) return null;
  return r.json();
}

function push(type, d) { stack.push({ type, ...d }); render(); }
function pop() { stack.pop(); render(); }
function render() {
  const c = stack[stack.length - 1];
  if (!c || c.type === 'sections') renderSections();
  else if (c.type === 'section') renderSection(c.id);
  else if (c.type === 'folder') renderFolder(c.sid, c.fid);
  else if (c.type === 'anns') renderAnns();
  else if (c.type === 'about') renderAboutEdit();
}

// ===== SECTIONS =====
function renderSections() {
  stack = [{ type: 'sections' }];
  const view = document.getElementById('view');
  const secs = data.sections || [];
  let html = '<div class="page-title">📋 الأقسام</div>';
  if (!secs.length) html += '<div class="empty"><div class="ei">📂</div><div>لا توجد أقسام</div></div>';
  else secs.forEach((s, i) => {
    html += `
      <div class="card glass" onclick="push('section',{id:'${s.id}'})">
        <div class="info"><div class="icon">${s.icon||'📁'}</div><div>
          <div class="name">${esc(s.name)}</div>
          <div class="meta">${s.folders?.length||0} مجلد · ${s.items?.length||0} عنصر</div>
        </div></div>
        <div class="actions">
          <button class="ed" onclick="event.stopPropagation();editSec(${i})">✏️</button>
          <button class="del" onclick="event.stopPropagation();delSec(${i})">🗑</button>
        </div>
      </div>`;
  });
  html += `
    <div style="display:flex;gap:10px;margin:14px 16px;flex-wrap:wrap;">
      <div class="fab glass" style="flex:1;min-width:140px;" onclick="openAddSec()">➕ قسم</div>
      <div class="fab glass" style="flex:1;min-width:140px;" onclick="push('anns')">📢 إعلانات</div>
      <div class="fab glass" style="flex:1;min-width:140px;" onclick="push('about')">ℹ️ عن التطبيق</div>
    </div>`;
  html += renderAccountSection();
  view.innerHTML = html;
  window.scrollTo(0, 0);
}

// ===== ABOUT APP =====
function renderAboutEdit() {
  const view = document.getElementById('view');
  const about = data.about || {};
  let html = `
    <div class="breadcrumb"><button class="back glass" onclick="pop()">← رجوع</button>
    <span class="sep">|</span><span class="crumb">ℹ️ عن التطبيق</span></div>
    <div class="page-title">ℹ️ إدارة معلومات التطبيق</div>
    <div class="account-card glass">
      <div class="fg">
        <label>اسم التطبيق</label>
        <input type="text" id="ab-name" value="${esc(about.name || 'الحشد الفاطمي')}">
      </div>
      <div class="fg">
        <label>الوصف</label>
        <input type="text" id="ab-desc" value="${esc(about.description || 'محتوى ديني من الحرمات المقدسة')}">
      </div>
      <div class="fg">
        <label>رقم الإصدار</label>
        <input type="text" id="ab-ver" value="${esc(about.version || '3.0.0.0')}">
      </div>
      <div class="fg">
        <label>آخر التحديثات</label>
        <textarea id="ab-updates" rows="3" style="width:100%;padding:11px 13px;border-radius:10px;border:1px solid var(--border);background:rgba(255,255,255,0.04);color:var(--text);font-family:inherit;font-size:0.85rem;outline:none;resize:vertical;">${esc(about.updates || '')}</textarea>
      </div>
      <div class="fg">
        <label>معلومات التواصل</label>
        <input type="text" id="ab-contact" value="${esc(about.contact || '')}" placeholder="رقم هاتف، بريد، رابط...">
      </div>
      <div class="fg">
        <label>معلومات إضافية</label>
        <textarea id="ab-extra" rows="2" style="width:100%;padding:11px 13px;border-radius:10px;border:1px solid var(--border);background:rgba(255,255,255,0.04);color:var(--text);font-family:inherit;font-size:0.85rem;outline:none;resize:vertical;">${esc(about.extra || '')}</textarea>
      </div>
      <button class="save-btn" onclick="saveAbout()">💾 حفظ التغييرات</button>
    </div>
  `;
  view.innerHTML = html;
  window.scrollTo(0, 0);
}

async function saveAbout() {
  const name = document.getElementById('ab-name').value.trim();
  const desc = document.getElementById('ab-desc').value.trim();
  const ver = document.getElementById('ab-ver').value.trim();
  const updates = document.getElementById('ab-updates').value.trim();
  const contact = document.getElementById('ab-contact').value.trim();
  const extra = document.getElementById('ab-extra').value.trim();

  if (!name) { toast('اسم التطبيق مطلوب', 'bad'); return; }

  data.about = { name, description: desc, version: ver, updates, contact, extra };

  try {
    await saveData();
    toast('تم حفظ معلومات التطبيق', 'ok');
  } catch (e) {
    toast('فشل الحفظ: ' + e.message, 'bad');
  }
}

// ===== ACCOUNT MANAGEMENT =====
function renderAccountSection() {
  const admin = data.admin || { username: 'admin', passwordHash: '' };
  return `
    <div class="account-card glass" id="account-card">
      <h3>🔐 إدارة الحساب</h3>
      <div class="fg">
        <label>اسم المستخدم الحالي</label>
        <input type="text" id="acc-current-user" value="${esc(admin.username)}" disabled style="opacity:0.6;">
      </div>
      <div class="fg">
        <label>اسم المستخدم الجديد</label>
        <input type="text" id="acc-new-user" placeholder="اتركه فارغاً إذا لم ترغب في التغيير">
      </div>
      <div class="divider"></div>
      <div class="fg">
        <label>كلمة المرور الحالية *</label>
        <input type="password" id="acc-current-pass" placeholder="أدخل كلمة المرور الحالية للتحقق">
      </div>
      <div class="fg">
        <label>كلمة المرور الجديدة</label>
        <input type="password" id="acc-new-pass" placeholder="اتركها فارغة إذا لم ترغب في التغيير">
      </div>
      <div class="fg">
        <label>تأكيد كلمة المرور الجديدة</label>
        <input type="password" id="acc-confirm-pass" placeholder="أعد إدخال كلمة المرور الجديدة">
      </div>
      <button class="save-btn" onclick="saveAccountChanges()">💾 حفظ التغييرات</button>
    </div>
  `;
}

async function saveAccountChanges() {
  const currentPass = document.getElementById('acc-current-pass').value;
  const newUser = document.getElementById('acc-new-user').value.trim();
  const newPass = document.getElementById('acc-new-pass').value;
  const confirmPass = document.getElementById('acc-confirm-pass').value;

  if (!currentPass) { toast('يجب إدخال كلمة المرور الحالية', 'bad'); return; }

  const currentHash = await sha256(currentPass);
  const admin = data.admin || { username: 'admin', passwordHash: '' };
  const expectedHash = admin.passwordHash || await sha256('admin123');

  if (currentHash !== expectedHash) { toast('كلمة المرور الحالية غير صحيحة', 'bad'); return; }

  let changed = false;

  if (newUser && newUser !== admin.username) {
    data.admin = data.admin || {};
    data.admin.username = newUser;
    changed = true;
  }

  if (newPass) {
    if (newPass !== confirmPass) { toast('كلمتا المرور الجديدتان غير متطابقتين', 'bad'); return; }
    if (newPass.length < 6) { toast('يجب أن تكون كلمة المرور 6 أحرف على الأقل', 'bad'); return; }
    data.admin = data.admin || {};
    data.admin.passwordHash = await sha256(newPass);
    changed = true;
  }

  if (!changed) { toast('لم يتم إجراء أي تغييرات', 'ok'); return; }

  try {
    await saveData();
    toast('تم حفظ التغييرات بنجاح', 'ok');
    document.getElementById('acc-current-pass').value = '';
    document.getElementById('acc-new-pass').value = '';
    document.getElementById('acc-confirm-pass').value = '';
    document.getElementById('acc-new-user').value = '';
    document.getElementById('acc-current-user').value = data.admin.username;
  } catch (e) {
    toast('فشل الحفظ: ' + e.message, 'bad');
  }
}

function renderSection(sid) {
  const view = document.getElementById('view');
  const sec = data.sections?.find(s => s.id === sid);
  if (!sec) { pop(); return; }
  const folders = sec.folders || [];
  let html = `
    <div class="breadcrumb"><button class="back glass" onclick="pop()">← رجوع</button>
    <span class="sep">|</span><span class="crumb">${esc(sec.name)}</span></div>
    <div class="page-title">📁 المجلدات</div>`;
  if (!folders.length) html += '<div class="empty"><div class="ei">📁</div><div>لا توجد مجلدات</div></div>';
  else folders.forEach((f, i) => {
    const cnt = (sec.items||[]).filter(x => x.folderId === f.id).length;
    html += `
      <div class="card glass" onclick="push('folder',{sid:'${sid}',fid:'${f.id}'})">
        <div class="info"><div class="icon">📁</div><div>
          <div class="name">${esc(f.name)}</div><div class="meta">${cnt} عنصر</div>
        </div></div>
        <div class="actions">
          <button class="ed" onclick="event.stopPropagation();editFld('${sid}',${i})">✏️</button>
          <button class="del" onclick="event.stopPropagation();delFld('${sid}',${i})">🗑</button>
        </div>
      </div>`;
  });
  html += `<div class="fab glass" onclick="openAddFld('${sid}')">➕ مجلد جديد</div>`;
  view.innerHTML = html; window.scrollTo(0, 0);
}

function renderFolder(sid, fid) {
  const view = document.getElementById('view');
  const sec = data.sections?.find(s => s.id === sid);
  const fld = sec?.folders?.find(f => f.id === fid);
  if (!sec || !fld) { pop(); return; }
  const items = (sec.items||[]).filter(i => i.folderId === fid);
  let html = `
    <div class="breadcrumb"><button class="back glass" onclick="pop()">← رجوع</button>
    <span class="sep">|</span><span class="crumb">${esc(fld.name)}</span></div>
    <div class="page-title">📂 ${esc(fld.name)}</div>
    <div class="upload-zone glass" id="uz"><div class="u-icon">📤</div><div class="u-text">اضغط لإضافة وسائط</div>
    <input type="file" id="uf" multiple accept="image/*,video/*,audio/*" style="display:none;"></div>`;
  if (!items.length) html += '<div class="empty"><div class="ei">📂</div><div>لا توجد وسائط</div></div>';
  else items.forEach(it => {
    const thumb = it.thumbnail || it.cover || it.url || '';
    const isA = it.type === 'audio';
    html += `
      <div class="media-row glass">
        ${thumb?`<img src="${thumb}" onerror="this.style.display='none'">`:''}
        <div class="ph" style="display:${thumb?'none':'flex'}">${isA?'🎧':'🖼'}</div>
        <div class="minfo"><div class="mtitle">${esc(it.title)}</div>
        <div class="mdesc">${it.visibility==='private'?'🔒':''} ${it.allowDownload!==false?'⬇️':'❌'} ${it.allowShare!==false?'🔗':'❌'}</div></div>
        <button class="del" onclick="delItem('${sid}','${fid}',${it.id})">🗑</button>
      </div>`;
  });
  view.innerHTML = html; window.scrollTo(0, 0);
  setTimeout(() => {
    const uz = document.getElementById('uz'), uf = document.getElementById('uf');
    if (uz && uf) { uz.onclick = () => uf.click(); uf.onchange = e => openUp(e, sid, fid); }
  }, 0);
}

function renderAnns() {
  const view = document.getElementById('view');
  const anns = data.announcements || [];
  let html = `
    <div class="breadcrumb"><button class="back glass" onclick="pop()">← رجوع</button>
    <span class="sep">|</span><span class="crumb">📢 الإعلانات</span></div>
    <div class="page-title">📢 الإعلانات</div>`;
  if (!anns.length) html += '<div class="empty"><div class="ei">📢</div><div>لا توجد إعلانات</div></div>';
  else anns.forEach((a, i) => {
    html += `
      <div class="card glass">
        <div class="info"><div class="icon">${a.active?'🔔':'🔕'}</div><div>
          <div class="name">${esc(a.title)}</div>
          <div class="meta">${esc(a.text||'').substring(0,40)}${(a.text||'').length>40?'...':''}</div>
        </div></div>
        <div class="actions">
          <button class="ed" onclick="editAnn(${i})">✏️</button>
          <button class="del" onclick="delAnn(${i})">🗑</button>
        </div>
      </div>`;
  });
  html += `<div class="fab glass" onclick="openAddAnn()">➕ إعلان جديد</div>`;
  view.innerHTML = html; window.scrollTo(0, 0);
}

// ===== UPLOAD =====
function openUp(e, sid, fid) {
  const files = Array.from(e.target.files);
  if (!files.length) return;
  upFile = files[0];
  const sec = data.sections?.find(s => s.id === sid);
  const body = document.getElementById('modal-body');
  document.getElementById('modal-title').textContent = '📤 رفع وسائط';
  const url = URL.createObjectURL(upFile);
  let preview = '';
  if (upFile.type.startsWith('image/')) preview = `<img src="${url}" style="max-width:100%;max-height:160px;border-radius:12px;margin-bottom:14px;">`;
  else if (upFile.type.startsWith('video/')) preview = `<video src="${url}" controls style="max-width:100%;max-height:160px;border-radius:12px;margin-bottom:14px;"></video>`;
  else preview = `<div style="font-size:2.5rem;margin-bottom:14px;">🎧</div>`;
  body.innerHTML = `
    <div style="text-align:center;">${preview}</div>
    <div class="fg"><label>العنوان</label><input type="text" id="ut" value="${upFile.name.split('.')[0]}"></div>
    <div class="fg"><label>الوصف</label><input type="text" id="ud" placeholder="اختياري"></div>
    <div class="fg"><label class="chk"><input type="checkbox" id="upriv"> <span>🔒 خاص (لا يظهر للزوار)</span></label></div>
    <div class="fg" style="display:flex;gap:12px;">
      <label class="chk"><input type="checkbox" id="udl" checked> <span>⬇️ تنزيل</span></label>
      <label class="chk"><input type="checkbox" id="ush" checked> <span>🔗 مشاركة</span></label>
    </div>
    <button class="save" onclick="saveUp('${sid}','${fid}')">رفع وحفظ</button>`;
  showModal();
}

async function saveUp(sid, fid) {
  const title = document.getElementById('ut').value.trim();
  const desc = document.getElementById('ud').value.trim();
  const priv = document.getElementById('upriv').checked;
  const dl = document.getElementById('udl').checked;
  const sh = document.getElementById('ush').checked;
  if (!title) { toast('العنوان مطلوب', 'bad'); return; }
  if (!upFile) { toast('اختر ملفاً', 'bad'); return; }
  toast('جاري الرفع...', 'ok');
  try {
    const fname = Date.now() + '_' + upFile.name.replace(/\s+/g, '_');
    const path = 'uploads/' + fname;
    const reader = new FileReader();
    reader.readAsDataURL(upFile);
    reader.onloadend = async () => {
      const b64 = reader.result.split(',')[1];
      await api('/contents/' + path, 'PUT', { message: 'Upload ' + fname, content: b64, branch: BRANCH });
      const furl = 'https://raw.githubusercontent.com/' + REPO + '/' + BRANCH + '/' + path;
      const sec = data.sections?.find(s => s.id === sid);
      const item = {
        id: Date.now(), title, description: desc,
        folderId: fid, url: furl,
        type: sid==='images'?'image':sid==='videos'?'video':'audio',
        visibility: priv?'private':'public',
        allowDownload: dl, allowShare: sh
      };
      if (sid === 'images') item.thumbnail = furl;
      else if (sid === 'videos') item.thumbnail = furl;
      else { item.cover = furl; item.duration = '--:--'; }
      if (!sec.items) sec.items = [];
      sec.items.push(item);
      await saveData();
      hideModal(); renderFolder(sid, fid);
      toast('تم الرفع', 'ok');
    };
  } catch (e) { toast('خطأ: ' + e.message, 'bad'); }
}

async function delItem(sid, fid, id) {
  if (!confirm('حذف هذا العنصر؟')) return;
  const sec = data.sections?.find(s => s.id === sid);
  const idx = sec.items.findIndex(i => i.id === id);
  if (idx === -1) return;
  sec.items.splice(idx, 1);
  await saveData();
  renderFolder(sid, fid);
  toast('تم الحذف', 'ok');
}

// ===== SECTION CRUD =====
function editSec(i) {
  const s = data.sections[i];
  const body = document.getElementById('modal-body');
  document.getElementById('modal-title').textContent = '✏️ تعديل قسم';
  body.innerHTML = `
    <div class="fg"><label>الاسم</label><input type="text" id="esn" value="${esc(s.name)}"></div>
    <div class="fg"><label>الأيقونة</label><input type="text" id="esi" value="${s.icon||''}" maxlength="2"></div>
    <button class="save" onclick="saveEditSec(${i})">حفظ</button>`;
  showModal();
}
async function saveEditSec(i) {
  const n = document.getElementById('esn').value.trim();
  const ic = document.getElementById('esi').value.trim();
  if (!n) { toast('الاسم مطلوب', 'bad'); return; }
  data.sections[i].name = n; data.sections[i].icon = ic;
  await saveData(); hideModal(); renderSections();
  toast('تم التعديل', 'ok');
}
async function delSec(i) {
  if (!confirm('حذف القسم وجميع محتوياته؟')) return;
  data.sections.splice(i, 1);
  await saveData(); renderSections();
  toast('تم الحذف', 'ok');
}
function openAddSec() {
  const body = document.getElementById('modal-body');
  document.getElementById('modal-title').textContent = '➕ قسم جديد';
  body.innerHTML = `
    <div class="fg"><label>الاسم</label><input type="text" id="nsn" placeholder="مثال: المقالات"></div>
    <div class="fg"><label>الأيقونة</label><input type="text" id="nsi" value="📁" maxlength="2"></div>
    <div class="fg"><label>النوع</label>
      <select id="nst"><option value="image">🖼 صور</option><option value="video">🎥 فيديو</option><option value="audio">🎧 صوت</option></select>
    </div>
    <button class="save" onclick="saveNewSec()">حفظ</button>`;
  showModal();
}
async function saveNewSec() {
  const n = document.getElementById('nsn').value.trim();
  const ic = document.getElementById('nsi').value.trim() || '📁';
  const t = document.getElementById('nst').value;
  if (!n) { toast('الاسم مطلوب', 'bad'); return; }
  data.sections.push({ id: 's' + Date.now(), name: n, icon: ic, folders: [], items: [], defaultType: t });
  await saveData(); hideModal(); renderSections();
  toast('تم الإضافة', 'ok');
}

// ===== FOLDER CRUD =====
function editFld(sid, i) {
  const sec = data.sections?.find(s => s.id === sid);
  const f = sec.folders[i];
  const body = document.getElementById('modal-body');
  document.getElementById('modal-title').textContent = '✏️ تعديل مجلد';
  body.innerHTML = `
    <div class="fg"><label>الاسم</label><input type="text" id="efn" value="${esc(f.name)}"></div>
    <button class="save" onclick="saveEditFld('${sid}',${i})">حفظ</button>`;
  showModal();
}
async function saveEditFld(sid, i) {
  const n = document.getElementById('efn').value.trim();
  if (!n) { toast('الاسم مطلوب', 'bad'); return; }
  const sec = data.sections?.find(s => s.id === sid);
  sec.folders[i].name = n;
  await saveData(); hideModal(); renderSection(sid);
  toast('تم التعديل', 'ok');
}
async function delFld(sid, i) {
  if (!confirm('حذف المجلد؟ (العناصر ستصبح بدون مجلد)')) return;
  const sec = data.sections?.find(s => s.id === sid);
  const fid = sec.folders[i].id;
  sec.folders.splice(i, 1);
  (sec.items||[]).forEach(it => { if (it.folderId === fid) delete it.folderId; });
  await saveData(); renderSection(sid);
  toast('تم الحذف', 'ok');
}
function openAddFld(sid) {
  const body = document.getElementById('modal-body');
  document.getElementById('modal-title').textContent = '➕ مجلد جديد';
  body.innerHTML = `
    <div class="fg"><label>الاسم</label><input type="text" id="nfn" placeholder="مثال: حرم الإمام الحسين"></div>
    <button class="save" onclick="saveNewFld('${sid}')">حفظ</button>`;
  showModal();
}
async function saveNewFld(sid) {
  const n = document.getElementById('nfn').value.trim();
  if (!n) { toast('الاسم مطلوب', 'bad'); return; }
  const sec = data.sections?.find(s => s.id === sid);
  if (!sec.folders) sec.folders = [];
  sec.folders.push({ id: 'f' + Date.now(), name: n });
  await saveData(); hideModal(); renderSection(sid);
  toast('تم الإضافة', 'ok');
}

// ===== ANNOUNCEMENT CRUD =====
function openAddAnn() {
  const body = document.getElementById('modal-body');
  document.getElementById('modal-title').textContent = '➕ إعلان جديد';
  body.innerHTML = `
    <div class="fg"><label>العنوان</label><input type="text" id="nat" placeholder="عنوان الإعلان"></div>
    <div class="fg"><label>النص</label><input type="text" id="nax" placeholder="نص الإعلان"></div>
    <div class="fg"><label class="chk"><input type="checkbox" id="naa" checked> <span>نشط</span></label></div>
    <button class="save" onclick="saveNewAnn()">حفظ</button>`;
  showModal();
}
async function saveNewAnn() {
  const t = document.getElementById('nat').value.trim();
  const x = document.getElementById('nax').value.trim();
  const a = document.getElementById('naa').checked;
  if (!t) { toast('العنوان مطلوب', 'bad'); return; }
  if (!data.announcements) data.announcements = [];
  data.announcements.push({ id: Date.now(), title: t, text: x, active: a, date: new Date().toISOString().split('T')[0] });
  await saveData(); hideModal(); renderAnns();
  toast('تم الإضافة', 'ok');
}
function editAnn(i) {
  const a = data.announcements[i];
  const body = document.getElementById('modal-body');
  document.getElementById('modal-title').textContent = '✏️ تعديل إعلان';
  body.innerHTML = `
    <div class="fg"><label>العنوان</label><input type="text" id="eat" value="${esc(a.title)}"></div>
    <div class="fg"><label>النص</label><input type="text" id="eax" value="${esc(a.text||'')}"></div>
    <div class="fg"><label class="chk"><input type="checkbox" id="eaa" ${a.active?'checked':''}> <span>نشط</span></label></div>
    <button class="save" onclick="saveEditAnn(${i})">حفظ</button>`;
  showModal();
}
async function saveEditAnn(i) {
  const t = document.getElementById('eat').value.trim();
  const x = document.getElementById('eax').value.trim();
  const a = document.getElementById('eaa').checked;
  if (!t) { toast('العنوان مطلوب', 'bad'); return; }
  data.announcements[i] = { ...data.announcements[i], title: t, text: x, active: a };
  await saveData(); hideModal(); renderAnns();
  toast('تم التعديل', 'ok');
}
async function delAnn(i) {
  if (!confirm('حذف الإعلان؟')) return;
  data.announcements.splice(i, 1);
  await saveData(); renderAnns();
  toast('تم الحذف', 'ok');
}

// ===== SAVE =====
async function saveData() {
  const content = btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2))));
  let sha = null;
  try { const d = await api('/contents/content.json'); sha = d.sha; } catch (e) {}
  const body = { message: 'Update v3', content, branch: BRANCH };
  if (sha) body.sha = sha;
  await api('/contents/content.json', 'PUT', body);
}

// ===== MODAL =====
function showModal() { document.getElementById('modal-bg').classList.add('on'); }
function hideModal() { document.getElementById('modal-bg').classList.remove('on'); upFile = null; }

// ===== SETUP =====
function setup() {
  document.getElementById('logout').onclick = () => { sessionStorage.removeItem('admin_auth'); location.href = 'index.html'; };
  document.getElementById('modal-x').onclick = hideModal;
  document.getElementById('modal-bg').onclick = e => { if (e.target.id === 'modal-bg') hideModal(); };
  document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
}

// ===== UTILS =====
function esc(t) { if (!t) return ''; const d = document.createElement('div'); d.textContent = t; return d.innerHTML; }
function toast(msg, type) {
  const el = document.getElementById('toast');
  el.textContent = msg; el.className = 'toast ' + type; el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2500);
}
