// ===== App State =====
let allContent = { sections: [], announcements: [] };
let currentSection = 'home';
let currentFolderId = null;
let currentSectionId = null;
let currentMedia = [];
let currentMediaIndex = 0;
let audioPlayer = null;
let isPlaying = false;
let currentAudioIndex = 0;
let audioList = [];
let logoClickCount = 0;
let logoPressTimer = null;
let deferredPrompt = null;

// ===== Initialize =====
document.addEventListener('DOMContentLoaded', async () => {
  try {
    await loadContent();
    setupEventListeners();
    setupPWA();
    renderHome();
    showAnnouncements();
    showToast('مرحباً بك في الحشد الفاطمي', 'success');
  } catch (err) {
    console.error('Init error:', err);
    showToast('خطأ في تحميل التطبيق', 'error');
  }
});

// ===== Load Content =====
async function loadContent() {
  try {
    const resp = await fetch('content.json?nocache=' + Date.now(), { cache: 'no-store' });
    if (resp.ok) {
      allContent = await resp.json();
      if (!allContent.sections) allContent = migrateOldContent(allContent);
    }
  } catch (err) {
    console.error('Content load error:', err);
    allContent = { sections: [], announcements: [] };
  }
}

function migrateOldContent(old) {
  return {
    sections: [
      { id: 'images', name: 'الصور', icon: '🖼', folders: [], items: old.images || [] },
      { id: 'videos', name: 'الفيديوهات', icon: '🎥', folders: [], items: old.videos || [] },
      { id: 'audios', name: 'المقاطع الصوتية', icon: '🎧', folders: [], items: old.audios || [] }
    ],
    announcements: []
  };
}

// ===== Render Home =====
function renderHome() {
  const grid = document.getElementById('categories-grid');
  const sections = allContent.sections || [];

  let html = '';
  sections.forEach(sec => {
    const count = sec.items?.length || 0;
    html += `
      <div class="category-card" onclick="navigateToSection('${sec.id}')">
        <div class="category-icon">${sec.icon || '📁'}</div>
        <div class="category-name">${escapeHtml(sec.name)}</div>
        <div class="category-count">${count} عنصر</div>
      </div>
    `;
  });

  grid.innerHTML = html;
  updateNavCounts();
}

function updateNavCounts() {
  // Update any visible counts
}

// ===== Announcements =====
function showAnnouncements() {
  const bar = document.getElementById('announcements-bar');
  const text = document.getElementById('announcement-text');
  const announcements = (allContent.announcements || []).filter(a => a.active);

  if (announcements.length === 0) {
    bar.classList.remove('active');
    return;
  }

  const ann = announcements[0];
  text.querySelector('span:last-child').textContent = ann.title + (ann.text ? ' - ' + ann.text : '');
  bar.classList.add('active');
}

// ===== Navigation =====
function navigateTo(section) {
  document.querySelectorAll('.section-container').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

  const target = document.getElementById('section-' + section);
  if (target) target.classList.add('active');

  const navBtn = document.querySelector(`.nav-btn[data-section="${section}"]`);
  if (navBtn) navBtn.classList.add('active');

  currentSection = section;
  window.scrollTo({ top: 0, behavior: 'smooth' });

  if (section === 'home') {
    renderHome();
  }
}

function goHome() {
  currentFolderId = null;
  currentSectionId = null;
  navigateTo('home');
}

