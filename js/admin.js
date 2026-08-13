// ===== Admin State =====
let repoContent = { sections: [] };
let navStack = []; // [{type:'sections'}, {type:'section', id:'images'}, {type:'folder', sectionId:'images', folderId:'imam-ali'}]

const GITHUB_TOKEN = sessionStorage.getItem('github_token') || '';
const REPO = 'alhashedalfatimy/al-hashd-fatimi';
const BRANCH = 'main';

// ===== Initialize Admin =====
document.addEventListener('DOMContentLoaded', async () => {
  if (!sessionStorage.getItem('admin_auth')) {
    window.location.href = 'index.html';
    return;
  }

  if (!GITHUB_TOKEN) {
    const token = prompt('أدخل توكن GitHub الخاص بك:\nhttps://github.com/settings/tokens');
    if (token) {
      sessionStorage.setItem('github_token', token);
      location.reload();
    } else {
      showToast('يجب إدخال التوكن', 'error');
    }
    return;
  }

  try {
    await loadContent();
    renderSectionsPage();
    setupListeners();
  } catch (err) {
    console.error(err);
    showToast('خطأ في التحميل', 'error');
  }
});

// ===== Load Content =====
async function loadContent() {
  try {
    const resp = await fetch('https://raw.githubusercontent.com/' + REPO + '/' + BRANCH + '/content.json?nocache=' + Date.now());
    if (resp.ok) {
      repoContent = await resp.json();
      if (!repoContent.sections) repoContent = migrateOldContent(repoContent);
    }
  } catch (err) {
    repoContent = { sections: [] };
  }
}

function migrateOldContent(old) {
  return {
    sections: [
      { id: 'images', name: 'الصور', icon: '🖼', folders: [], items: old.images || [] },
      { id: 'videos', name: 'الفيديوهات', icon: '🎥', folders: [], items: old.videos || [] },
      { id: 'audios', name: 'المقاطع الصوتية', icon: '🎧', folders: [], items: old.audios || [] }
    ]
  };
}

// ===== GitHub API =====
async function githubApi(path, method = 'GET', body = null) {
  const url = path.startsWith('http') ? path : 'https://api.github.com/repos/' + REPO + path;
  const opts = {
    method,
    headers: {
      'Authorization': 'token ' + GITHUB_TOKEN,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      'User-Agent': 'AlHashdAdmin'
    }
  };
  if (body) opts.body = JSON.stringify(body);
  const resp = await fetch(url, opts);
  if (!resp.ok) throw new Error(await resp.text());
  if (resp.status === 204) return null;
  return resp.json();
}

// ===== Navigation =====
function pushNav(type, data = {}) {
  navStack.push({ type, ...data });
  renderCurrentPage();
}

function popNav() {
  navStack.pop();
  renderCurrentPage();
}

function renderCurrentPage() {
  const current = navStack[navStack.length - 1];
  if (!current || current.type === 'sections') {
    renderSectionsPage();
  } else if (current.type === 'section') {
    renderSectionPage(current.id);
  } else if (current.type === 'folder') {
    renderFolderPage(current.sectionId, current.folderId);
  }
}

// ===== Page 1: Sections List =====
function renderSectionsPage() {
  navStack = [{ type: 'sections' }];
  const container = document.getElementById('admin-view');
  const sections = repoContent.sections || [];

  let html = `
    <div class="page-title">📋 الأقسام</div>
  `;

  if (sections.length === 0) {
    html += `<div class="empty-state"><div class="icon">📂</div><div>لا توجد أقسام</div></div>`;
  } else {
    sections.forEach(sec => {
      const totalItems = sec.items?.length || 0;
      const folderCount = sec.folders?.length || 0;
      html += `
        <div class="admin-card" onclick="pushNav('section', {id:'${sec.id}'})">
          <div class="card-info">
            <div class="card-icon">${sec.icon || '📁'}</div>
            <div>
              <div class="card-name">${escapeHtml(sec.name)}</div>
              <div class="card-meta">${folderCount} مجلد · ${totalItems} عنصر</div>
            </div>
          </div>
          <div class="card-arrow">‹</div>
        </div>
      `;
    });
  }

  html += `
    <div class="add-fab" onclick="openAddSectionModal()">
      <span>➕</span>
      <span>إضافة قسم جديد</span>
    </div>
  `;

  container.innerHTML = html;
  window.scrollTo(0, 0);
}

