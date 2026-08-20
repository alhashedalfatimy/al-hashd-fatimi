// ===== State =====
let allData = { version: '3.0.0.0', sections: [], announcements: [] };
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
let theme = localStorage.getItem('theme') || 'dark';

// ===== Init =====
document.addEventListener('DOMContentLoaded', async () => {
  applyTheme(theme);
  try {
    await loadData();
    setupEvents();
    setupPWA();
    renderHome();
    showAnnouncement();
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
}

function toggleTheme() {
  theme = theme === 'dark' ? 'light' : 'dark';
  localStorage.setItem('theme', theme);
  applyTheme(theme);
}

// ===== Load Data =====
async function loadData() {
  try {
    const r = await fetch('content.json?nocache=' + Date.now(), { cache: 'no-store' });
    if (r.ok) {
      allData = await r.json();
      if (!allData.sections) allData = { version: '3.0.0.0', sections: [], announcements: [] };
    }
  } catch (e) {
    allData = { version: '3.0.0.0', sections: [], announcements: [] };
  }
}

// ===== Render Home =====
function renderHome() {
  const container = document.getElementById('home-content');
  const sections = allData.sections || [];

  let html = '';
  sections.forEach(sec => {
    const folders = sec.folders || [];
    const items = sec.items || [];
    const total = items.length;

    html += `
      <div class="section-group">
        <div class="section-header-row">
          <div class="section-label">
            <span class="sec-icon">${sec.icon || '📁'}</span>
            <span>${escapeHtml(sec.name)}</span>
          </div>
          <span class="section-count">${total}</span>
        </div>
        <div class="folders-scroll">
    `;

    if (folders.length === 0) {
      html += `
        <div class="folder-chip empty" onclick="toast('لا توجد مجلدات في هذا القسم', 'bad')">
          <div class="f-icon">📂</div>
          <div class="f-name">فارغ</div>
        </div>
      `;
    } else {
      folders.forEach(f => {
        const count = items.filter(i => i.folderId === f.id).length;
        html += `
          <div class="folder-chip" onclick="openFolder('${sec.id}', '${f.id}')">
            <div class="f-icon">📁</div>
            <div class="f-name">${escapeHtml(f.name)}</div>
            <div class="f-count">${count} عنصر</div>
          </div>
        `;
      });
    }

    html += `</div></div>`;
  });

  if (sections.length === 0) {
    html = `
      <div class="empty-state">
        <div class="e-icon">📂</div>
        <div class="e-text">لا توجد أقسام بعد</div>
      </div>
    `;
  }

  container.innerHTML = html;
}

// ===== Announcement =====
function showAnnouncement() {
  const bar = document.getElementById('announcement-bar');
  const text = document.getElementById('ann-text');
  const anns = (allData.announcements || []).filter(a => a.active);

  if (anns.length === 0) { bar.classList.remove('active'); return; }
  text.textContent = anns[0].title + (anns[0].text ? ' — ' + anns[0].text : '');
  bar.classList.add('active');
}

function closeAnnouncement() {
  document.getElementById('announcement-bar').classList.remove('active');
}

// ===== Navigation =====
function navigateTo(page) {
  currentPage = page;
  document.querySelectorAll('.page-container').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.bottom-nav button').forEach(b => b.classList.remove('active'));

  const target = document.getElementById('page-' + page);
  if (target) target.classList.add('active');

  const btn = document.querySelector(`.bottom-nav button[data-page="${page}"]`);
  if (btn) btn.classList.add('active');

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function goHome() {
  currentSecId = null;
  currentFoldId = null;
  navigateTo('home');
  renderHome();
}

function openFolder(secId, foldId) {
  currentSecId = secId;
  currentFoldId = foldId;

  const sec = allData.sections?.find(s => s.id === secId);
  const fold = sec?.folders?.find(f => f.id === foldId);
  if (!sec || !fold) return;

  let page = document.getElementById('page-' + secId + '-' + foldId);
  if (!page) {
    page = document.createElement('div');
    page.id = 'page-' + secId + '-' + foldId;
    page.className = 'page-container';
    document.getElementById('dynamic-pages').appendChild(page);
  }

  document.querySelectorAll('.page-container').forEach(p => p.classList.remove('active'));
  page.classList.add('active');
  document.querySelectorAll('.bottom-nav button').forEach(b => b.classList.remove('active'));

  const items = (sec.items || []).filter(i => i.folderId === foldId && i.visibility !== 'private');

  let html = `
    <div class="breadcrumb">
      <button class="back-btn" onclick="goHome()">← رجوع</button>
      <span class="crumb">${escapeHtml(fold.name)}</span>
    </div>
  `;

  if (sec.id === 'audios') {
    html += `<div class="audio-list">`;
    if (items.length === 0) {
      html += `<div class="empty-state"><div class="e-icon">🎧</div><div class="e-text">لا توجد مقاطع</div></div>`;
    } else {
      items.forEach((item, idx) => {
        html += `
          <div class="audio-row" data-idx="${idx}">
            <img src="${item.cover || 'https://via.placeholder.com/48'}" alt="" onerror="this.style.display='none'">
            <div class="a-info">
              <div class="a-title">${escapeHtml(item.title)}</div>
              <div class="a-desc">${escapeHtml(item.description || '')}</div>
            </div>
            <button class="a-play">▶</button>
          </div>
        `;
      });
    }
    html += `</div>`;
  } else {
    html += `<div class="media-grid">`;
    if (items.length === 0) {
      html += `<div class="empty-state"><div class="e-icon">📂</div><div class="e-text">لا يوجد محتوى</div></div>`;
    } else {
      items.forEach(item => {
        html += `
          <div class="media-card" data-id="${item.id}" style="position:relative;">
            <img src="${item.thumbnail || item.url}" alt="${escapeHtml(item.title)}" loading="lazy" onerror="this.src='https://via.placeholder.com/400x300/1a1a1a/666?text=${encodeURIComponent(item.title)}'">
            <div class="m-info">
              <div class="m-title">${escapeHtml(item.title)}</div>
              <div class="m-desc">${escapeHtml(item.description || '')}</div>
            </div>
          </div>
        `;
      });
    }
    html += `</div>`;
  }

  page.innerHTML = html;
  window.scrollTo({ top: 0, behavior: 'smooth' });

  if (sec.id === 'audios') {
    audioItems = items;
    page.querySelectorAll('.audio-row').forEach(row => {
      row.addEventListener('click', (e) => {
        if (e.target.closest('.a-play')) return;
        playAudio(parseInt(row.dataset.idx));
      });
    });
    page.querySelectorAll('.a-play').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        playAudio(parseInt(btn.closest('.audio-row').dataset.idx));
      });
    });
  } else {
    page.querySelectorAll('.media-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = parseInt(card.dataset.id);
        openViewer(id, items);
      });
    });
  }
}