function navigateToSection(sectionId) {
  currentSectionId = sectionId;
  currentFolderId = null;

  const section = allContent.sections?.find(s => s.id === sectionId);
  if (!section) return;

  // Check if section has folders
  const folders = section.folders || [];

  // Create or get section container
  let container = document.getElementById('section-' + sectionId);
  if (!container) {
    container = document.createElement('div');
    container.id = 'section-' + sectionId;
    container.className = 'section-container';
    document.getElementById('dynamic-sections').appendChild(container);
  }

  document.querySelectorAll('.section-container').forEach(s => s.classList.remove('active'));
  container.classList.add('active');
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));

  if (folders.length > 0) {
    renderFoldersView(container, section);
  } else {
    renderItemsView(container, section, null);
  }

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function navigateToFolder(sectionId, folderId) {
  currentSectionId = sectionId;
  currentFolderId = folderId;

  const section = allContent.sections?.find(s => s.id === sectionId);
  if (!section) return;

  let container = document.getElementById('section-' + sectionId);
  if (!container) return;

  renderItemsView(container, section, folderId);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ===== Render Folders View =====
function renderFoldersView(container, section) {
  const folders = section.folders || [];
  const items = section.items || [];

  let html = `
    <div class="breadcrumb">
      <button class="back-btn" onclick="goHome()">← رجوع للرئيسية</button>
    </div>
    <div class="section-title-box">
      <h2>${section.icon || '📁'} ${escapeHtml(section.name)}</h2>
      <div class="section-line"></div>
    </div>
  `;

  if (folders.length === 0) {
    html += `<div class="empty-state"><div class="icon">📁</div><div class="text">لا توجد مجلدات</div></div>`;
  } else {
    folders.forEach(folder => {
      const count = items.filter(i => i.folderId === folder.id).length;
      html += `
        <div class="folder-card" onclick="navigateToFolder('${section.id}', '${folder.id}')">
          <div class="folder-icon-box">📁</div>
          <div class="folder-info">
            <div class="folder-name">${escapeHtml(folder.name)}</div>
            <div class="folder-meta">${count} عنصر</div>
          </div>
          <div class="folder-arrow">‹</div>
        </div>
      `;
    });
  }

  container.innerHTML = html;
}

// ===== Render Items View =====
function renderItemsView(container, section, folderId) {
  const folders = section.folders || [];
  const allItems = section.items || [];
  const folder = folderId ? folders.find(f => f.id === folderId) : null;
  const folderName = folder ? folder.name : section.name;
  const items = folderId ? allItems.filter(i => i.folderId === folderId) : allItems;

  // Filter public items for normal view
  const publicItems = items.filter(i => i.visibility !== 'private');

  let html = `
    <div class="breadcrumb">
      <button class="back-btn" onclick="${folderId ? `navigateToSection('${section.id}')` : 'goHome()'}">← ${folderId ? 'رجوع للمجلدات' : 'رجوع للرئيسية'}</button>
    </div>
    <div class="section-title-box">
      <h2>${folder ? '📁' : (section.icon || '📁')} ${escapeHtml(folderName)}</h2>
      <div class="section-line"></div>
    </div>
  `;

  if (section.id === 'audios') {
    // Audio list view
    html += `<div class="audio-list" id="audio-list-${section.id}-${folderId || 'all'}">`;
    if (publicItems.length === 0) {
      html += `<div class="empty-state"><div class="icon">🎧</div><div class="text">لا توجد مقاطع صوتية</div></div>`;
    } else {
      publicItems.forEach((item, idx) => {
        html += createAudioCard(item, idx);
      });
    }
    html += `</div>`;
  } else {
    // Grid view for images/videos
    html += `<div class="media-grid" id="media-grid-${section.id}-${folderId || 'all'}">`;
    if (publicItems.length === 0) {
      html += `<div class="empty-state"><div class="icon">📂</div><div class="text">لا يوجد محتوى</div></div>`;
    } else {
      publicItems.forEach(item => {
        html += createMediaCard(item);
      });
    }
    html += `</div>`;
  }

  container.innerHTML = html;

  // Attach listeners
  if (section.id === 'audios') {
    attachAudioListeners(container, publicItems);
  } else {
    attachMediaListeners(container, publicItems);
  }
}

function createMediaCard(item) {
  const isPrivate = item.visibility === 'private';
  return `
    <div class="media-card" data-id="${item.id}" data-type="${item.type}">
      <img src="${item.thumbnail || item.url}" alt="${escapeHtml(item.title)}" loading="lazy" onerror="this.src='https://via.placeholder.com/400x300/1a1a1a/d4af37?text=${encodeURIComponent(item.title)}'">
      <div class="media-info">
        <div class="media-title">${escapeHtml(item.title)}</div>
        <div class="media-desc">${escapeHtml(item.description || '')}</div>
      </div>
      ${isPrivate ? '<div class="private-badge">🔒 خاص</div>' : ''}
    </div>
  `;
}

function createAudioCard(item, index) {
  return `
    <div class="audio-item" data-id="${item.id}" data-index="${index}">
      <img src="${item.cover || item.thumbnail || 'https://via.placeholder.com/60/1a1a1a/d4af37?text=🎧'}" alt="" class="audio-cover" onerror="this.style.display='none'">
      <div class="audio-info">
        <div class="audio-title">${escapeHtml(item.title)}</div>
        <div class="audio-desc">${escapeHtml(item.description || '')}</div>
      </div>
      <button class="audio-play-btn">▶</button>
    </div>
  `;
}

function attachMediaListeners(container, items) {
  container.querySelectorAll('.media-card').forEach(card => {
    card.addEventListener('click', () => {
      const id = parseInt(card.dataset.id);
      const type = card.dataset.type;
      openViewer(id, type, items);
    });
  });
}

function attachAudioListeners(container, items) {
  audioList = items;
  container.querySelectorAll('.audio-item').forEach(item => {
    item.addEventListener('click', (e) => {
      if (e.target.closest('.audio-play-btn')) return;
      const index = parseInt(item.dataset.index);
      playAudioAt(index);
    });
  });
  container.querySelectorAll('.audio-play-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const index = parseInt(btn.closest('.audio-item').dataset.index);
      playAudioAt(index);
    });
  });
}

