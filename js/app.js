// ===== State =====
let allData = { version: '3.0.0.0', sections: [], announcements: [], about: {}, admin: {} };
let currentPage = 'home';
let currentSecId = null;
let currentFoldId = null;
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
    renderHome();
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
  try {
    const r = await fetch('content.json?nocache=' + Date.now(), { cache: 'no-store' });
    if (r.ok) {
      allData = await r.json();
      if (!allData.sections) allData.sections = [];
      if (!allData.announcements) allData.announcements = [];
      if (!allData.about) allData.about = {};
      if (!allData.admin) allData.admin = {};
    }
  } catch (e) {
    console.error('Load error:', e);
    allData = { version: '3.0.0.0', sections: [], announcements: [], about: {}, admin: {} };
  }
}

// ===== Render Home =====
function renderHome() {
  const container = document.getElementById('home-content');
  const sections = allData.sections || [];
  let html = '';
  if (sections.length === 0) {
    html = `<div class="empty"><div class="ei">📂</div><div class="et">لا توجد أقسام بعد</div></div>`;
  } else {
    sections.forEach(sec => {
      const folders = sec.folders || [];
      const items = sec.items || [];
      const total = items.length;
      html += `<div class="sec-group">
        <div class="sec-header">
          <div class="sec-label"><span class="ic">${sec.icon || '📁'}</span><span>${escapeHtml(sec.name)}</span></div>
          <span class="sec-count glass">${total}</span>
        </div>
        <div class="folders-row">`;
      if (folders.length === 0) {
        html += `<div class="folder-chip glass empty" onclick="toast('لا توجد مجلدات', 'bad')"><div class="fic">📂</div><div class="fnm">فارغ</div></div>`;
      } else {
        folders.forEach(f => {
          const count = items.filter(i => i.folderId === f.id).length;
          html += `<div class="folder-chip glass" onclick="openFolder('${sec.id}', '${f.id}')"><div class="fic">📁</div><div class="fnm">${escapeHtml(f.name)}</div><div class="fcnt">${count} عنصر</div></div>`;
        });
      }
      html += `</div></div>`;
    });
  }
  container.innerHTML = html;
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
function updateAnnBadge() {
  const badge = document.getElementById('ann-badge');
  if (!badge) return;
  const hasActive = (allData.announcements || []).some(a => a.active);
  if (hasActive) badge.classList.add('on');
  else badge.classList.remove('on');
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
function navTo(page) {
  currentPage = page;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('on'));
  document.querySelectorAll('.bnav button').forEach(b => b.classList.remove('on'));

  if (page === 'announcements') {
    renderAnnouncementsPage();
  } else if (page === 'about') {
    renderAboutPage();
  }

  const target = document.getElementById('page-' + page);
  if (target) target.classList.add('on');

  const btn = document.querySelector(`.bnav button[data-page="${page}"]`);
  if (btn) btn.classList.add('on');

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function goHome() {
  currentSecId = null; currentFoldId = null;
  navTo('home'); renderHome();
}

function openFolder(secId, foldId) {
  currentSecId = secId; currentFoldId = foldId;
  const sec = allData.sections?.find(s => s.id === secId);
  const fold = sec?.folders?.find(f => f.id === foldId);
  if (!sec || !fold) return;
  let page = document.getElementById('page-' + secId + '-' + foldId);
  if (!page) {
    page = document.createElement('div');
    page.id = 'page-' + secId + '-' + foldId;
    page.className = 'page';
    document.getElementById('dynamic-pages').appendChild(page);
  }
  document.querySelectorAll('.page').forEach(p => p.classList.remove('on'));
  page.classList.add('on');
  document.querySelectorAll('.bnav button').forEach(b => b.classList.remove('on'));
  const items = (sec.items || []).filter(i => i.folderId === foldId && i.visibility !== 'private');
  let html = `<div class="breadcrumb"><button class="back glass" onclick="goHome()">← رجوع</button><span class="crumb">${escapeHtml(fold.name)}</span></div>`;
  if (sec.id === 'audios') {
    html += `<div class="a-list">`;
    if (items.length === 0) html += `<div class="empty"><div class="ei">🎧</div><div class="et">لا توجد مقاطع</div></div>`;
    else {
      items.forEach((item, idx) => {
        html += `<div class="a-row glass" data-idx="${idx}"><img src="${item.cover || 'https://via.placeholder.com/48'}" alt="" onerror="this.style.display='none'"><div class="ai"><div class="at">${escapeHtml(item.title)}</div><div class="ad">${escapeHtml(item.description || '')}</div></div><button class="ap">▶</button></div>`;
      });
    }
    html += `</div>`;
  } else {
    html += `<div class="m-grid">`;
    if (items.length === 0) html += `<div class="empty"><div class="ei">📂</div><div class="et">لا يوجد محتوى</div></div>`;
    else {
      items.forEach(item => {
        html += `<div class="m-card glass" data-id="${item.id}" style="position:relative;"><img src="${item.thumbnail || item.url}" alt="${escapeHtml(item.title)}" loading="lazy" onerror="this.src='https://via.placeholder.com/400x300/1a1a1a/666?text=${encodeURIComponent(item.title)}'"><div class="mi"><div class="mt">${escapeHtml(item.title)}</div><div class="md">${escapeHtml(item.description || '')}</div></div></div>`;
      });
    }
    html += `</div>`;
  }
  page.innerHTML = html;
  window.scrollTo({ top: 0, behavior: 'smooth' });
  if (sec.id === 'audios') {
    audioItems = items;
    page.querySelectorAll('.a-row').forEach(row => {
      row.addEventListener('click', (e) => { if (e.target.closest('.ap')) return; playAudio(parseInt(row.dataset.idx)); });
    });
    page.querySelectorAll('.ap').forEach(btn => {
      btn.addEventListener('click', (e) => { e.stopPropagation(); playAudio(parseInt(btn.closest('.a-row').dataset.idx)); });
    });
  } else {
    page.querySelectorAll('.m-card').forEach(card => {
      card.addEventListener('click', () => { const id = parseInt(card.dataset.id); openViewer(id, items); });
    });
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
async function dlCurrent() {
  const item = mediaList[mediaIdx];
  if (item.allowDownload === false) { toast('التنزيل معطل', 'bad'); return; }
  try {
    toast('جاري التنزيل...', 'ok');
    const r = await fetch(item.url);
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const ext = item.type === 'video' ? '.mp4' : item.type === 'audio' ? '.mp3' : '.jpg';
    a.download = (item.title || 'file') + ext;
    a.click(); URL.revokeObjectURL(url);
    toast('تم التنزيل', 'ok');
  } catch (e) { toast('فشل التنزيل', 'bad'); }
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
function doSearch(e) {
  const q = e.target.value.trim();
  if (!q) { goHome(); return; }
  const results = [];
  (allData.sections || []).forEach(sec => {
    (sec.items || []).forEach(item => {
      if (item.visibility !== 'private' && ((item.title && item.title.includes(q)) || (item.description && item.description.includes(q)))) {
        results.push({ ...item, secName: sec.name });
      }
    });
  });
  let page = document.getElementById('page-search');
  if (!page) {
    page = document.createElement('div'); page.id = 'page-search'; page.className = 'page';
    document.getElementById('dynamic-pages').appendChild(page);
  }
  document.querySelectorAll('.page').forEach(p => p.classList.remove('on'));
  page.classList.add('on');
  document.querySelectorAll('.bnav button').forEach(b => b.classList.remove('on'));
  let html = `<div class="breadcrumb"><button class="back glass" onclick="goHome()">← رجوع</button><span class="crumb">نتائج البحث</span></div>`;
  if (results.length === 0) html += `<div class="empty"><div class="ei">🔍</div><div class="et">لا توجد نتائج</div></div>`;
  else {
    html += `<div class="m-grid">`;
    results.forEach(item => {
      html += `<div class="m-card glass" data-id="${item.id}" style="position:relative;"><img src="${item.thumbnail || item.url}" alt="" loading="lazy" onerror="this.style.display='none'"><div class="mi"><div class="mt">${escapeHtml(item.title)}</div><div class="md">${escapeHtml(item.secName)}</div></div></div>`;
    });
    html += `</div>`;
  }
  page.innerHTML = html;
  page.querySelectorAll('.m-card').forEach(card => {
    card.addEventListener('click', () => openViewer(parseInt(card.dataset.id), results));
  });
}

// ===== Admin =====
function onLogoClick() {
  logoClicks++;
  if (logoClicks >= 5) {
    logoClicks = 0;
    document.getElementById('admin-ol').classList.add('on');
    document.getElementById('admin-user').focus();
  }
  setTimeout(() => { logoClicks = 0; }, 2000);
}
function onLogoPressStart(e) {
  e.preventDefault();
  logoTimer = setTimeout(() => {
    document.getElementById('admin-ol').classList.add('on');
    document.getElementById('admin-user').focus();
  }, 8000);
}
function onLogoPressEnd(e) {
  e.preventDefault();
  if (logoTimer) { clearTimeout(logoTimer); logoTimer = null; }
}

// ===== Secure login with SHA-256 =====
async function adminLogin() {
  const u = document.getElementById('admin-user').value.trim();
  const p = document.getElementById('admin-pass').value;
  let adminCreds = { username: 'admin', passwordHash: '' };
  try {
    const r = await fetch('content.json?nocache=' + Date.now(), { cache: 'no-store' });
    if (r.ok) { const d = await r.json(); if (d.admin) adminCreds = d.admin; }
  } catch (e) {}
  const expectedUser = adminCreds.username || 'admin';
  const expectedHash = adminCreds.passwordHash || await sha256('admin123');
  const inputHash = await sha256(p);
  if (u === expectedUser && inputHash === expectedHash) {
    sessionStorage.setItem('admin_auth', 'true');
    window.location.href = 'admin.html';
  } else {
    document.getElementById('admin-err').classList.add('on');
    document.getElementById('admin-pass').value = '';
    await new Promise(r => setTimeout(r, 500));
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
  const logo = document.getElementById('app-logo');
  logo.addEventListener('click', onLogoClick);
  logo.addEventListener('touchstart', onLogoPressStart);
  logo.addEventListener('touchend', onLogoPressEnd);
  logo.addEventListener('mousedown', onLogoPressStart);
  logo.addEventListener('mouseup', onLogoPressEnd);
  logo.addEventListener('mouseleave', onLogoPressEnd);
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
