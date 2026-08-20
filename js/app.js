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
    console.error('Load error:', e);
    allData = { version: '3.0.0.0', sections: [], announcements: [] };
  }
}

// ===== Render Home =====
function renderHome() {
  const container = document.getElementById('home-content');
  const sections = allData.sections || [];

  let html = '';

  if (sections.length === 0) {
    html = `
      <div class="empty">
        <div class="ei">📂</div>
        <div class="et">لا توجد أقسام بعد</div>
      </div>
    `;
  } else {
    sections.forEach(sec => {
      const folders = sec.folders || [];
      const items = sec.items || [];
      const total = items.length;

      html += `
        <div class="sec-group">
          <div class="sec-header">
            <div class="sec-label">
              <span class="ic">${sec.icon || '📁'}</span>
              <span>${escapeHtml(sec.name)}</span>
            </div>
            <span class="sec-count">${total}</span>
          </div>
          <div class="folders-row">
      `;

      if (folders.length === 0) {
        html += `
          <div class="folder-chip empty" onclick="toast('لا توجد مجلدات', 'bad')">
            <div class="fic">📂</div>
            <div class="fnm">فارغ</div>
          </div>
        `;
      } else {
        folders.forEach(f => {
          const count = items.filter(i => i.folderId === f.id).length;
          html += `
            <div class="folder-chip" onclick="openFolder('${sec.id}', '${f.id}')">
              <div class="fic">📁</div>
              <div class="fnm">${escapeHtml(f.name)}</div>
              <div class="fcnt">${count} عنصر</div>
            </div>
          `;
        });
      }

      html += `</div></div>`;
    });
  }

  container.innerHTML = html;
}

// ===== Announcement =====
function showAnnouncement() {
  const bar = document.getElementById('ann-bar');
  const txt = document.getElementById('ann-txt');
  const anns = (allData.announcements || []).filter(a => a.active);

  if (anns.length === 0) {
    bar.classList.remove('on');
    return;
  }

  txt.textContent = anns[0].title + (anns[0].text ? ' — ' + anns[0].text : '');
  bar.classList.add('on');
}

function closeAnn() {
  document.getElementById('ann-bar').classList.remove('on');
}