// ===== Page 2: Section (Folders List) =====
function renderSectionPage(sectionId) {
  const container = document.getElementById('admin-view');
  const section = repoContent.sections?.find(s => s.id === sectionId);
  if (!section) { popNav(); return; }

  const folders = section.folders || [];
  const itemsWithoutFolder = (section.items || []).filter(i => !i.folderId);

  let html = `
    <div class="breadcrumb">
      <button class="back-btn" onclick="popNav()">← رجوع</button>
      <span class="crumb-sep">|</span>
      <span class="crumb">${escapeHtml(section.name)}</span>
    </div>
    <div class="page-title">📁 المجلدات</div>
  `;

  // General folder (items without folder)
  if (itemsWithoutFolder.length > 0 || folders.length === 0) {
    html += `
      <div class="admin-card" onclick="pushNav('folder', {sectionId:'${sectionId}', folderId:''})">
        <div class="card-info">
          <div class="card-icon">📂</div>
          <div>
            <div class="card-name">عام (بدون مجلد)</div>
            <div class="card-meta">${itemsWithoutFolder.length} عنصر</div>
          </div>
        </div>
        <div class="card-arrow">‹</div>
      </div>
    `;
  }

  // Folders
  folders.forEach(folder => {
    const count = (section.items || []).filter(i => i.folderId === folder.id).length;
    html += `
      <div class="admin-card" onclick="pushNav('folder', {sectionId:'${sectionId}', folderId:'${folder.id}'})">
        <div class="card-info">
          <div class="card-icon">📁</div>
          <div>
            <div class="card-name">${escapeHtml(folder.name)}</div>
            <div class="card-meta">${count} عنصر</div>
          </div>
        </div>
        <div class="card-arrow">‹</div>
      </div>
    `;
  });

  if (folders.length === 0 && itemsWithoutFolder.length === 0) {
    html += `<div class="empty-state"><div class="icon">📁</div><div>لا توجد مجلدات</div></div>`;
  }

  html += `
    <div class="add-fab" onclick="openAddFolderModal('${sectionId}')">
      <span>➕</span>
      <span>إضافة مجلد جديد</span>
    </div>
  `;

  container.innerHTML = html;
  window.scrollTo(0, 0);
}

// ===== Page 3: Folder (Media Items) =====
function renderFolderPage(sectionId, folderId) {
  const container = document.getElementById('admin-view');
  const section = repoContent.sections?.find(s => s.id === sectionId);
  if (!section) { popNav(); return; }

  const folder = folderId ? section.folders?.find(f => f.id === folderId) : null;
  const folderName = folder ? folder.name : 'عام';
  const items = (section.items || []).filter(i => folderId ? i.folderId === folderId : !i.folderId);

  let html = `
    <div class="breadcrumb">
      <button class="back-btn" onclick="popNav()">← رجوع</button>
      <span class="crumb-sep">|</span>
      <span class="crumb">${escapeHtml(section.name)}</span>
      <span class="crumb-sep">›</span>
      <span class="crumb">${escapeHtml(folderName)}</span>
    </div>
    <div class="page-title">📂 ${escapeHtml(folderName)}</div>
  `;

  // Upload area
  html += `
    <div class="upload-area" id="upload-area">
      <div class="upload-icon">📤</div>
      <div class="upload-text">اضغط هنا لإضافة وسائط جديدة</div>
      <input type="file" id="file-input" multiple accept="image/*,video/*,audio/*" style="display:none;">
    </div>
  `;

  // Items list
  if (items.length === 0) {
    html += `<div class="empty-state"><div class="icon">📂</div><div>لا توجد وسائط في هذا المجلد</div></div>`;
  } else {
    items.forEach((item, idx) => {
      const thumb = item.thumbnail || item.cover || item.url || '';
      const isAudio = item.type === 'audio' || section.id === 'audios';
      html += `
        <div class="media-item-card">
          ${thumb ? `<img src="${thumb}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">` : ''}
          <div class="thumb-placeholder" style="display:${thumb?'none':'flex'}">${isAudio?'🎧':'🖼'}</div>
          <div class="media-info">
            <div class="media-title">${escapeHtml(item.title)}</div>
            <div class="media-desc">${escapeHtml(item.description || '').substring(0, 40)}${(item.description||'').length>40?'...':''}</div>
          </div>
          <button class="delete-btn" onclick="deleteMediaItem('${sectionId}', '${folderId}', ${item.id})" title="حذف">🗑</button>
        </div>
      `;
    });
  }

  container.innerHTML = html;
  window.scrollTo(0, 0);

  // Setup upload
  setTimeout(() => {
    const uploadArea = document.getElementById('upload-area');
    const fileInput = document.getElementById('file-input');
    if (uploadArea && fileInput) {
      uploadArea.onclick = () => fileInput.click();
      fileInput.onchange = (e) => handleFileUpload(e, sectionId, folderId);
    }
  }, 0);
}

