// ===== State =====
let allData = { version: '3.0.0.0', sections: [], announcements: [], about: {}, admin: {} };
let currentPage = 'home';
let currentSecId = null;
let currentFoldId = null;
let currentView = 'home';
let folderReturnState = null;
const NAV_STATE_KEY = 'alhashd_public_navigation_v1';
let mediaList = [];
let mediaIdx = 0;
let audioEl = null;
let isPlaying = false;
let audioIdx = 0;
let audioItems = [];
let logoClicks = 0;
let logoTimer = null;
let installPrompt = null;
let theme = localStorage.getItem('alhashd_theme') || 'dark';

// ===== Unified theme key =====
const THEME_KEY = 'alhashd_theme';

// ===== Init =====
document.addEventListener('DOMContentLoaded', async () => {
  applyTheme(theme);
  try {
    await loadData();
    setupEvents();
    setupPWA();
    renderNavigation();
    renderHome();
    restoreNavigationState();
    startPublicSync();
    showAnnouncement();
    updateAnnBadge();
    renderAboutPage();
  } catch (e) {
    console.error(e);
    toast('خطأ في التحميل', 'bad');
  }
});

// ===== Theme =====
function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  const btn = document.getElementById('theme-toggle');
  if (btn) btn.textContent = t === 'dark' ? '☀️' : '🌙';
  const metaTheme = document.querySelector('meta[name="theme-color"]');
  if (metaTheme) metaTheme.setAttribute('content', t === 'dark' ? '#000000' : '#ffffff');
}

function toggleTheme() {
  theme = theme === 'dark' ? 'light' : 'dark';
  localStorage.setItem(THEME_KEY, theme);
  applyTheme(theme);
}

// ===== Listen for theme changes from other tabs/pages =====
window.addEventListener('storage', (e) => {
  if (e.key === THEME_KEY) {
    theme = e.newValue || 'dark';
    applyTheme(theme);
  }
});

// ===== Load Data =====
async function loadData() {
  const sources = [
    'https://hashed-fatimi-admin.alhashedalfatimy-admin.workers.dev/api/contents/content.json?nocache=' + Date.now(),
    'content.json?nocache=' + Date.now()
  ];
  let lastError = null;
  for (const source of sources) {
    try {
      const r = await fetch(source, { cache: 'no-store' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const loaded = await r.json();
      if (!loaded || !Array.isArray(loaded.sections)) throw new Error('بيانات المحتوى غير صالحة');
      allData = loaded;
      if (!allData.announcements) allData.announcements = [];
      if (!allData.about) allData.about = {};
      if (!allData.admin) allData.admin = {};
      return;
    } catch (e) {
      lastError = e;
      console.warn('Data source unavailable:', source, e);
    }
  }
  throw lastError || new Error('تعذر تحميل البيانات');
}


function renderNavigation() {
 const nav=document.querySelector('.bnav');if(!nav)return;nav.innerHTML='';
 const addButton=(page,icon,label,action)=>{const b=document.createElement('button');b.type='button';b.dataset.page=page;b.innerHTML='<span class="ni"></span><span></span>';b.children[0].textContent=icon;b.children[1].textContent=label;b.addEventListener('click',action);nav.appendChild(b);return b;};
 addButton('home','🏠','الرئيسية',goHome);
 (allData.sections||[]).filter(s=>String(s.id)!=='home'&&!s.parentId).forEach(s=>addButton(String(s.id),s.icon||'📁',s.name||'قسم',()=>navTo(String(s.id))));
 addButton('announcements','📢','إعلانات',()=>navTo('announcements'));
 const ab=nav.querySelector('button[data-page="announcements"]');if(ab){const badge=document.createElement('span');badge.className='badge';badge.id='ann-badge';ab.insertBefore(badge,ab.children[1]);}
 addButton('about','ℹ️','عن التطبيق',()=>navTo('about'));updateAnnBadge();
 const active=Array.from(nav.querySelectorAll('button')).find(b=>b.dataset.page===String(currentPage));if(active)active.classList.add('on');
}
let publicSyncTimer = null;
let publicSyncInProgress = false;
async function syncPublicData() {
 if(publicSyncInProgress||document.hidden)return;
 publicSyncInProgress=true;
 try{
  const previous=JSON.stringify(allData);await loadData();
  if(previous===JSON.stringify(allData))return;
  renderNavigation();renderHome();showAnnouncement();updateAnnBadge();
  if(currentView==='announcements'||currentPage==='announcements')renderAnnouncementsPage();
  else if(currentView==='about'||currentPage==='about')renderAboutPage();
  else if(currentView==='folderDirectory'&&currentSecId){
   const activeSection=(allData.sections||[]).find(sec=>String(sec.id)===String(currentSecId));
   if(activeSection)openFolderDirectory(currentSecId);
   else{currentSecId=null;currentFoldId=null;navTo('home');}
  }else if(currentSecId&&currentFoldId){
   const activeSection=(allData.sections||[]).find(sec=>String(sec.id)===String(currentSecId));
   if(activeSection&&findFolderPath(activeSection,currentFoldId))openFolder(currentSecId,currentFoldId);
   else if(activeSection)openSection(currentSecId);
   else{currentSecId=null;currentFoldId=null;navTo('home');}
  }else if(currentPage!=='home'&&(allData.sections||[]).some(sec=>String(sec.id)===String(currentPage)))openSection(currentPage);
  else if(currentPage!=='home'){currentSecId=null;currentFoldId=null;navTo('home');}
 }catch(e){console.warn('تعذرت مزامنة أقسام الموقع:',e);}
 finally{publicSyncInProgress=false;}
}
function startPublicSync() {
  if (publicSyncTimer) clearInterval(publicSyncTimer);
  publicSyncTimer = setInterval(syncPublicData, 30000);
  window.addEventListener('focus', syncPublicData);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) syncPublicData(); });
}