// ===== Navigation =====
function navTo(page) {
  currentPage = page;
  document.querySelectorAll('.page').forEach(p => p.classList.remove('on'));
  document.querySelectorAll('.bnav button').forEach(b => b.classList.remove('on'));

  const target = document.getElementById('page-' + page);
  if (target) target.classList.add('on');

  const btn = document.querySelector(`.bnav button[data-page="${page}"]`);
  if (btn) btn.classList.add('on');

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function goHome() {
  currentSecId = null;
  currentFoldId = null;
  navTo('home');
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
    page.className = 'page';
    document.getElementById('dynamic-pages').appendChild(page);
  }

  document.querySelectorAll('.page').forEach(p => p.classList.remove('on'));
  page.classList.add('on');
  document.querySelectorAll('.bnav button').forEach(b => b.classList.remove('on'));

  const items = (sec.items || []).filter(i => i.folderId === foldId && i.visibility !== 'private');

  let html = `
    <div class="breadcrumb">
      <button class="back" onclick="goHome()">← رجوع</button>
      <span class="crumb">${escapeHtml(fold.name)}</span>
    </div>
  `;

  if (sec.id === 'audios') {
    html += `<div class="a-list">`;
    if (items.length === 0) {
      html += `<div class="empty"><div class="ei">🎧</div><div class="et">لا توجد مقاطع</div></div>`;
    } else {
      items.forEach((item, idx) => {
        html += `
          <div class="a-row" data-idx="${idx}">
            <img src="${item.cover || 'https://via.placeholder.com/48'}" alt="" onerror="this.style.display='none'">
            <div class="ai">
              <div class="at">${escapeHtml(item.title)}</div>
              <div class="ad">${escapeHtml(item.description || '')}</div>
            </div>
            <button class="ap">▶</button>
          </div>
        `;
      });
    }
    html += `</div>`;
  } else {
    html += `<div class="m-grid">`;
    if (items.length === 0) {
      html += `<div class="empty"><div class="ei">📂</div><div class="et">لا يوجد محتوى</div></div>`;
    } else {
      items.forEach(item => {
        html += `
          <div class="m-card" data-id="${item.id}" style="position:relative;">
            <img src="${item.thumbnail || item.url}" alt="${escapeHtml(item.title)}" loading="lazy" onerror="this.src='https://via.placeholder.com/400x300/1a1a1a/666?text=${encodeURIComponent(item.title)}'">
            <div class="mi">
              <div class="mt">${escapeHtml(item.title)}</div>
              <div class="md">${escapeHtml(item.description || '')}</div>
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
    page.querySelectorAll('.a-row').forEach(row => {
      row.addEventListener('click', (e) => {
        if (e.target.closest('.ap')) return;
        playAudio(parseInt(row.dataset.idx));
      });
    });
    page.querySelectorAll('.ap').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        playAudio(parseInt(btn.closest('.a-row').dataset.idx));
      });
    });
  } else {
    page.querySelectorAll('.m-card').forEach(card => {
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
  document.getElementById('viewer').classList.add('on');
  document.body.style.overflow = 'hidden';
}

function updateViewer() {
  const item = mediaList[mediaIdx];
  const content = document.getElementById('vcon');
  const title = document.getElementById('vt');
  const actions = document.getElementById('va');

  title.textContent = item.title;

  if (item.type === 'video') {
    content.innerHTML = `<video src="${item.url}" controls autoplay style="max-width:100%;max-height:65vh;border-radius:12px;"></video>`;
  } else {
    content.innerHTML = `<img src="${item.url}" alt="" style="max-width:100%;max-height:65vh;border-radius:12px;">`;
  }

  let btns = '';
  if (item.allowDownload !== false) {
    btns += `<button class="pri" onclick="dlCurrent()">⬇️ تنزيل</button>`;
  }
  if (item.allowShare !== false) {
    btns += `<button onclick="shareCurrent()">🔗 مشاركة</button>`;
  }
  actions.innerHTML = btns;
}

function closeViewer() {
  document.getElementById('viewer').classList.remove('on');
  document.body.style.overflow = '';
  const v = document.querySelector('#vcon video');
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
      document.getElementById('ppb').style.width = pct + '%';
    });
    audioEl.addEventListener('ended', () => playAudio((audioIdx + 1) % audioItems.length));
  }

  audioEl.src = item.url;
  audioEl.play().catch(() => {});
  isPlaying = true;

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
    page.className = 'page';
    document.getElementById('dynamic-pages').appendChild(page);
  }

  document.querySelectorAll('.page').forEach(p => p.classList.remove('on'));
  page.classList.add('on');
  document.querySelectorAll('.bnav button').forEach(b => b.classList.remove('on'));

  let html = `
    <div class="breadcrumb">
      <button class="back" onclick="goHome()">← رجوع</button>
      <span class="crumb">نتائج البحث</span>
    </div>
  `;

  if (results.length === 0) {
    html += `<div class="empty"><div class="ei">🔍</div><div class="et">لا توجد نتائج</div></div>`;
  } else {
    html += `<div class="m-grid">`;
    results.forEach(item => {
      html += `
        <div class="m-card" data-id="${item.id}" style="position:relative;">
          <img src="${item.thumbnail || item.url}" alt="" loading="lazy" onerror="this.style.display='none'">
          <div class="mi">
            <div class="mt">${escapeHtml(item.title)}</div>
            <div class="md">${escapeHtml(item.secName)}</div>
          </div>
        </div>
      `;
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

function adminLogin() {
  const u = document.getElementById('admin-user').value.trim();
  const p = document.getElementById('admin-pass').value;
  if (u === 'admin' && p === 'admin123') {
    sessionStorage.setItem('admin_auth', 'true');
    window.location.href = 'admin.html';
  } else {
    document.getElementById('admin-err').classList.add('on');
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
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2500);
}