// ===== Upload Media =====
async function handleFileUpload(e, sectionId, folderId) {
  const files = Array.from(e.target.files);
  if (!files.length) return;

  const section = repoContent.sections?.find(s => s.id === sectionId);
  const file = files[0];

  // Show modal for title
  const title = prompt('أدخل عنوان الوسائط:', file.name.split('.')[0]);
  if (!title) return;
  const description = prompt('أدخل وصف (اختياري):', '') || '';

  showToast('جاري الرفع...', 'info');

  try {
    const filename = Date.now() + '_' + file.name.replace(/\s+/g, '_');
    const repoPath = 'uploads/' + filename;

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onloadend = async function() {
      const base64 = reader.result.split(',')[1];

      await githubApi('/contents/' + repoPath, 'PUT', {
        message: 'Upload ' + filename,
        content: base64,
        branch: BRANCH
      });

      const fileUrl = 'https://raw.githubusercontent.com/' + REPO + '/' + BRANCH + '/' + repoPath;

      const newItem = {
        id: Date.now(),
        title: title,
        description: description,
        url: fileUrl,
        type: sectionId === 'images' ? 'image' : sectionId === 'videos' ? 'video' : 'audio'
      };

      if (folderId) newItem.folderId = folderId;
      if (sectionId === 'images') newItem.thumbnail = fileUrl;
      else if (sectionId === 'videos') newItem.thumbnail = fileUrl;
      else { newItem.cover = fileUrl; newItem.duration = '--:--'; }

      if (!section.items) section.items = [];
      section.items.push(newItem);
      await saveContentJson();

      renderFolderPage(sectionId, folderId);
      showToast('تم الرفع بنجاح!', 'success');
    };
  } catch (err) {
    console.error(err);
    showToast('خطأ في الرفع: ' + err.message, 'error');
  }
}

// ===== Delete Media =====
async function deleteMediaItem(sectionId, folderId, itemId) {
  if (!confirm('هل أنت متأكد من حذف هذا العنصر؟')) return;

  const section = repoContent.sections?.find(s => s.id === sectionId);
  const idx = section.items.findIndex(i => i.id === itemId);
  if (idx === -1) return;

  section.items.splice(idx, 1);
  await saveContentJson();
  renderFolderPage(sectionId, folderId);
  showToast('تم الحذف', 'success');
}

// ===== Add Section Modal =====
function openAddSectionModal() {
  const body = document.getElementById('modal-body');
  document.getElementById('modal-title').textContent = '➕ إضافة قسم جديد';
  body.innerHTML = `
    <div class="form-group">
      <label class="form-label">اسم القسم</label>
      <input type="text" class="form-input" id="new-sec-name" placeholder="مثال: المقالات">
    </div>
    <div class="form-group">
      <label class="form-label">الأيقونة (emoji)</label>
      <input type="text" class="form-input" id="new-sec-icon" placeholder="📝" maxlength="2" value="📁">
    </div>
    <div class="form-group">
      <label class="form-label">نوع المحتوى الافتراضي</label>
      <select class="form-select" id="new-sec-type">
        <option value="image">🖼 صور</option>
        <option value="video">🎥 فيديو</option>
        <option value="audio">🎧 صوت</option>
      </select>
    </div>
    <button class="submit-btn" onclick="saveNewSection()">حفظ القسم</button>
  `;
  document.getElementById('modal-overlay').classList.add('active');
}

async function saveNewSection() {
  const name = document.getElementById('new-sec-name').value.trim();
  const icon = document.getElementById('new-sec-icon').value.trim() || '📁';
  const type = document.getElementById('new-sec-type').value;
  if (!name) { showToast('الاسم مطلوب', 'error'); return; }

  const id = 'sec_' + Date.now();
  repoContent.sections.push({ id, name, icon, folders: [], items: [], defaultType: type });
  await saveContentJson();
  closeModal();
  renderSectionsPage();
  showToast('تم إضافة القسم', 'success');
}

// ===== Add Folder Modal =====
function openAddFolderModal(sectionId) {
  const body = document.getElementById('modal-body');
  document.getElementById('modal-title').textContent = '➕ إضافة مجلد جديد';
  body.innerHTML = `
    <div class="form-group">
      <label class="form-label">اسم المجلد</label>
      <input type="text" class="form-input" id="new-folder-name" placeholder="مثال: حرم الإمام الحسين">
    </div>
    <button class="submit-btn" onclick="saveNewFolder('${sectionId}')">حفظ المجلد</button>
  `;
  document.getElementById('modal-overlay').classList.add('active');
}

async function saveNewFolder(sectionId) {
  const name = document.getElementById('new-folder-name').value.trim();
  if (!name) { showToast('الاسم مطلوب', 'error'); return; }

  const section = repoContent.sections?.find(s => s.id === sectionId);
  if (!section.folders) section.folders = [];
  section.folders.push({ id: 'folder_' + Date.now(), name });
  await saveContentJson();
  closeModal();
  renderSectionPage(sectionId);
  showToast('تم إضافة المجلد', 'success');
}

// ===== Save Content =====
async function saveContentJson() {
  const content = btoa(unescape(encodeURIComponent(JSON.stringify(repoContent, null, 2))));
  let sha = null;
  try {
    const data = await githubApi('/contents/content.json');
    sha = data.sha;
  } catch (e) {}
  const body = { message: 'Update via admin panel', content, branch: BRANCH };
  if (sha) body.sha = sha;
  await githubApi('/contents/content.json', 'PUT', body);
}

// ===== Listeners =====
function setupListeners() {
  document.getElementById('admin-logout').onclick = () => {
    sessionStorage.removeItem('admin_auth');
    sessionStorage.removeItem('github_token');
    window.location.href = 'index.html';
  };
  document.getElementById('modal-close').onclick = closeModal;
  document.getElementById('modal-overlay').onclick = (e) => {
    if (e.target.id === 'modal-overlay') closeModal();
  };
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('active');
}

// ===== Utilities =====
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