// ===== Render Home =====
function renderHome() {
 const container=document.getElementById('home-content');
 if(!container)return;
 const children=(allData.sections||[]).filter(s=>String(s.parentId||'')==='home');
 let html='';
 children.forEach(sec=>{
  const folders=getFolderTree(sec).roots,preview=folders.slice(0,2);
  html+='<section class="sec-group"><div class="sec-header"><div class="sec-label"><span class="ic">'+escapeHtml(sec.icon||'📁')+'</span><span>'+escapeHtml(sec.name)+'</span></div></div>';
  if(preview.length){
   html+='<div class="home-folder-strip" style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;padding:0 16px;align-items:stretch;">';
   preview.forEach(folder=>{
    const count=(sec.items||[]).filter(item=>String(item.folderId)===String(folder.id)).length;
    html+='<button type="button" class="folder-line glass home-folder-card" data-home-section="'+escapeHtml(String(sec.id))+'" data-home-folder="'+escapeHtml(String(folder.id))+'" style="min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:12px 5px;border-radius:13px;text-align:center;color:var(--text);font:inherit;cursor:pointer;"><span style="font-size:1.8rem;line-height:1.2;">📁</span><span class="fnm" style="font-size:.72rem;line-height:1.5;white-space:normal;overflow-wrap:anywhere;">'+escapeHtml(folder.name)+'</span><span class="fcnt" style="font-size:.62rem;">'+count+' عنصر</span></button>';
   });
   if(folders.length>2){
    html+='<button type="button" class="back glass home-more-folders" data-home-section="'+escapeHtml(String(sec.id))+'" style="min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:7px;padding:10px 5px;border-radius:13px;text-align:center;white-space:normal;font:inherit;font-size:.72rem;font-weight:800;line-height:1.5;backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.2);box-shadow:inset 0 1px 0 rgba(255,255,255,.16),0 5px 18px rgba(0,0,0,.08);cursor:pointer;"><span style="font-size:1.45rem;">☷</span><span>دخول بقية الأقسام</span></button>';
   }
   html+='</div>';
  } else html+='<div class="empty"><div class="ei">📂</div><div class="et">لا توجد مجلدات في هذا القسم بعد</div></div>';
  html+='</section>';
 });
 if(!children.length)html='<div class="empty"><div class="ei">📂</div><div class="et">لا توجد أقسام بعد</div></div>';
 container.innerHTML=html;
 container.querySelectorAll('.home-folder-card').forEach(button=>button.addEventListener('click',()=>{
  openFolder(button.dataset.homeSection,button.dataset.homeFolder);
 }));
 container.querySelectorAll('.home-more-folders').forEach(button=>button.addEventListener('click',()=>{
  openFolderDirectory(button.dataset.homeSection);
 }));
}
// ===== Announcement Bar =====
function showAnnouncement() {
  const bar = document.getElementById('ann-bar');
  const txt = document.getElementById('ann-txt');
  const anns = (allData.announcements || []).filter(a => a.active);
  if (anns.length === 0) { bar.classList.remove('on'); return; }
  txt.textContent = anns[0].title + (anns[0].text ? ' — ' + anns[0].text : '');
  bar.classList.add('on');
}
function closeAnn() { document.getElementById('ann-bar').classList.remove('on'); }

// ===== Announcement Badge =====
const ANNOUNCEMENTS_SEEN_KEY = 'alhashd_seen_announcements_v1';
function getSeenAnnouncementIds() {
  try {
    const saved = JSON.parse(localStorage.getItem(ANNOUNCEMENTS_SEEN_KEY) || '[]');
    return new Set(Array.isArray(saved) ? saved.map(String) : []);
  } catch (_) {
    return new Set();
  }
}
function markAnnouncementsAsSeen() {
  const activeIds = (allData.announcements || [])
    .filter(a => a.active)
    .map(a => String(a.id));
  try {
    localStorage.setItem(ANNOUNCEMENTS_SEEN_KEY, JSON.stringify(activeIds));
  } catch (e) {
    console.warn('تعذر حفظ حالة قراءة الإعلانات:', e);
  }
  updateAnnBadge();
}
function updateAnnBadge() {
  const badge = document.getElementById('ann-badge');
  if (!badge) return;
  const seen = getSeenAnnouncementIds();
  const hasUnread = (allData.announcements || []).some(a => a.active && !seen.has(String(a.id)));
  badge.classList.toggle('on', hasUnread);
  badge.setAttribute('aria-label', hasUnread ? 'توجد إعلانات جديدة' : 'لا توجد إعلانات جديدة');
}

// ===== Render Announcements Page =====
function renderAnnouncementsPage() {
  const container = document.getElementById('ann-list');
  const anns = (allData.announcements || []).filter(a => a.active);
  let html = '';
  if (anns.length === 0) {
    html = `<div class="empty"><div class="ei">📢</div><div class="et">لا توجد إعلانات حالياً</div></div>`;
  } else {
    anns.forEach(a => {
      html += `
        <div class="glass" style="padding:16px;margin:10px 0;text-align:right;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
            <span style="font-size:1.2rem;">🔔</span>
            <span style="font-weight:800;color:var(--accent-light);font-size:0.95rem;">${escapeHtml(a.title)}</span>
            <span style="margin-right:auto;font-size:0.7rem;color:var(--text3);">${a.date || ''}</span>
          </div>
          <p style="color:var(--text2);font-size:0.85rem;line-height:1.7;">${escapeHtml(a.text || '')}</p>
        </div>
      `;
    });
  }
  container.innerHTML = html;
}