// ===== Media Viewer =====
function openViewer(id, type, items) {
  currentMedia = items || [];
  currentMediaIndex = currentMedia.findIndex(i => i.id === id);
  if (currentMediaIndex === -1) return;

  updateViewer();
  document.getElementById('media-viewer').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function updateViewer() {
  const item = currentMedia[currentMediaIndex];
  const content = document.getElementById('viewer-content');
  const title = document.getElementById('viewer-title');
  const actions = document.getElementById('viewer-actions');

  title.textContent = item.title;

  const isVideo = item.type === 'video';
  const isAudio = item.type === 'audio';

  if (isVideo) {
    content.innerHTML = `<video src="${item.url}" controls autoplay style="max-width:100%;max-height:70vh;border-radius:12px;"></video>`;
  } else {
    content.innerHTML = `<img src="${item.url}" alt="${escapeHtml(item.title)}" style="max-width:100%;max-height:70vh;border-radius:12px;">`;
  }

  // Build actions based on permissions
  let actionsHtml = '';
  if (item.allowDownload !== false) {
    actionsHtml += `<button class="viewer-action-btn gold" onclick="downloadCurrentMedia()"><span>⬇️</span> تنزيل</button>`;
  }
  if (item.allowShare !== false) {
    actionsHtml += `<button class="viewer-action-btn" onclick="shareCurrentMedia()"><span>🔗</span> مشاركة</button>`;
  }
  actions.innerHTML = actionsHtml;
}

function closeViewer() {
  document.getElementById('media-viewer').classList.remove('active');
  document.body.style.overflow = '';
  const video = document.querySelector('#viewer-content video');
  if (video) video.pause();
}

function navigateViewer(direction) {
  currentMediaIndex += direction;
  if (currentMediaIndex < 0) currentMediaIndex = currentMedia.length - 1;
  if (currentMediaIndex >= currentMedia.length) currentMediaIndex = 0;
  updateViewer();
}

async function downloadCurrentMedia() {
  const item = currentMedia[currentMediaIndex];
  if (item.allowDownload === false) {
    showToast('التنزيل غير متاح لهذا المحتوى', 'error');
    return;
  }

  try {
    showToast('جاري التنزيل...', 'info');
    const resp = await fetch(item.url);
    const blob = await resp.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const ext = item.type === 'video' ? '.mp4' : item.type === 'audio' ? '.mp3' : '.jpg';
    a.download = (item.title || 'download') + ext;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('تم التنزيل بنجاح', 'success');
  } catch (err) {
    showToast('خطأ في التنزيل', 'error');
  }
}

async function shareCurrentMedia() {
  const item = currentMedia[currentMediaIndex];
  if (item.allowShare === false) {
    showToast('المشاركة غير متاحة لهذا المحتوى', 'error');
    return;
  }

  if (navigator.share) {
    try {
      await navigator.share({ title: item.title, text: item.description, url: item.url });
    } catch (e) {}
  } else {
    await navigator.clipboard.writeText(item.url);
    showToast('تم نسخ الرابط', 'success');
  }
}

// ===== Audio Player =====
function playAudioAt(index) {
  if (!audioList.length) return;
  currentAudioIndex = index;
  const item = audioList[index];

  if (!audioPlayer) {
    audioPlayer = new Audio();
    audioPlayer.addEventListener('timeupdate', updatePlayerProgress);
    audioPlayer.addEventListener('ended', playNextAudio);
  }

  audioPlayer.src = item.url;
  audioPlayer.play().catch(() => {});
  isPlaying = true;

  document.getElementById('player-cover').src = item.cover || item.thumbnail || 'https://via.placeholder.com/60';
  document.getElementById('player-title').textContent = item.title;
  document.getElementById('player-play').textContent = '⏸';
  document.getElementById('audio-player-bar').classList.add('active');
}

function toggleAudioPlay() {
  if (!audioPlayer) return;
  if (isPlaying) {
    audioPlayer.pause();
    document.getElementById('player-play').textContent = '▶';
  } else {
    audioPlayer.play().catch(() => {});
    document.getElementById('player-play').textContent = '⏸';
  }
  isPlaying = !isPlaying;
}

function playNextAudio() {
  if (!audioList.length) return;
  currentAudioIndex = (currentAudioIndex + 1) % audioList.length;
  playAudioAt(currentAudioIndex);
}

function playPrevAudio() {
  if (!audioList.length) return;
  currentAudioIndex = (currentAudioIndex - 1 + audioList.length) % audioList.length;
  playAudioAt(currentAudioIndex);
}

function updatePlayerProgress() {
  if (!audioPlayer || !audioPlayer.duration) return;
  const pct = (audioPlayer.currentTime / audioPlayer.duration) * 100;
  document.getElementById('player-progress-bar').style.width = pct + '%';
}

function seekAudio(e) {
  if (!audioPlayer || !audioPlayer.duration) return;
  const rect = e.currentTarget.getBoundingClientRect();
  const pct = (e.clientX - rect.left) / rect.width;
  audioPlayer.currentTime = pct * audioPlayer.duration;
}

// ===== Search =====
function handleSearch(e) {
  const query = e.target.value.trim();
  if (!query) {
    if (currentSection !== 'home') goHome();
    return;
  }

  const allItems = [];
  (allContent.sections || []).forEach(sec => {
    (sec.items || []).forEach(item => {
      if (item.visibility !== 'private') {
        allItems.push({ ...item, sectionName: sec.name });
      }
    });
  });

  const results = allItems.filter(item =>
    (item.title && item.title.includes(query)) ||
    (item.description && item.description.includes(query))
  );

  // Show search results in a temp view
  let container = document.getElementById('section-search-results');
  if (!container) {
    container = document.createElement('div');
    container.id = 'section-search-results';
    container.className = 'section-container';
    document.getElementById('dynamic-sections').appendChild(container);
  }

  document.querySelectorAll('.section-container').forEach(s => s.classList.remove('active'));
  container.classList.add('active');

  let html = `
    <div class="breadcrumb">
      <button class="back-btn" onclick="goHome()">← رجوع للرئيسية</button>
    </div>
    <div class="section-title-box">
      <h2>🔍 نتائج البحث</h2>
      <div class="section-line"></div>
    </div>
  `;

  if (results.length === 0) {
    html += `<div class="empty-state"><div class="icon">🔍</div><div class="text">لا توجد نتائج</div></div>`;
  } else {
    html += `<div class="media-grid">`;
    results.forEach(item => {
      html += createMediaCard(item);
    });
    html += `</div>`;
  }

  container.innerHTML = html;
  attachMediaListeners(container, results);
}

// ===== Admin Login =====
function handleLogoClick() {
  logoClickCount++;
  if (logoClickCount >= 5) {
    logoClickCount = 0;
    document.getElementById('admin-overlay').classList.add('active');
    document.getElementById('admin-username').focus();
  }
  setTimeout(() => { logoClickCount = 0; }, 2000);
}

function handleLogoPressStart(e) {
  e.preventDefault();
  logoPressTimer = setTimeout(() => {
    document.getElementById('admin-overlay').classList.add('active');
    document.getElementById('admin-username').focus();
  }, 8000);
}

function handleLogoPressEnd(e) {
  e.preventDefault();
  if (logoPressTimer) { clearTimeout(logoPressTimer); logoPressTimer = null; }
}

function handleAdminLogin() {
  const username = document.getElementById('admin-username').value.trim();
  const password = document.getElementById('admin-password').value;

  if (username === 'admin' && password === 'admin123') {
    sessionStorage.setItem('admin_auth', 'true');
    window.location.href = 'admin.html';
  } else {
    document.getElementById('admin-error').classList.add('active');
    document.getElementById('admin-password').value = '';
  }
}

// ===== PWA =====
function setupPWA() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(err => console.error('SW error:', err));
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    document.getElementById('install-btn').classList.add('active');
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    document.getElementById('install-btn').classList.remove('active');
    showToast('تم تثبيت التطبيق بنجاح', 'success');
  });
}