// ===== Viewer =====
function openViewer(id, items) {
  mediaList = items;
  mediaIdx = items.findIndex(i => i.id === id);
  if (mediaIdx === -1) return;
  updateViewer();
  document.getElementById('viewer-overlay').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function updateViewer() {
  const item = mediaList[mediaIdx];
  const content = document.getElementById('v-content');
  const title = document.getElementById('v-title');
  const actions = document.getElementById('v-actions');

  title.textContent = item.title;

  if (item.type === 'video') {
    content.innerHTML = `<video src="${item.url}" controls autoplay style="max-width:100%;max-height:65vh;border-radius:12px;"></video>`;
  } else {
    content.innerHTML = `<img src="${item.url}" alt="" style="max-width:100%;max-height:65vh;border-radius:12px;">`;
  }

  let btns = '';
  if (item.allowDownload !== false) {
    btns += `<button class="primary" onclick="dlCurrent()">⬇️ تنزيل</button>`;
  }
  if (item.allowShare !== false) {
    btns += `<button onclick="shareCurrent()">🔗 مشاركة</button>`;
  }
  actions.innerHTML = btns;
}

function closeViewer() {
  document.getElementById('viewer-overlay').classList.remove('active');
  document.body.style.overflow = '';
  const v = document.querySelector('#v-content video');
  if (v) v.pause();
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
    a.click();
    URL.revokeObjectURL(url);
    toast('تم التنزيل', 'ok');
  } catch (e) { toast('فشل التنزيل', 'bad'); }
}

async function shareCurrent() {
  const item = mediaList[mediaIdx];
  if (item.allowShare === false) { toast('المشاركة معطلة', 'bad'); return; }
  if (navigator.share) {
    try { await navigator.share({ title: item.title, text: item.description, url: item.url }); } catch (e) {}
  } else {
    await navigator.clipboard.writeText(item.url);
    toast('تم نسخ الرابط', 'ok');
  }
}

// ===== Audio Player =====
function playAudio(idx) {
  if (!audioItems.length) return;
  audioIdx = idx;
  const item = audioItems[idx];

  if (!audioEl) {
    audioEl = new Audio();
    audioEl.addEventListener('timeupdate', () => {
      if (!audioEl.duration) return;
      const pct = (audioEl.currentTime / audioEl.duration) * 100;
      document.getElementById('p-progress-bar').style.width = pct + '%';
    });
    audioEl.addEventListener('ended', () => playAudio((audioIdx + 1) % audioItems.length));
  }

  audioEl.src = item.url;
  audioEl.play().catch(() => {});
  isPlaying = true;

  document.getElementById('p-cover').src = item.cover || 'https://via.placeholder.com/40';
  document.getElementById('p-title').textContent = item.title;
  document.getElementById('p-play').textContent = '⏸';
  document.getElementById('player-bar').classList.add('active');
}