// ===== Render About Page =====
function renderAboutPage() {
  const container = document.getElementById('about-content');
  if (!container) return;
  const about = allData.about || {};
  const name = about.name || 'الحشد الفاطمي';
  const desc = about.description || 'محتوى ديني من الحرمات المقدسة';
  const version = about.version || '3.0.0.0';
  const updates = about.updates || '';
  const contact = about.contact || '';
  const extra = about.extra || '';

  let html = `
    <img src="icons/logo-new.png" alt="${escapeHtml(name)}" class="ab-logo">
    <h2 class="ab-name">${escapeHtml(name)}</h2>
    <p class="ab-desc">${escapeHtml(desc)}</p>
  `;

  if (updates) {
    html += `
      <div class="ab-card glass">
        <h4>📋 آخر التحديثات</h4>
        <p>${escapeHtml(updates)}</p>
      </div>
    `;
  }

  if (contact) {
    html += `
      <div class="ab-card glass">
        <h4>📞 التواصل</h4>
        <p>${escapeHtml(contact)}</p>
      </div>
    `;
  }

  if (extra) {
    html += `
      <div class="ab-card glass">
        <h4>📌 معلومات إضافية</h4>
        <p>${escapeHtml(extra)}</p>
      </div>
    `;
  }

  html += `<div class="ab-version">الإصدار ${escapeHtml(version)}</div>`;
  container.innerHTML = html;
}