async function installPWA() {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  const result = await deferredPrompt.userChoice;
  if (result.outcome === 'accepted') {
    showToast('تم تثبيت التطبيق', 'success');
  }
  deferredPrompt = null;
  document.getElementById('install-btn').classList.remove('active');
}

// ===== Event Listeners =====
function setupEventListeners() {
  const logo = document.getElementById('app-logo');
  if (logo) {
    logo.addEventListener('click', handleLogoClick);
    logo.addEventListener('touchstart', handleLogoPressStart);
    logo.addEventListener('touchend', handleLogoPressEnd);
    logo.addEventListener('mousedown', handleLogoPressStart);
    logo.addEventListener('mouseup', handleLogoPressEnd);
    logo.addEventListener('mouseleave', handleLogoPressEnd);
  }

  document.getElementById('search-input').addEventListener('input', debounce(handleSearch, 300));
  document.getElementById('viewer-close').addEventListener('click', closeViewer);
  document.getElementById('viewer-prev').addEventListener('click', () => navigateViewer(-1));
  document.getElementById('viewer-next').addEventListener('click', () => navigateViewer(1));
  document.getElementById('player-play').addEventListener('click', toggleAudioPlay);
  document.getElementById('player-prev').addEventListener('click', playPrevAudio);
  document.getElementById('player-next').addEventListener('click', playNextAudio);
  document.getElementById('player-progress').addEventListener('click', seekAudio);
  document.getElementById('admin-login-btn').addEventListener('click', handleAdminLogin);
  document.getElementById('admin-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'admin-overlay') document.getElementById('admin-overlay').classList.remove('active');
  });
  document.getElementById('install-btn').addEventListener('click', installPWA);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeViewer();
    const viewer = document.getElementById('media-viewer');
    if (viewer.classList.contains('active')) {
      if (e.key === 'ArrowLeft') navigateViewer(1);
      if (e.key === 'ArrowRight') navigateViewer(-1);
    }
  });
}

// ===== Utilities =====
function debounce(func, wait) {
  let timeout;
  return function(...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = 'toast ' + type;
  toast.classList.add('active');
  setTimeout(() => toast.classList.remove('active'), 3000);
}
