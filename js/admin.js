let data = { version: '3.0.0.0', sections: [], announcements: [], about: {}, admin: { username: 'admin', passwordHash: '' } };
let stack = [];
let upFile = null;
const ADMIN_API = 'https://hashed-fatimi-admin.alhashedalfatimy-admin.workers.dev';
const THEME_KEY = 'alhashd_theme';

function getToken() {
  return sessionStorage.getItem('admin_session') || '';
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
  if (!sessionStorage.getItem('admin_auth') || !sessionStorage.getItem('admin_session')) { location.href = 'index.html'; return; }
  applyTheme(localStorage.getItem(THEME_KEY) || 'dark');
  // Authentication and writes are handled by the server-side API.
  try { await load(); await ensureDefaultMediaFolders(); setup(); renderSections(); startAdminSync(); } catch (e) { toast('خطأ في التحميل', 'bad'); }
});

async function ensureDefaultMediaFolders() {
 const orderedFolders=[
  'النبي محمد صلى الله عليه وآله وسلم',
  'السيدة فاطمة الزهراء عليها السلام',
  'الإمام علي بن أبي طالب عليه السلام',
  'الإمام الحسن بن علي عليه السلام',
  'الإمام الحسين بن علي عليه السلام',
  'الإمام علي زين العابدين عليه السلام',
  'الإمام محمد الباقر عليه السلام',
  'الإمام جعفر الصادق عليه السلام',
  'الإمام موسى الكاظم عليه السلام',
  'الإمام علي الرضا عليه السلام',
  'الإمام محمد الجواد عليه السلام',
  'الإمام علي الهادي عليه السلام',
  'الإمام الحسن العسكري عليه السلام',
  'الإمام محمد المهدي عجل الله فرجه'
 ];
 const categories=[
  {name:'صور',icon:'🖼️',type:'image',aliases:['صور','الصور']},
  {name:'فيديوهات',icon:'🎥',type:'video',aliases:['فيديوهات','الفيديوهات','فيديو','الفيديو']},
  {name:'صوتيات',icon:'🎧',type:'audio',aliases:['صوتيات','الصوتيات','صوت','الصوت']}
 ];
 const normalize=value=>String(value||'').replace(/[\u064B-\u065F\u0670]/g,'').replace(/[أإآ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي').replace(/[\sـ]/g,'').toLowerCase();
 const identity=value=>normalize(value).replace(/صلىاللهوعليهوالهوسلم|عليهاالسلام|عليهالسلام|عجلاللهفرجه|الامام/g,'').replace(/بنابيطالب|بن علي|زينالعابدين/g,'');
 let changed=false;if(!Array.isArray(data.sections))data.sections=[];
 let home=data.sections.find(section=>String(section.id)==='home');
 if(!home){home={id:'home',name:'الرئيسية',icon:'🏠',folders:[],items:[]};data.sections.push(home);changed=true;}
 if(!Array.isArray(home.folders))home.folders=[];
 if(home.folders.length){home.folders=[];changed=true;}
 for(const spec of categories){
  const aliases=new Set(spec.aliases.map(normalize));
  let section=data.sections.find(item=>String(item.parentId||'')==='home'&&aliases.has(normalize(item.name)));
  if(!section){section={id:'s'+Date.now()+Math.random().toString(36).slice(2,7),name:spec.name,icon:spec.icon,parentId:'home',defaultType:spec.type,folders:[],items:[]};data.sections.push(section);changed=true;}
  section.parentId='home';if(!section.icon)section.icon=spec.icon;if(!section.defaultType)section.defaultType=spec.type;
  if(!Array.isArray(section.folders))section.folders=[];if(!Array.isArray(section.items))section.items=[];
  const byIdentity=new Map();
  section.folders.forEach(folder=>{const key=identity(folder.name);if(!byIdentity.has(key))byIdentity.set(key,folder);});
  const ordered=[];
  for(const name of orderedFolders){
   const key=identity(name);let folder=byIdentity.get(key);
   if(!folder){folder={id:'f'+Date.now()+Math.random().toString(36).slice(2,8),name};changed=true;}
   else if(folder.name!==name){folder.name=name;changed=true;}
   ordered.push(folder);
  }
  const orderedIds=new Set(ordered.map(folder=>String(folder.id)));
  const extras=section.folders.filter(folder=>!orderedIds.has(String(folder.id)));
  section.folders=[...ordered,...extras];
 }
 if(changed)await saveData();
}

async function load() {
  const r = await fetch(ADMIN_API + '/api/contents/content.json?nocache=' + Date.now(), { cache: 'no-store' });
  if (!r.ok) throw new Error('تعذر تحميل بيانات الموقع (HTTP ' + r.status + ')');
  data = await r.json();
  if (!Array.isArray(data.sections)) data.sections = [];
  // The homepage has its own data container and is never a user-created section.
  let homeSection = data.sections.find(section => String(section.id) === 'home');
  if (!homeSection) {
    homeSection = { id: 'home', name: 'الرئيسية', icon: '🏠', folders: [], items: [] };
    data.sections.push(homeSection);
    await saveData();
  } else {
    homeSection.name = 'الرئيسية';
    homeSection.icon = '🏠';
    if (!Array.isArray(homeSection.folders)) homeSection.folders = [];
    if (!Array.isArray(homeSection.items)) homeSection.items = [];
    data.sections = data.sections.filter(section => String(section.id) !== 'home');
    data.sections.push(homeSection);
  }
  if (!data.announcements) data.announcements = [];
  if (!data.about) data.about = {};
  if (!data.admin) data.admin = { username: 'admin', passwordHash: '' };
}


async function api(path, method = 'GET', body) {
  const url = ADMIN_API + '/api' + path;
  const headers = { 'Accept': 'application/json', 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = 'Bearer ' + token;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);
  try {
    const r = await fetch(url, {
      method,
      signal: controller.signal,
      headers,
      cache: 'no-store',
      body: body ? JSON.stringify(body) : undefined
    });
    const result = await r.json().catch(() => ({}));
    if (!r.ok) {
      if (r.status === 401) {
        sessionStorage.removeItem('admin_auth');
        sessionStorage.removeItem('admin_session');
      }
      throw new Error(result.error || 'تعذر إتمام الطلب (HTTP ' + r.status + ')');
    }
    return result;
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('انتهت مهلة الاتصال. تحقق من الإنترنت ثم أعد المحاولة');
    throw e;
  } finally {
    clearTimeout(timeoutId);
  }
}

function push(type, d) { stack.push({ type, ...d }); render(); }
function pop() { stack.pop(); render(); }
function render() {
  const c = stack[stack.length - 1];
  if (!c || c.type === 'sections') renderSections();
  else if (c.type === 'folderSections') renderFolderSections();
  else if (c.type === 'section') renderSection(c.id);
  else if (c.type === 'folder') renderFolder(c.sid, c.fid);
  else if (c.type === 'anns') renderAnns();
  else if (c.type === 'about') renderAboutEdit();
}

// ===== SECTIONS =====
function renderSections() {
 stack=[{type:'sections'}]; const view=document.getElementById('view');
 const secs=(data.sections||[]).filter(s=>String(s.id)!=='home'&&!s.parentId);
 let html='<div class="page-title">📋 إدارة الأقسام الرئيسية</div><div class="page-title" style="font-size:.78rem;color:var(--text2);font-weight:600;">صفحات الموقع الأساسية</div>';
 [{name:'الرئيسية',icon:'🏠',note:'صفحة عرض محتوى الموقع'},{name:'الإعلانات',icon:'📢',note:'صفحة الإعلانات المنشورة'},{name:'عن التطبيق',icon:'ℹ️',note:'معلومات التطبيق'}].forEach(x=>{html+=`<div class="card glass" style="cursor:default;"><div class="info"><div class="icon">${x.icon}</div><div><div class="name">${x.name}</div><div class="meta">${x.note} · صفحة ثابتة</div></div></div></div>`;});
 html+='<div class="page-title">الأقسام الرئيسية القابلة للإدارة</div>';
 if(!secs.length) html+='<div class="empty"><div class="ei">📂</div><div>لا توجد أقسام إضافية</div></div>';
 else secs.forEach(s=>{const i=data.sections.indexOf(s),cc=data.sections.filter(c=>String(c.parentId||'')===String(s.id)).length;html+=`<div class="card glass" onclick="push('section',{id:'${String(s.id).replace(/'/g,'&#39;')}'})"><div class="info"><div class="icon">${s.icon||'📁'}</div><div><div class="name">${esc(s.name)}</div><div class="meta">${cc} قسم فرعي · ${s.folders?.length||0} مجلد</div></div></div><div class="actions"><button class="ed" onclick="event.stopPropagation();editSec(${i})">✏️</button><button class="del" onclick="event.stopPropagation();delSec(${i})">🗑</button></div></div>`;});
 html+=`<div class="fab glass" onclick="openAddSec()">➕ إضافة قسم رئيسي</div><div class="fab glass" onclick="push('folderSections',{})">📁 إدارة الأقسام والمجلدات</div><div class="fab glass" onclick="push('anns',{})">📢 نشر إعلان</div><div class="fab glass" onclick="push('about',{})">ℹ️ إدارة معلومات التطبيق</div>`;
 view.innerHTML=html;window.scrollTo(0,0);
}
function renderFolderSections() {
 const view=document.getElementById('view');
 let html=`<div class="breadcrumb"><button class="back glass" onclick="pop()">← رجوع</button><span class="sep">|</span><span class="crumb">📁 إدارة الأقسام والمجلدات</span></div><div class="page-title">اختر القسم الذي تريد إدارته أو إنشاء أقسام فرعية بداخله</div>`;
 const home=data.sections.find(s=>String(s.id)==='home');
 const secs=[home,...(data.sections||[]).filter(s=>String(s.id)!=='home'&&!s.parentId)].filter(Boolean);
 if(!secs.length)html+='<div class="empty"><div class="ei">📂</div><div>لا توجد أقسام</div></div>';
 else secs.forEach(s=>{const cc=data.sections.filter(c=>String(c.parentId||'')===String(s.id)).length;html+=`<div class="card glass" onclick="push('section',{id:'${String(s.id).replace(/'/g,'&#39;')}'})"><div class="info"><div class="icon">${s.icon||'📁'}</div><div><div class="name">${esc(s.name)}</div><div class="meta">${cc} قسم فرعي · ${s.folders?.length||0} مجلد</div></div></div><div class="actions"><span style="color:var(--accent-light);font-weight:800;">إدارة ←</span></div></div>`;});
 view.innerHTML=html;window.scrollTo(0,0);
}
let adminSyncTimer = null;
let adminSyncInProgress = false;
let adminWritesInProgress = 0;
async function syncAdminData() {
  if (adminSyncInProgress || adminWritesInProgress || document.hidden || document.getElementById('modal-bg')?.classList.contains('on')) return;
  adminSyncInProgress = true;
  try {
    const r = await fetch(ADMIN_API + '/api/contents/content.json?nocache=' + Date.now(), { cache: 'no-store' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const latest = await r.json();
    if (!latest || !Array.isArray(latest.sections)) return;
    if (!latest.announcements) latest.announcements = [];
    if (!latest.about) latest.about = {};
    if (!latest.admin) latest.admin = { username: 'admin', passwordHash: '' };
    if (JSON.stringify(latest) !== JSON.stringify(data)) {
      data = latest;
      render();
    }
  } catch (e) {
    console.warn('تعذر مزامنة بيانات الإدارة:', e);
  } finally {
    adminSyncInProgress = false;
  }
}
function startAdminSync() {
  if (adminSyncTimer) clearInterval(adminSyncTimer);
  adminSyncTimer = setInterval(syncAdminData, 30000);
  window.addEventListener('focus', syncAdminData);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) syncAdminData(); });
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

function renderSection(sid) {
 const view=document.getElementById('view'),sec=data.sections?.find(s=>String(s.id)===String(sid));
 if(!sec){pop();return;}
 const folders=sec.folders||[],children=(data.sections||[]).filter(c=>String(c.parentId||'')===String(sec.id));
 let html=`<div class="breadcrumb"><button class="back glass" onclick="pop()">← رجوع</button><span class="sep">|</span><span class="crumb">${esc(sec.name)}</span></div><div class="page-title">${sec.id==='home'?'🏠 تنظيم محتوى الرئيسية':'📁 إدارة: '+esc(sec.name)}</div>`;
 if(children.length){html+='<div class="page-title" style="font-size:.82rem;color:var(--text2);">الأقسام الفرعية</div>';children.forEach(c=>{const i=data.sections.indexOf(c),cc=data.sections.filter(n=>String(n.parentId||'')===String(c.id)).length;html+=`<div class="card glass" onclick="push('section',{id:'${String(c.id).replace(/'/g,'&#39;')}'})"><div class="info"><div class="icon">${c.icon||'📁'}</div><div><div class="name">${esc(c.name)}</div><div class="meta">${cc} قسم فرعي · ${c.folders?.length||0} مجلد</div></div></div><div class="actions"><button class="ed" onclick="event.stopPropagation();editSec(${i})">✏️</button><button class="del" onclick="event.stopPropagation();delSec(${i})">🗑</button></div></div>`;});}
 if(folders.length&&String(sec.id)!=='home')html+='<div class="page-title" style="font-size:.82rem;color:var(--text2);">المجلدات التابعة لهذا القسم</div>';
 if(!folders.length&&!children.length)html+='<div class="empty"><div class="ei">📁</div><div>لا توجد أقسام فرعية أو مجلدات في هذا المستوى</div></div>';
 else if(String(sec.id)!=='home')folders.forEach((f,i)=>{const cnt=(sec.items||[]).filter(x=>String(x.folderId)===String(f.id)).length;html+=`<div class="card glass" onclick="push('folder',{sid:'${String(sec.id).replace(/'/g,'&#39;')}',fid:'${String(f.id).replace(/'/g,'&#39;')}'})"><div class="info"><div class="icon">📁</div><div><div class="name">${esc(f.name)}</div><div class="meta">${cnt} عنصر</div></div></div><div class="actions"><button class="ed" onclick="event.stopPropagation();editFld('${String(sec.id).replace(/'/g,'&#39;')}',${i})">✏️</button><button class="del" onclick="event.stopPropagation();delFld('${String(sec.id).replace(/'/g,'&#39;')}',${i})">🗑</button></div></div>`;});
 html+=`<div class="fab glass" onclick="openAddSec('${String(sec.id).replace(/'/g,'&#39;')}')">➕ إضافة قسم فرعي داخل هذا المستوى</div>`;
 if(String(sec.id)!=='home')html+=`<div class="fab glass" onclick="openAddFld('${String(sec.id).replace(/'/g,'&#39;')}')">📁 إضافة مجلد داخل هذا القسم</div>`;
 view.innerHTML=html;window.scrollTo(0,0);
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
    <div class="upload-zone glass" id="uz"><div class="u-icon">📤</div><div class="u-text">${(sid === 'fonts' || sec?.defaultType === 'font') ? 'اضغط لإرفاق ملفات الخطوط' : 'اضغط لإضافة وسائط'}</div>
    <input type="file" id="uf" multiple accept="${(sid === 'fonts' || sec?.defaultType === 'font') ? '.ttf,.otf,.woff,.woff2,.ttc,font/ttf,font/otf,font/woff,font/woff2' : 'image/*,video/*,audio/*'}" style="display:none;"></div>`;
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
    <div class="page-title">📢 إدارة ونشر الإعلانات</div>`;
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
  html += `<div class="fab glass" onclick="openAddAnn()">📢 نشر إعلان جديد</div>`;
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
  if (sec?.id === 'fonts') preview = `<div style="font-size:2.5rem;margin-bottom:14px;">🔤</div><div>${esc(upFile.name)}</div>`;
  else if (upFile.type.startsWith('image/')) preview = `<img src="${url}" style="max-width:100%;max-height:160px;border-radius:12px;margin-bottom:14px;">`;
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
    const secForUpload = data.sections?.find(s => s.id === sid);
    if (!secForUpload) throw new Error('القسم المحدد غير موجود');
    const isFont = sid === 'fonts' || secForUpload.defaultType === 'font';
    const allowedFont = /\.(ttf|otf|woff2?|ttc)$/i.test(upFile.name);
    if (isFont && !allowedFont) throw new Error('صيغة الخط غير مدعومة. استخدم TTF أو OTF أو WOFF أو WOFF2 أو TTC');
    const fname = Date.now() + '_' + upFile.name.replace(/[^\p{L}\p{N}._-]+/gu, '_');
    const path = 'uploads/' + fname;
    const reader = new FileReader();
    reader.readAsDataURL(upFile);
    reader.onloadend = async () => {
      try {
        const b64 = reader.result.split(',')[1];
        const savedFile = await api('/uploads/' + fname, 'PUT', { content: b64, contentType: upFile.type });
        const furl = savedFile.url;
        const sec = data.sections?.find(s => s.id === sid);
        if (!sec) throw new Error('القسم المحدد غير موجود');
        const fontMime = ({ ttf: 'font/ttf', otf: 'font/otf', woff: 'font/woff', woff2: 'font/woff2', ttc: 'font/collection' })[upFile.name.split('.').pop().toLowerCase()];
        const item = {
          id: Date.now(), title, description: desc,
          folderId: fid, url: furl, fileName: upFile.name,
          type: isFont ? 'font' : (sec.defaultType || (sid === 'images' ? 'image' : sid === 'videos' ? 'video' : 'audio')),
          contentType: upFile.type || fontMime || 'application/octet-stream',
          visibility: priv?'private':'public',
          allowDownload: dl, allowShare: sh
        };
        if (sid === 'images') item.thumbnail = furl;
        else if (sid === 'videos') item.thumbnail = furl;
        else if (sid === 'fonts') item.fileName = upFile.name;
        else { item.cover = furl; item.duration = '--:--'; }
        if (!sec.items) sec.items = [];
        sec.items.push(item);
        await saveData();
        hideModal(); renderFolder(sid, fid);
        toast('تم الرفع', 'ok');
      } catch (err) {
        toast('تعذر رفع الملف: ' + (err.message || 'خطأ غير معروف'), 'bad');
      }
    };
    reader.onerror = () => toast('تعذر قراءة الملف المحدد', 'bad');
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
 const n=document.getElementById('esn').value.trim(),ic=document.getElementById('esi').value.trim();
 if(!n){toast('الاسم مطلوب','bad');return;}
 const s=data.sections[i];if(!s){toast('القسم غير موجود','bad');return;}
 s.name=n;s.icon=ic;await saveData();hideModal();
 if(s.parentId)renderSection(s.parentId);else renderSections();
 toast('تم التعديل','ok');
}
async function delSec(i) {
 const section=data.sections[i];
 if(!section||String(section.id)==='home'){toast('لا يمكن حذف الصفحة الرئيسية','bad');return;}
 const ids=new Set([String(section.id)]);let changed=true;
 while(changed){changed=false;(data.sections||[]).forEach(s=>{if(s.parentId&&ids.has(String(s.parentId))&&!ids.has(String(s.id))){ids.add(String(s.id));changed=true;}});}
 const removed=data.sections.filter(s=>ids.has(String(s.id)));
 const fc=removed.reduce((n,s)=>n+(s.folders||[]).length,0),ic=removed.reduce((n,s)=>n+(s.items||[]).length,0);
 if(!confirm(`حذف القسم "${section.name}" وجميع أقسامه الفرعية (${removed.length}) ومجلداته (${fc}) وملفاته (${ic})؟`))return;
 const previous=data.sections.slice();data.sections=data.sections.filter(s=>!ids.has(String(s.id)));
 try{await saveData();renderSections();toast('تم حذف القسم وجميع المستويات التابعة له','ok');}
 catch(e){data.sections=previous;renderSections();toast('تعذر حذف القسم: '+e.message,'bad');}
}
function openAddSec(parentId=null) {
 const parent=parentId==null?null:data.sections.find(s=>String(s.id)===String(parentId));
 if(parentId!=null&&!parent){toast('القسم الأب غير موجود','bad');return;}
 const body=document.getElementById('modal-body');document.getElementById('modal-title').textContent=parent?'➕ قسم فرعي جديد':'➕ قسم رئيسي جديد';
 const parentField=parent?`<div class="fg"><label>القسم الأب</label><input type="text" value="${esc(parent.name)}" disabled></div>`:'';
 const parentArg=parent?"'"+String(parent.id).replace(/'/g,"\\'")+"'":"null";
 body.innerHTML=`<div class="fg"><label>الاسم</label><input type="text" id="nsn" placeholder="اكتب اسم القسم"></div><div class="fg"><label>الأيقونة</label><input type="text" id="nsi" value="📁" maxlength="2"></div><div class="fg"><label>نوع المحتوى الافتراضي</label><select id="nst"><option value="image">🖼 صور</option><option value="video">🎥 فيديو</option><option value="audio">🎧 صوت</option><option value="font">🔤 خطوط</option></select></div>${parentField}<button class="save" onclick="saveNewSec(${parentArg})">حفظ</button>`;
 showModal();
}
async function saveNewSec(parentId=null) {
 const n=document.getElementById('nsn').value.trim(),ic=document.getElementById('nsi').value.trim()||'📁',t=document.getElementById('nst').value;
 if(!n){toast('الاسم مطلوب','bad');return;}
 if(parentId!=null&&!data.sections.some(s=>String(s.id)===String(parentId))){toast('القسم الأب غير موجود','bad');return;}
 const section={id:'s'+Date.now()+Math.random().toString(36).slice(2,6),name:n,icon:ic,folders:[],items:[],defaultType:t};
 if(parentId!=null)section.parentId=String(parentId);
 const button=document.querySelector('#modal-body .save');if(button){button.disabled=true;button.textContent='جارٍ الحفظ...';}
 const hi=data.sections.findIndex(s=>String(s.id)==='home');if(hi>=0)data.sections.splice(hi,0,section);else data.sections.push(section);
 try{await saveData();hideModal();if(parentId==null)renderSections();else renderSection(parentId);toast('تم حفظ القسم في مستواه الصحيح','ok');}
 catch(e){data.sections=data.sections.filter(s=>String(s.id)!==String(section.id));if(button){button.disabled=false;button.textContent='حفظ';}toast('لم يُحفظ القسم: '+(e.message||'تحقق من الاتصال ثم أعد المحاولة'),'bad');}
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
  if (!sec || !sec.folders?.[i]) { toast('المجلد غير موجود', 'bad'); return; }
  const previousName = sec.folders[i].name;
  const button = document.querySelector('#modal-body .save');
  if (button) { button.disabled = true; button.textContent = 'جارٍ الحفظ...'; }
  sec.folders[i].name = n;
  try {
    await saveData();
    hideModal(); renderSection(sid);
    toast('تم التعديل', 'ok');
  } catch (e) {
    sec.folders[i].name = previousName;
    if (button) { button.disabled = false; button.textContent = 'حفظ'; }
    toast('تعذر تعديل المجلد: ' + e.message, 'bad');
  }
}
async function delFld(sid, i) {
  const sec = data.sections?.find(s => String(s.id) === String(sid));
  const folder = sec?.folders?.[i];
  if (!sec || !folder) { toast('المجلد غير موجود', 'bad'); return; }

  const ids = new Set();
  const collect = current => {
    if (!current || ids.has(String(current.id))) return;
    ids.add(String(current.id));
    const embedded = current.folders || current.subfolders || current.children || [];
    embedded.forEach(collect);
    (sec.folders || []).filter(candidate =>
      String(candidate.parentId || candidate.parentFolderId || '') === String(current.id)
    ).forEach(collect);
  };
  collect(folder);
  const removedItems = (sec.items || []).filter(item => ids.has(String(item.folderId)));
  if (!confirm(`حذف المجلد "${folder.name}" ومجلداته الفرعية و${removedItems.length} عنصر تابع له؟ لن تتأثر بقية المجلدات أو الأقسام.`)) return;

  const previousFolders = sec.folders.slice();
  const previousItems = (sec.items || []).slice();
  sec.folders = sec.folders.filter(f => !ids.has(String(f.id)));
  sec.items = (sec.items || []).filter(item => !ids.has(String(item.folderId)));
  try {
    await saveData();
    renderSection(sid);
    toast('تم حذف المجلد ومحتوياته التابعة', 'ok');
  } catch (e) {
    sec.folders = previousFolders;
    sec.items = previousItems;
    renderSection(sid);
    toast('تعذر حذف المجلد: ' + e.message, 'bad');
  }
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
  const input = document.getElementById('nfn');
  const button = document.querySelector('#modal-body .save');
  const n = input.value.trim();
  if (!n) { toast('الاسم مطلوب', 'bad'); input.focus(); return; }
  const sec = data.sections?.find(s => String(s.id) === String(sid));
  if (!sec) { toast('تعذر العثور على القسم', 'bad'); return; }
  if (!Array.isArray(sec.folders)) sec.folders = [];
  const folder = { id: 'f' + Date.now(), name: n };
  if (button) { button.disabled = true; button.textContent = 'انتظر... جارٍ حفظ المجلد'; button.setAttribute('aria-busy', 'true'); }
  input.disabled = true;
  toast('انتظر... جارٍ إضافة المجلد', 'ok');
  sec.folders.push(folder);
  // Render optimistically so the new folder appears immediately in the chosen section.
  renderSection(sid);
  try {
    await saveData();
    hideModal();
    renderSection(sid);
    toast('تمت إضافة المجلد بنجاح', 'ok');
  } catch (e) {
    // Roll back the optimistic UI change if the remote save fails.
    sec.folders = sec.folders.filter(f => String(f.id) !== String(folder.id));
    renderSection(sid);
    if (button) { button.disabled = false; button.textContent = 'حفظ'; button.removeAttribute('aria-busy'); }
    input.disabled = false;
    toast('لم يُحفظ المجلد: ' + (e.message || 'تحقق من الاتصال ثم أعد المحاولة'), 'bad');
  }
}

// ===== ANNOUNCEMENT CRUD =====
function openAddAnn() {
  const body = document.getElementById('modal-body');
  document.getElementById('modal-title').textContent = '📢 نشر إعلان جديد';
  body.innerHTML = `
    <div class="fg"><label>العنوان</label><input type="text" id="nat" placeholder="عنوان الإعلان"></div>
    <div class="fg"><label>النص</label><input type="text" id="nax" placeholder="نص الإعلان"></div>
    <div class="fg"><label class="chk"><input type="checkbox" id="naa" checked> <span>نشط</span></label></div>
    <button class="save" onclick="saveNewAnn()">نشر الإعلان</button>`;
  showModal();
}
async function saveNewAnn() {
  const t = document.getElementById('nat').value.trim();
  const x = document.getElementById('nax').value.trim();
  const a = document.getElementById('naa').checked;
  if (!t) { toast('العنوان مطلوب', 'bad'); return; }
  if (!data.announcements) data.announcements = [];
  const announcement = { id: Date.now(), title: t, text: x, active: a, date: new Date().toISOString().split('T')[0] };
  const button = document.querySelector('#modal-body .save');
  if (button) { button.disabled = true; button.textContent = 'جارٍ النشر...'; }
  data.announcements.push(announcement);
  try {
    await saveData();
    hideModal();
    renderAnns();
    toast('تم نشر الإعلان بنجاح', 'ok');
  } catch (e) {
    data.announcements = data.announcements.filter(item => String(item.id) !== String(announcement.id));
    if (button) { button.disabled = false; button.textContent = 'نشر الإعلان'; }
    toast('تعذر نشر الإعلان: ' + e.message, 'bad');
  }
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
let saveQueue = Promise.resolve();
function saveData() {
  adminWritesInProgress += 1;
  const operation = saveQueue.catch(() => {}).then(() => {
    const content = JSON.stringify(data, null, 2);
    return api('/contents/content.json', 'PUT', { content });
  });
  saveQueue = operation.finally(() => {
    adminWritesInProgress = Math.max(0, adminWritesInProgress - 1);
  });
  return saveQueue;
}

// ===== MODAL =====
function showModal() { document.getElementById('modal-bg').classList.add('on'); }
function hideModal() { document.getElementById('modal-bg').classList.remove('on'); upFile = null; }

// ===== SETUP =====
function setup() {
  document.getElementById('logout').onclick = () => { sessionStorage.removeItem('admin_auth'); sessionStorage.removeItem('admin_session'); location.href = 'index.html'; };
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