// ===== Navigation =====
function setFolderNavigationMode(active) {
 const nav=document.querySelector('.bnav');
 if(nav)nav.style.display=active?'none':'';
 document.body.classList.toggle('folder-navigation-mode',!!active);
}
function saveNavigationState() {
 try {
  sessionStorage.setItem(NAV_STATE_KEY, JSON.stringify({
   page: currentPage, sectionId: currentSecId, folderId: currentFoldId,
   view: currentView, folderReturnState
  }));
 } catch(e) { console.warn('تعذر حفظ موضع التصفح:', e); }
}
function restoreNavigationState() {
 let saved=null;
 try { saved=JSON.parse(sessionStorage.getItem(NAV_STATE_KEY)||'null'); } catch(e) {}
 if(!saved||!saved.view)return;
 folderReturnState=saved.folderReturnState||null;
 if(saved.view==='folder'&&saved.sectionId&&saved.folderId)openFolder(saved.sectionId,saved.folderId,true);
 else if(saved.view==='folderDirectory'&&saved.sectionId)openFolderDirectory(saved.sectionId);
 else if(saved.view==='section'&&saved.sectionId)openSection(saved.sectionId);
 else if(saved.view==='announcements'||saved.view==='about')navTo(saved.view);
 else navTo('home');
}
function goBackFromFolder() {
 const target=folderReturnState;
 if(!target||target.view==='section'&&!target.sectionId){openSection(currentSecId);return;}
 if(target.view==='folder'&&target.sectionId&&target.folderId)openFolder(target.sectionId,target.folderId,true);
 else if(target.view==='folderDirectory'&&target.sectionId)openFolderDirectory(target.sectionId);
 else if(target.view==='section'&&target.sectionId)openSection(target.sectionId);
 else navTo('home');
}
function navTo(page) {
 setFolderNavigationMode(false);
 if(page!=='home'&&page!=='announcements'&&page!=='about'){openSection(page);return;}
 currentPage=page;currentSecId=null;currentFoldId=null;currentView=page==='home'?'home':page;
 if(page==='home')folderReturnState=null;
 document.querySelectorAll('.page').forEach(x=>x.classList.remove('on'));document.querySelectorAll('.bnav button').forEach(x=>x.classList.remove('on'));
 if(page==='announcements'){renderAnnouncementsPage();markAnnouncementsAsSeen();}else if(page==='about')renderAboutPage();else renderHome();
 const target=document.getElementById('page-'+page);if(target)target.classList.add('on');
 const btn=Array.from(document.querySelectorAll('.bnav button')).find(b=>b.dataset.page===String(page));if(btn)btn.classList.add('on');
 window.scrollTo({top:0,behavior:'smooth'});
 saveNavigationState();
}
function openSection(secId) {
 setFolderNavigationMode(false);
 const sec=(allData.sections||[]).find(s=>String(s.id)===String(secId));
 if(!sec||String(sec.id)==='home'){navTo('home');return;}
 currentPage=String(sec.id);currentSecId=String(sec.id);currentFoldId=null;currentView='section';
 document.querySelectorAll('.page').forEach(p=>p.classList.remove('on'));document.querySelectorAll('.bnav button').forEach(b=>b.classList.remove('on'));
 renderSectionPage(sec.id);const target=document.getElementById('page-'+sec.id);if(target)target.classList.add('on');
 let root=sec;const visited=new Set();
 while(root.parentId&&String(root.parentId)!=='home'&&!visited.has(String(root.id))){visited.add(String(root.id));root=(allData.sections||[]).find(s=>String(s.id)===String(root.parentId))||root;}
 const active=document.querySelector('.bnav button[data-page="'+String(root.id).replace(/"/g,'\\"')+'"]');if(active)active.classList.add('on');
 window.scrollTo({top:0,behavior:'smooth'});
 saveNavigationState();
}
function renderSectionPage(secId) {
 const sec=(allData.sections||[]).find(s=>String(s.id)===String(secId));if(!sec)return;
 let page=document.getElementById('page-'+secId);if(!page){page=document.createElement('div');page.id='page-'+secId;page.className='page';document.getElementById('dynamic-pages').appendChild(page);}
 const children=(allData.sections||[]).filter(c=>String(c.parentId||'')===String(sec.id)),folders=getFolderTree(sec).roots;
 let html='<div class="breadcrumb"><button class="back glass" onclick="goHome()">← رجوع للرئيسية</button><span class="crumb">'+escapeHtml(sec.icon||'📁')+' '+escapeHtml(sec.name)+'</span></div>';
 if(children.length){html+='<div class="sec-group"><div class="sec-header"><div class="sec-label"><span class="ic">📂</span><span>الأقسام الفرعية</span></div><span class="sec-count glass">'+children.length+'</span></div><div class="folder-vertical-list" style="display:flex;flex-direction:column;gap:9px;padding:0;">';
 children.forEach(c=>{html+='<div class="folder-line glass" style="display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:12px;" onclick="openSection(\''+String(c.id).replace(/'/g,'&#39;')+'\')"><span style="font-size:1.6rem;">'+escapeHtml(c.icon||'📁')+'</span><div style="flex:1;">'+escapeHtml(c.name)+'</div><span>دخول</span></div>';});html+='</div></div>';}
 if(folders.length){html+='<div class="sec-group"><div class="sec-header"><div class="sec-label"><span class="ic">📁</span><span>المجلدات</span></div><span class="sec-count glass">'+folders.length+'</span></div><div class="folder-vertical-list" style="display:flex;flex-direction:column;gap:9px;padding:0;">';
 folders.forEach(f=>{const count=(sec.items||[]).filter(i=>String(i.folderId)===String(f.id)).length;html+='<div class="folder-line glass" style="display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:12px;text-align:right;"><span style="font-size:1.6rem;">📁</span><div style="flex:1;min-width:0;"><div class="fnm" style="white-space:normal;">'+escapeHtml(f.name)+'</div><div class="fcnt">'+count+' عنصر</div></div><button type="button" style="flex:0 0 auto;border:0;border-radius:9px;padding:8px 13px;background:var(--accent);color:#fff;font:inherit;font-size:.78rem;font-weight:800;cursor:pointer;" onclick="openFolder(\''+String(sec.id).replace(/'/g,'&#39;')+'\',\''+String(f.id).replace(/'/g,'&#39;')+'\')">دخول للقسم</button></div>';});html+='</div></div>';}
 if(!children.length&&!folders.length)html+='<div class="empty"><div class="ei">📂</div><div class="et">لا توجد أقسام فرعية أو مجلدات في هذا المستوى حالياً</div></div>';
 page.innerHTML=html;
}
function openFolderDirectory(secId) {
 const sec=(allData.sections||[]).find(s=>String(s.id)===String(secId));if(!sec)return;
 setFolderNavigationMode(true);currentPage=String(sec.id);currentSecId=String(sec.id);currentFoldId=null;currentView='folderDirectory';
 let page=document.getElementById('page-'+secId+'-folders');if(!page){page=document.createElement('div');page.id='page-'+secId+'-folders';page.className='page';document.getElementById('dynamic-pages').appendChild(page);}
 document.querySelectorAll('.page').forEach(x=>x.classList.remove('on'));page.classList.add('on');
 const folders=getFolderTree(sec).roots.slice(2);
 let html='<div class="breadcrumb"><button class="back glass" onclick="goHome()">← رجوع للرئيسية</button><span class="crumb">'+escapeHtml(sec.name)+' · بقية المجلدات</span></div><div class="sec-group"><div class="sec-header"><div class="sec-label"><span class="ic">📁</span><span>مجلدات '+escapeHtml(sec.name)+'</span></div><span class="sec-count glass">'+folders.length+'</span></div><div style="display:flex;flex-direction:column;gap:9px;padding:0;">';
 folders.forEach(f=>{const count=(sec.items||[]).filter(i=>String(i.folderId)===String(f.id)).length;html+='<div class="folder-line glass" style="display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:12px;text-align:right;"><span style="font-size:1.6rem;">📁</span><div style="flex:1;min-width:0;"><div class="fnm" style="white-space:normal;">'+escapeHtml(f.name)+'</div><div class="fcnt">'+count+' عنصر</div></div><button type="button" style="flex:0 0 auto;border:0;border-radius:9px;padding:8px 13px;background:var(--accent);color:#fff;font:inherit;font-size:.78rem;font-weight:800;cursor:pointer;" onclick="openFolder(\''+String(sec.id).replace(/'/g,'&#39;')+'\',\''+String(f.id).replace(/'/g,'&#39;')+'\')">دخول للقسم</button></div>';});
 html+='</div></div>';page.innerHTML=html;window.scrollTo({top:0,behavior:'smooth'});saveNavigationState();
}
function goHome() {
  setFolderNavigationMode(false);
  currentSecId = null; currentFoldId = null; currentView='home'; folderReturnState=null;
  navTo('home'); renderHome();
}

function getFolderTree(sec) {
  const roots = sec?.folders || [];
  const flat = roots.filter(f => !f.parentId && !f.parentFolderId);
  const nested = roots.filter(f => f.parentId || f.parentFolderId);
  const byId = new Map(roots.map(f => [String(f.id), f]));
  const childrenOf = (folder) => {
    const embedded = folder.folders || folder.subfolders || folder.children || [];
    const linked = nested.filter(f => String(f.parentId || f.parentFolderId) === String(folder.id));
    return [...embedded, ...linked.filter(f => !embedded.some(e => String(e.id) === String(f.id)))];
  };
  const inferredRoots = roots.filter(f => !nested.some(child => String(child.parentId || child.parentFolderId) === String(f.id)));
  const rootFolders = flat.length ? flat : (inferredRoots.length ? inferredRoots : roots);
  return { roots: rootFolders, childrenOf, byId };
}
function findFolderPath(sec, folderId) {
  const tree = getFolderTree(sec);
  const walk = (folders, parents = []) => {
    for (const folder of folders || []) {
      const path = [...parents, folder];
      if (String(folder.id) === String(folderId)) return path;
      const found = walk(tree.childrenOf(folder), path);
      if (found) return found;
    }
    return null;
  };
  const found = walk(tree.roots);
  if (found) return found;
  const legacy = (sec?.folders || []).find(f => String(f.id) === String(folderId));
  return legacy ? [legacy] : null;
}
function openFolder(secId,foldId,preserveReturn=false) {
 const previousState={view:currentView,sectionId:currentSecId,folderId:currentFoldId};
 if(!preserveReturn&&!(currentView==='folder'&&String(currentSecId)===String(secId)&&String(currentFoldId)===String(foldId)))folderReturnState=previousState;
 setFolderNavigationMode(true);
 currentSecId=String(secId);currentFoldId=String(foldId);currentPage=String(secId);currentView='folder';
 const sec=allData.sections?.find(s=>String(s.id)===String(secId)),folderPath=findFolderPath(sec,foldId),fold=folderPath?.[folderPath.length-1]||sec?.folders?.find(f=>String(f.id)===String(foldId));
 if(!sec||!fold)return;
 let page=document.getElementById('page-'+secId+'-'+foldId);if(!page){page=document.createElement('div');page.id='page-'+secId+'-'+foldId;page.className='page';document.getElementById('dynamic-pages').appendChild(page);}
 document.querySelectorAll('.page').forEach(x=>x.classList.remove('on'));page.classList.add('on');document.querySelectorAll('.bnav button').forEach(x=>x.classList.remove('on'));
 let root=sec;const visited=new Set();while(root.parentId&&String(root.parentId)!=='home'&&!visited.has(String(root.id))){visited.add(String(root.id));root=(allData.sections||[]).find(s=>String(s.id)===String(root.parentId))||root;}
 const nav=document.querySelector('.bnav button[data-page="'+String(root.id).replace(/"/g,'\\"')+'"]');if(nav)nav.classList.add('on');
 const items=(sec.items||[]).filter(i=>String(i.folderId)===String(foldId)&&i.visibility!=='private'),tree=getFolderTree(sec),childFolders=tree.childrenOf(fold);
 let html=`<div class="breadcrumb"><button class="back glass" onclick="goBackFromFolder()">← رجوع</button><button class="back glass" onclick="goHome()">⌂ الرئيسية</button><span class="crumb">${(folderPath||[fold]).map(f=>escapeHtml(f.name)).join(' ← ')}</span></div>`;
 if(childFolders.length){html+='<div style="display:flex;flex-direction:column;gap:9px;padding:0 0 14px;">';childFolders.forEach(c=>{const count=(sec.items||[]).filter(i=>String(i.folderId)===String(c.id)).length;html+=`<div class="folder-line glass" style="display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:12px;text-align:right;cursor:pointer;" onclick="openFolder('${String(sec.id).replace(/'/g,'&#39;')}','${String(c.id).replace(/'/g,'&#39;')}')"><span style="font-size:1.6rem;">📁</span><div style="flex:1;min-width:0;"><div class="fnm" style="white-space:normal;">${escapeHtml(c.name)}</div><div class="fcnt">${count} عنصر</div></div><span>دخول للقسم</span></div>`;});html+='</div>';}
 if(sec.id==='fonts'||sec.defaultType==='font'){
  html+='<div class="font-list">';if(!items.length)html+='<div class="empty"><div class="ei">🔤</div><div class="et">لا توجد ملفات خطوط</div></div>';
  else items.forEach(it=>{const ext=String(it.fileName||it.url||'').split('?')[0].split('.').pop().toUpperCase();html+=`<div class="a-row glass font-row"><div class="font-file-icon">🔤</div><div class="ai"><div class="at">${escapeHtml(it.title)}</div><div class="ad">${escapeHtml(it.fileName||ext+' Font')}</div></div>${it.allowDownload===false?'':`<button type="button" class="media-download" onclick="event.stopPropagation();downloadMediaById('${String(it.id).replace(/'/g,'&#39;')}')">⬇️ تنزيل</button>`}</div>`;});html+='</div>';
 }else if(sec.id==='audios'||sec.defaultType==='audio'||(items.length&&items.every(i=>i.type==='audio'))){
  html+='<div class="a-list">';if(!items.length)html+='<div class="empty"><div class="ei">🎧</div><div class="et">لا توجد مقاطع</div></div>';
  else items.forEach((it,idx)=>{html+=`<div class="a-row glass" data-idx="${idx}"><img src="${it.cover||'https://via.placeholder.com/48'}" alt="" onerror="this.style.display='none'"><div class="ai"><div class="at">${escapeHtml(it.title)}</div><div class="ad">${escapeHtml(it.description||'')}</div></div>${it.allowDownload===false?'':`<button type="button" class="media-download" onclick="event.stopPropagation();downloadMediaById('${String(it.id).replace(/'/g,'&#39;')}')">⬇️ تنزيل</button>`}<button class="ap">▶</button></div>`;});html+='</div>';
 }else{
  html+='<div class="m-grid">';if(!items.length)html+='<div class="empty"><div class="ei">📂</div><div class="et">لا يوجد محتوى</div></div>';
  else items.forEach(it=>{html+=`<div class="m-card glass" data-id="${it.id}" style="position:relative;"><img src="${it.thumbnail||it.url}" alt="${escapeHtml(it.title)}" loading="lazy" onerror="this.src='https://via.placeholder.com/400x300/1a1a1a/666?text=${encodeURIComponent(it.title)}'"><div class="mi"><div class="mt">${escapeHtml(it.title)}</div><div class="md">${escapeHtml(it.description||'')}</div></div>${it.allowDownload===false?'':`<button type="button" class="media-download" onclick="event.stopPropagation();downloadMediaById('${String(it.id).replace(/'/g,'&#39;')}')">⬇️ تنزيل</button>`}</div>`;});html+='</div>';
 }
 page.innerHTML=html;window.scrollTo({top:0,behavior:'smooth'});saveNavigationState();
 if(sec.defaultType==='audio'||sec.id==='audios'||(items.length&&items.every(i=>i.type==='audio'))){
  audioItems=items;page.querySelectorAll('.a-row').forEach(row=>row.addEventListener('click',e=>{if(!e.target.closest('.ap'))playAudio(parseInt(row.dataset.idx));}));
  page.querySelectorAll('.ap').forEach(btn=>btn.addEventListener('click',e=>{e.stopPropagation();playAudio(parseInt(btn.closest('.a-row').dataset.idx));}));
 }else if(sec.defaultType!=='font'&&sec.id!=='fonts'){
  page.querySelectorAll('.m-card').forEach(card=>card.addEventListener('click',()=>{const it=items.find(x=>String(x.id)===String(card.dataset.id));if(it)openViewer(it.id,items);}));
 }
}
// ===== Viewer =====
function openViewer(id, items) {
  mediaList = items; mediaIdx = items.findIndex(i => i.id === id);
  if (mediaIdx === -1) return;
  updateViewer();
  document.getElementById('viewer').classList.add('on');
  document.body.style.overflow = 'hidden';
}
function updateViewer() {
  const item = mediaList[mediaIdx];
  const content = document.getElementById('vcon');
  const title = document.getElementById('vt');
  const actions = document.getElementById('va');
  title.textContent = item.title;
  if (item.type === 'video') content.innerHTML = `<video src="${item.url}" controls autoplay style="max-width:100%;max-height:65vh;border-radius:12px;"></video>`;
  else if (item.type === 'audio') content.innerHTML = `<audio src="${item.url}" controls autoplay style="width:min(90vw,480px);"></audio>`;
  else content.innerHTML = `<img src="${item.url}" alt="" style="max-width:100%;max-height:65vh;border-radius:12px;">`;
  let btns = '';
  if (item.allowDownload !== false) btns += `<button class="pri" onclick="dlCurrent()">⬇️ تنزيل</button>`;
  if (item.allowShare !== false) btns += `<button onclick="shareCurrent()">🔗 مشاركة</button>`;
  actions.innerHTML = btns;
}
function closeViewer() {
  document.getElementById('viewer').classList.remove('on');
  document.body.style.overflow = '';
  const v = document.querySelector('#vcon video'); if (v) v.pause();
}
function downloadMediaById(id) {
  const sections = allData.sections || [];
  for (const sec of sections) {
    const item = (sec.items || []).find(entry => String(entry.id) === String(id));
    if (item) { downloadMedia(item); return; }
  }
  toast('تعذر العثور على الملف', 'bad');
}
async function downloadMedia(item) {
  if (!item || item.allowDownload === false) { toast('التنزيل معطل', 'bad'); return; }
  if (!item.url) { toast('رابط الملف غير متوفر', 'bad'); return; }
  try {
    toast('جارٍ تجهيز التنزيل...', 'ok');
    const source = new URL(item.url, location.href);
    if (source.pathname.includes('/api/uploads/')) source.searchParams.set('download', '1');
    const response = await fetch(source.href, { mode: 'cors', cache: 'no-store' });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const blob = await response.blob();
    if (!blob.size) throw new Error('الملف فارغ');
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const fileNameFromUrl = source.pathname.split('/').pop() || '';
    const extensionCandidate = fileNameFromUrl.includes('.') ? fileNameFromUrl.split('.').pop() : '';
    const extension = /^[a-z0-9]{1,8}$/i.test(extensionCandidate) ? extensionCandidate : '';
    const knownExt = { image: '.jpg', video: '.mp4', audio: '.mp3', font: '.ttf' };
    const safeTitle = Array.from(String(item.title || 'media')).map(ch => '<>:"/\\|?*'.includes(ch) ? '_' : ch).join('');
    a.href = objectUrl;
    a.download = safeTitle + (extension ? '.' + extension : (knownExt[item.type] || ''));
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 2000);
    toast('بدأ تنزيل الملف', 'ok');
  } catch (e) {
    console.error('Media download failed:', e);
    toast('تعذر التنزيل. تحقق من اتصالك ثم أعد المحاولة', 'bad');
  }
}
async function dlCurrent() {
  const item = mediaList[mediaIdx];
  await downloadMedia(item);
}
async function shareCurrent() {
  const item = mediaList[mediaIdx];
  if (item.allowShare === false) { toast('المشاركة معطلة', 'bad'); return; }
  if (navigator.share) { try { await navigator.share({ title: item.title, text: item.description, url: item.url }); } catch (e) {} }
  else { await navigator.clipboard.writeText(item.url); toast('تم نسخ الرابط', 'ok'); }
}

// ===== Audio Player =====
function playAudio(idx) {
  if (!audioItems.length) return;
  audioIdx = idx; const item = audioItems[idx];
  if (!audioEl) {
    audioEl = new Audio();
    audioEl.addEventListener('timeupdate', () => {
      if (!audioEl.duration) return;
      document.getElementById('ppb').style.width = ((audioEl.currentTime / audioEl.duration) * 100) + '%';
    });
    audioEl.addEventListener('ended', () => playAudio((audioIdx + 1) % audioItems.length));
  }
  audioEl.src = item.url; audioEl.play().catch(() => {}); isPlaying = true;
  document.getElementById('p-cover').src = item.cover || 'https://via.placeholder.com/40';
  document.getElementById('p-title').textContent = item.title;
  document.getElementById('p-play').textContent = '⏸';
  document.getElementById('player').classList.add('on');
}
function togglePlay() {
  if (!audioEl) return;
  if (isPlaying) { audioEl.pause(); document.getElementById('p-play').textContent = '▶'; }
  else { audioEl.play().catch(() => {}); document.getElementById('p-play').textContent = '⏸'; }
  isPlaying = !isPlaying;
}
function nextAudio() { if (!audioItems.length) return; playAudio((audioIdx + 1) % audioItems.length); }
function prevAudio() { if (!audioItems.length) return; playAudio((audioIdx - 1 + audioItems.length) % audioItems.length); }
function seekAudio(e) {
  if (!audioEl || !audioEl.duration) return;
  const rect = e.currentTarget.getBoundingClientRect();
  audioEl.currentTime = ((e.clientX - rect.left) / rect.width) * audioEl.duration;
}

// ===== Search =====
function normalizeSearchText(value) {
  return String(value || '')
    .normalize('NFKC')
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .toLocaleLowerCase('ar')
    .trim();
}
function collectSearchFolders(sec) {
  const tree = getFolderTree(sec);
  const out = [];
  const visited = new Set();
  const walk = (folders, parentPath = []) => {
    (folders || []).forEach(folder => {
      const key = String(folder.id);
      if (visited.has(key)) return;
      visited.add(key);
      const path = [...parentPath, folder];
      out.push({ folder, path, sec });
      walk(tree.childrenOf(folder), path);
    });
  };
  walk(tree.roots);
  // Include orphaned/legacy folders too, without losing them from search.
  (sec.folders || []).forEach(folder => {
    if (!visited.has(String(folder.id))) out.push({ folder, path: [folder], sec });
  });
  return out;
}
function doSearch(e) {
  const q = e.target.value.trim();
  if (!q) { goHome(); return; }
  const needle = normalizeSearchText(q);
  const results = [];
  (allData.sections || []).forEach(sec => {
    collectSearchFolders(sec).forEach(({ folder, path }) => {
      const name = normalizeSearchText(folder.name);
      if (name.includes(needle)) {
        results.push({
          resultType: 'folder',
          id: folder.id,
          secId: sec.id,
          title: folder.name,
          path: [sec.name, ...path.map(f => f.name)],
          folderPath: path
        });
      }
    });
    (sec.items || []).forEach(item => {
      if (item.visibility === 'private') return;
      const title = normalizeSearchText(item.title);
      const description = normalizeSearchText(item.description);
      if (title.includes(needle) || description.includes(needle)) {
        const folderPath = item.folderId != null ? findFolderPath(sec, item.folderId) : null;
        results.push({
          ...item,
          resultType: 'item',
          secName: sec.name,
          secId: sec.id,
          path: [sec.name, ...(folderPath || []).map(f => f.name)],
          sourceItems: sec.items
        });
      }
    });
    if (normalizeSearchText(sec.name).includes(needle)) {
      results.push({
        resultType: 'section',
        id: sec.id,
        secId: sec.id,
        title: sec.name,
        path: [sec.name]
      });
    }
  });
  let page = document.getElementById('page-search');
  if (!page) {
    page = document.createElement('div'); page.id = 'page-search'; page.className = 'page';
    document.getElementById('dynamic-pages').appendChild(page);
  }
  document.querySelectorAll('.page').forEach(p => p.classList.remove('on'));
  page.classList.add('on');
  document.querySelectorAll('.bnav button').forEach(b => b.classList.remove('on'));
  let html = `<div class="breadcrumb"><span class="crumb">نتائج البحث</span></div>`;
  if (results.length === 0) html += `<div class="empty"><div class="ei">🔍</div><div class="et">لا توجد نتائج مطابقة لـ «${escapeHtml(q)}»</div></div>`;
  else {
    html += `<div class="a-list">`;
    results.forEach((item, idx) => {
      const isFolder = item.resultType === 'folder';
      const isSection = item.resultType === 'section';
      const title = item.title || item.name || '';
      const path = (item.path || []).map(escapeHtml).join(' ← ');
      const image = !isFolder && !isSection ? (item.thumbnail || item.cover || item.url || '') : '';
      html += `<div class="a-row glass search-result" data-result-index="${idx}" style="cursor:pointer;">
        ${image ? `<img src="${image}" alt="" onerror="this.style.display='none'">` : `<div class="ap" style="cursor:pointer;">${isFolder ? '📁' : isSection ? '🗂️' : '📄'}</div>`}
        <div class="ai"><div class="at">${escapeHtml(title)}</div><div class="ad">${path}</div></div>
        <div style="color:var(--accent-light);font-size:1.1rem;padding:0 4px;">←</div>
      </div>`;
    });
    html += `</div>`;
  }
  page.innerHTML = html;
  page.querySelectorAll('.search-result').forEach(row => {
    row.addEventListener('click', () => {
      const item = results[Number(row.dataset.resultIndex)];
      document.getElementById('search-input').value = '';
      if (item.resultType === 'folder') openFolder(item.secId, item.id);
      else if (item.resultType === 'section') {
        goHome();
        const sec = (allData.sections || []).find(s => String(s.id) === String(item.secId));
        const folder = sec && getFolderTree(sec).roots[0];
        if (folder) openFolder(sec.id, folder.id);
      } else openViewer(item.id, item.sourceItems || [item]);
    });
  });
}
// ===== Admin =====
function onLogoPressStart(e) {
  if (e.type === 'mousedown' && e.button !== 0) return;
  if (logoTimer) clearTimeout(logoTimer);
  logoTimer = setTimeout(() => {
    logoTimer = null;
    const overlay = document.getElementById('admin-ol');
    if (!overlay) return;
    overlay.classList.add('on');
    document.getElementById('admin-user')?.focus();
  }, 10000);
}
function onLogoPressEnd() {
  if (logoTimer) {
    clearTimeout(logoTimer);
    logoTimer = null;
  }
}

// ===== Admin login via the secure server-side endpoint =====
const ADMIN_API = 'https://hashed-fatimi-admin.alhashedalfatimy-admin.workers.dev';
async function adminLogin() {
  const button = document.getElementById('admin-login');
  const u = document.getElementById('admin-user').value.trim();
  const p = document.getElementById('admin-pass').value;
  const error = document.getElementById('admin-err');
  button.disabled = true;
  button.textContent = 'جارٍ التحقق...';
  error.classList.remove('on');
  try {
    const response = await fetch(ADMIN_API + '/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: u, password: p }),
      cache: 'no-store'
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.token) {
      error.textContent = result.error || 'بيانات الدخول غير صحيحة';
      error.classList.add('on');
      document.getElementById('admin-pass').value = '';
      return;
    }
    sessionStorage.setItem('admin_session', result.token);
    sessionStorage.setItem('admin_auth', 'true');
    window.location.href = 'admin.html';
  } catch (e) {
    error.textContent = 'تعذر الاتصال بخدمة تسجيل الدخول. تحقق من الإنترنت وحاول مجدداً.';
    error.classList.add('on');
  } finally {
    button.disabled = false;
    button.textContent = 'دخول';
  }
}
async function sha256(str) {
  const buf = new TextEncoder().encode(str);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ===== PWA =====
function setupPWA() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(e => console.error(e));
  }
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); installPrompt = e;
    document.getElementById('install-btn').classList.add('on');
  });
  window.addEventListener('appinstalled', () => {
    installPrompt = null;
    document.getElementById('install-btn').classList.remove('on');
    toast('تم التثبيت', 'ok');
  });
}
async function installApp() {
  if (!installPrompt) return;
  installPrompt.prompt();
  const r = await installPrompt.userChoice;
  if (r.outcome === 'accepted') toast('تم التثبيت', 'ok');
  installPrompt = null;
  document.getElementById('install-btn').classList.remove('on');
}

// ===== Events =====
function setupEvents() {
  const logo = document.querySelector('#app-logo .logo-img');
  if (logo) {
    logo.addEventListener('contextmenu', e => e.preventDefault());
    logo.addEventListener('pointerdown', onLogoPressStart);
    ['pointerup', 'pointercancel', 'pointerleave', 'blur'].forEach(type =>
      logo.addEventListener(type, onLogoPressEnd)
    );
  }
  document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
  document.getElementById('search-input').addEventListener('input', debounce(doSearch, 300));
  document.getElementById('vc').addEventListener('click', closeViewer);
  document.getElementById('p-play').addEventListener('click', togglePlay);
  document.getElementById('p-prev').addEventListener('click', prevAudio);
  document.getElementById('p-next').addEventListener('click', nextAudio);
  document.getElementById('pp').addEventListener('click', seekAudio);
  document.getElementById('admin-login').addEventListener('click', adminLogin);
  document.getElementById('install-btn').addEventListener('click', installApp);
  document.getElementById('admin-ol').addEventListener('click', (e) => {
    if (e.target.id === 'admin-ol') document.getElementById('admin-ol').classList.remove('on');
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeViewer(); });
}

// ===== Utils =====
function debounce(fn, ms) {
  let t;
  return function(...a) { clearTimeout(t); t = setTimeout(() => fn.apply(this, a), ms); };
}
function escapeHtml(t) {
  if (!t) return '';
  const d = document.createElement('div'); d.textContent = t; return d.innerHTML;
}
function toast(msg, type) {
  const el = document.getElementById('toast');
  el.textContent = msg; el.className = 'toast ' + type; el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2500);
}