function togglePlay() {
  if (!audioEl) return;
  if (isPlaying) { audioEl.pause(); document.getElementById('p-play').textContent = '▶'; }
  else { audioEl.play().catch(() => {}); document.getElementById('p-play').textContent = '⏸'; }
  isPlaying = !isPlaying;
}

function nextAudio() {
  if (!audioItems.length) return;
  playAudio((audioIdx + 1) % audioItems.length);
}

function prevAudio() {
  if (!audioItems.length) return;
  playAudio((audioIdx - 1 + audioItems.length) % audioItems.length);
}

function seekAudio(e) {
  if (!audioEl || !audioEl.duration) return;
  const rect = e.currentTarget.getBoundingClientRect();
  const pct = (e.clientX - rect.left) / rect.width;
  audioEl.currentTime = pct * audioEl.duration;
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
    page = document.createElement('div');
    page.id = 'page-search';
    page.className = 'page-container';
    document.getElementById('dynamic-pages').appendChild(page);
  }

  document.querySelectorAll('.page-container').forEach(p => p.classList.remove('active'));
  page.classList.add('active');
  document.querySelectorAll('.bottom-nav button').forEach(b => b.classList.remove('active'));

  let html = `
    <div class="breadcrumb">
      <button class="back-btn" onclick="goHome()">← رجوع</button>
      <span class="crumb">نتائج البحث</span>
    </div>
  `;

  if (results.length === 0) {
    html += `<div class="empty-state"><div class="e-icon">🔍</div><div class="e-text">لا توجد نتائج</div></div>`;
  } else {
    html += `<div class="media-grid">`;
    results.forEach(item => {
      html += `
        <div class="media-card" data-id="${item.id}" style="position:relative;">
          <img src="${item.thumbnail || item.url}" alt="" loading="lazy" onerror="this.style.display='none'">
          <div class="m-info">
            <div class="m-title">${escapeHtml(item.title)}</div>
            <div class="m-desc">${escapeHtml(item.secName)}</div>
          </div>
        </div>
      `;
    });
    html += `</div>`;
  }

  page.innerHTML = html;
  page.querySelectorAll('.media-card').forEach(card => {
    card.addEventListener('click', () => openViewer(parseInt(card.dataset.id), results));
  });
}

// ===== Admin =====
function onLogoClick() {
  logoClicks++;
  if (logoClicks >= 5) {
    logoClicks = 0;
    document.getElementById('admin-overlay').classList.add('active');
    document.getElementById('admin-user').focus();
  }
  setTimeout(() => { logoClicks = 0; }, 2000);
}

function onLogoPressStart(e) {
  e.preventDefault();
  logoTimer = setTimeout(() => {
    document.getElementById('admin-overlay').classList.add('active');
    document.getElementById('admin-user').focus();
  }, 8000);
}

function onLogoPressEnd(e) {
  e.preventDefault();
  if (logoTimer) { clearTimeout(logoTimer); logoTimer = null; }
}

function adminLogin() {
  const u = document.getElementById('admin-user').value.trim();
  const p = document.getElementById('admin-pass').value;
  if (u === 'admin' && p === 'admin123') {
    sessionStorage.setItem('admin_auth', 'true');
    window.location.href = 'admin.html';
  } else {
    document.getElementById('admin-err').classList.add('active');
    document.getElementById('admin-pass').value = '';
  }
}

// ===== PWA =====
function setupPWA() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(e => console.error(e));
  }
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installPrompt = e;
    document.getElementById('install-btn').classList.add('active');
  });
  window.addEventListener('appinstalled', () => {
    installPrompt = null;
    document.getElementById('install-btn').classList.remove('active');
    toast('تم التثبيت', 'ok');
  });
}

async function installApp() {
  if (!installPrompt) return;
  installPrompt.prompt();
  const r = await installPrompt.userChoice;
  if (r.outcome === 'accepted') toast('تم التثبيت', 'ok');
  installPrompt = null;
  document.getElementById('install-btn').classList.remove('active');
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
  document.getElementById('v-close').addEventListener('click', closeViewer);
  document.getElementById('p-play').addEventListener('click', togglePlay);
  document.getElementById('p-prev').addEventListener('click', prevAudio);
  document.getElementById('p-next').addEventListener('click', nextAudio);
  document.getElementById('p-progress').addEventListener('click', seekAudio);
  document.getElementById('admin-login').addEventListener('click', adminLogin);
  document.getElementById('install-btn').addEventListener('click', installApp);

  document.getElementById('admin-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'admin-overlay') document.getElementById('admin-overlay').classList.remove('active');
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeViewer();
  });
}

// ===== Utils =====
function debounce(fn, ms) {
  let t;
  return function(...a) { clearTimeout(t); t = setTimeout(() => fn.apply(this, a), ms); };
}

function escapeHtml(t) {
  if (!t) return '';
  const d = document.createElement('div');
  d.textContent = t;
  return d.innerHTML;
}

function toast(msg, type) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'toast ' + type;
  el.classList.add('active');
  setTimeout(() => el.classList.remove('active'), 2500);
}
