// ===== Admin State =====
let repoContent = { sections: [], announcements: [] };
let navStack = [];
let currentUploadFile = null;

const REPO = 'alhashedalfatimy/al-hashd-fatimi';
const BRANCH = 'main';

function getToken() {
  return localStorage.getItem('github_token') || sessionStorage.getItem('github_token') || '';
}
function setToken(token) {
  localStorage.setItem('github_token', token);
  sessionStorage.setItem('github_token', token);
}

// ===== Initialize =====
document.addEventListener('DOMContentLoaded', async () => {
  if (!sessionStorage.getItem('admin_auth')) {
    window.location.href = 'index.html';
    return;
  }

  let token = getToken();
  if (!token) {
    token = prompt('أدخل توكن GitHub (مرة واحدة فقط):\nhttps://github.com/settings/tokens');
    if (!token) { showToast('يجب إدخال التوكن', 'error'); return; }
    setToken(token);
  }

  try {
    await loadContent();
    setupListeners();
    renderSectionsPage();
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
      if (!repoContent.announcements) repoContent.announcements = [];
    }
  } catch (err) {
    repoContent = { sections: [], announcements: [] };
  }
}

function migrateOldContent(old) {
  return {
    sections: [
      { id: 'images', name: 'الصور', icon: '🖼', folders: [], items: old.images || [] },
      { id: 'videos', name: 'الفيديوهات', icon: '🎥', folders: [], items: old.videos || [] },
      { id: 'audios', name: 'المقاطع الصوتية', icon: '🎧', folders: [], items: old.audios || [] }
    ],
    announcements: old.announcements || []
  };
}

// ===== GitHub API =====
async function githubApi(path, method = 'GET', body = null) {
  const token = getToken();
  const url = path.startsWith('http') ? path : 'https://api.github.com/repos/' + REPO + path;
  const opts = {
    method,
    headers: {
      'Authorization': 'token ' + token,
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
  if (!current || current.type === 'sections') renderSectionsPage();
  else if (current.type === 'section') renderSectionPage(current.id);
  else if (current.type === 'folder') renderFolderPage(current.sectionId, current.folderId);
  else if (current.type === 'announcements') renderAnnouncementsPage();
}

// ===== Page 1: Sections =====
function renderSectionsPage() {
  navStack = [{ type: 'sections' }];
  const container = document.getElementById('admin-view');
  const sections = repoContent.sections || [];

  let html = `
    <div class="page-title">📋 الأقسام</div>
    <div style="margin:0 16px 12px;color:var(--text-secondary);font-size:0.85rem;">
      اضغط على أي قسم لإدارة مجلداته ومحتواه
    </div>
  `;

  if (sections.length === 0) {
    html += `<div class="empty-state"><div class="icon">📂</div><div class="text">لا توجد أقسام</div></div>`;
  } else {
    sections.forEach((sec, idx) => {
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
          <div class="card-actions">
            <button class="action-btn edit" onclick="event.stopPropagation();editSection(${idx})">✏️</button>
            <button class="action-btn delete" onclick="event.stopPropagation();deleteSection(${idx})">🗑️</button>
          </div>
        </div>
      `;
    });
  }

  html += `
    <div style="display:flex;gap:10px;margin:16px;">
      <div class="add-fab" style="flex:1;" onclick="openAddSectionModal()">
        <span>➕</span>
        <span>إضافة قسم</span>
      </div>
      <div class="add-fab" style="flex:1;background:rgba(212,175,55,0.08);" onclick="pushNav('announcements')">
        <span>📢</span>
        <span>الإعلانات</span>
      </div>
    </div>
  `;

  container.innerHTML = html;
  window.scrollTo(0, 0);
}

// ===== Page 2: Section (Folders) =====
function renderSectionPage(sectionId) {
  const container = document.getElementById('admin-view');
  const section = repoContent.sections?.find(s => s.id === sectionId);
  if (!section) { popNav(); return; }

  const folders = section.folders || [];

  let html = `
    <div class="breadcrumb">
      <button class="back-btn" onclick="popNav()">← رجوع</button>
      <span class="crumb-sep">|</span>
      <span class="crumb">${escapeHtml(section.name)}</span>
    </div>
    <div class="page-title">📁 المجلدات</div>
  `;

  if (folders.length === 0) {
    html += `<div class="empty-state"><div class="icon">📁</div><div class="text">لا توجد مجلدات</div></div>`;
  } else {
    folders.forEach((folder, idx) => {
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
          <div class="card-actions">
            <button class="action-btn edit" onclick="event.stopPropagation();editFolder('${sectionId}',${idx})">✏️</button>
            <button class="action-btn delete" onclick="event.stopPropagation();deleteFolder('${sectionId}',${idx})">🗑️</button>
          </div>
        </div>
      `;
    });
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

// ===== Page 3: Folder (Items) =====
function renderFolderPage(sectionId, folderId) {
  const container = document.getElementById('admin-view');
  const section = repoContent.sections?.find(s => s.id === sectionId);
  if (!section) { popNav(); return; }

  const folder = section.folders?.find(f => f.id === folderId);
  if (!folder) { popNav(); return; }

  const items = (section.items || []).filter(i => i.folderId === folderId);

  let html = `
    <div class="breadcrumb">
      <button class="back-btn" onclick="popNav()">← رجوع</button>
      <span class="crumb-sep">|</span>
      <span class="crumb">${escapeHtml(section.name)}</span>
      <span class="crumb-sep">›</span>
      <span class="crumb">${escapeHtml(folder.name)}</span>
    </div>
    <div class="page-title">📂 ${escapeHtml(folder.name)}</div>
  `;

  // Upload area
  html += `
    <div class="upload-area" id="upload-area">
      <div class="upload-icon">📤</div>
      <div class="upload-text">اضغط هنا لإضافة وسائط لهذا المجلد</div>
      <input type="file" id="file-input" multiple accept="image/*,video/*,audio/*" style="display:none;">
    </div>
  `;

  // Items
  if (items.length === 0) {
    html += `<div class="empty-state"><div class="icon">📂</div><div class="text">لا توجد وسائط</div></div>`;
  } else {
    items.forEach(item => {
      const thumb = item.thumbnail || item.cover || item.url || '';
      const isAudio = item.type === 'audio';
      html += `
        <div class="media-item-card">
          ${thumb ? `<img src="${thumb}" alt="" onerror="this.style.display='none'">` : ''}
          <div class="thumb-placeholder" style="display:${thumb?'none':'flex'}">${isAudio?'🎧':'🖼'}</div>
          <div class="media-info">
            <div class="media-title">${escapeHtml(item.title)}</div>
            <div class="media-desc">${item.visibility === 'private' ? '🔒 خاص · ' : ''}${item.allowDownload !== false ? '⬇️' : '❌'} · ${item.allowShare !== false ? '🔗' : '❌'}</div>
          </div>
          <button class="delete-btn" onclick="deleteMediaItem('${sectionId}', '${folderId}', ${item.id})" title="حذف">🗑</button>
        </div>
      `;
    });
  }

  container.innerHTML = html;
  window.scrollTo(0, 0);

  setTimeout(() => {
    const uploadArea = document.getElementById('upload-area');
    const fileInput = document.getElementById('file-input');
    if (uploadArea && fileInput) {
      uploadArea.onclick = () => fileInput.click();
      fileInput.onchange = (e) => openUploadModal(e, sectionId, folderId);
    }
  }, 0);
}

// ===== Page 4: Announcements =====
function renderAnnouncementsPage() {
  const container = document.getElementById('admin-view');
  const announcements = repoContent.announcements || [];

  let html = `
    <div class="breadcrumb">
      <button class="back-btn" onclick="popNav()">← رجوع</button>
      <span class="crumb-sep">|</span>
      <span class="crumb">📢 الإعلانات</span>
    </div>
    <div class="page-title">📢 الإعلانات والتحديثات</div>
  `;

  if (announcements.length === 0) {
    html += `<div class="empty-state"><div class="icon">📢</div><div class="text">لا توجد إعلانات</div></div>`;
  } else {
    announcements.forEach((ann, idx) => {
      html += `
        <div class="admin-card">
          <div class="card-info">
            <div class="card-icon">${ann.active ? '🔔' : '🔕'}</div>
            <div>
              <div class="card-name">${escapeHtml(ann.title)}</div>
              <div class="card-meta">${escapeHtml(ann.text || '').substring(0, 50)}${(ann.text||'').length>50?'...':''}</div>
            </div>
          </div>
          <div class="card-actions">
            <button class="action-btn edit" onclick="editAnnouncement(${idx})">✏️</button>
            <button class="action-btn delete" onclick="deleteAnnouncement(${idx})">🗑️</button>
          </div>
        </div>
      `;
    });
  }

  html += `
    <div class="add-fab" onclick="openAddAnnouncementModal()">
      <span>➕</span>
      <span>إضافة إعلان جديد</span>
    </div>
  `;

  container.innerHTML = html;
  window.scrollTo(0, 0);
}

// ===== Upload Modal =====
function openUploadModal(e, sectionId, folderId) {
  const files = Array.from(e.target.files);
  if (!files.length) return;
  currentUploadFile = files[0];

  const section = repoContent.sections?.find(s => s.id === sectionId);
  const body = document.getElementById('modal-body');
  document.getElementById('modal-title').textContent = '📤 إضافة وسائط';

  const url = URL.createObjectURL(currentUploadFile);
  let preview = '';
  if (currentUploadFile.type.startsWith('image/')) {
    preview = `<img src="${url}" style="max-width:100%;max-height:180px;border-radius:12px;margin-bottom:16px;">`;
  } else if (currentUploadFile.type.startsWith('video/')) {
    preview = `<video src="${url}" controls style="max-width:100%;max-height:180px;border-radius:12px;margin-bottom:16px;"></video>`;
  } else {
    preview = `<div style="font-size:3rem;margin-bottom:16px;">🎧</div>`;
  }

  body.innerHTML = `
    <div style="text-align:center;">${preview}</div>
    <div class="form-group">
      <label class="form-label">العنوان</label>
      <input type="text" class="form-input" id="up-title" value="${currentUploadFile.name.split('.')[0]}">
    </div>
    <div class="form-group">
      <label class="form-label">الوصف</label>
      <input type="text" class="form-input" id="up-desc" placeholder="وصف اختياري">
    </div>
    <div style="display:flex;gap:12px;margin-bottom:16px;">
      <label style="display:flex;align-items:center;gap:6px;color:var(--text-secondary);font-size:0.85rem;cursor:pointer;">
        <input type="checkbox" id="up-private" style="width:16px;height:16px;">
        <span>🔒 خاص (لا يظهر للزوار)</span>
      </label>
    </div>
    <div style="display:flex;gap:12px;margin-bottom:16px;">
      <label style="display:flex;align-items:center;gap:6px;color:var(--text-secondary);font-size:0.85rem;cursor:pointer;">
        <input type="checkbox" id="up-download" checked style="width:16px;height:16px;">
        <span>⬇️ السماح بالتنزيل</span>
      </label>
      <label style="display:flex;align-items:center;gap:6px;color:var(--text-secondary);font-size:0.85rem;cursor:pointer;">
        <input type="checkbox" id="up-share" checked style="width:16px;height:16px;">
        <span>🔗 السماح بالمشاركة</span>
      </label>
    </div>
    <button class="submit-btn" onclick="saveUpload('${sectionId}', '${folderId}')">رفع وحفظ</button>
  `;

  document.getElementById('modal-overlay').classList.add('active');
}

async function saveUpload(sectionId, folderId) {
  const title = document.getElementById('up-title').value.trim();
  const description = document.getElementById('up-desc').value.trim();
  const visibility = document.getElementById('up-private').checked ? 'private' : 'public';
  const allowDownload = document.getElementById('up-download').checked;
  const allowShare = document.getElementById('up-share').checked;

  if (!title) { showToast('العنوان مطلوب', 'error'); return; }
  if (!currentUploadFile) { showToast('اختر ملفاً', 'error'); return; }

  showToast('جاري الرفع...', 'info');

  try {
    const filename = Date.now() + '_' + currentUploadFile.name.replace(/\s+/g, '_');
    const repoPath = 'uploads/' + filename;

    const reader = new FileReader();
    reader.readAsDataURL(currentUploadFile);
    reader.onloadend = async function() {
      const base64 = reader.result.split(',')[1];

      await githubApi('/contents/' + repoPath, 'PUT', {
        message: 'Upload ' + filename,
        content: base64,
        branch: BRANCH
      });

      const fileUrl = 'https://raw.githubusercontent.com/' + REPO + '/' + BRANCH + '/' + repoPath;
      const section = repoContent.sections?.find(s => s.id === sectionId);

      const newItem = {
        id: Date.now(),
        title,
        description,
        folderId,
        url: fileUrl,
        type: sectionId === 'images' ? 'image' : sectionId === 'videos' ? 'video' : 'audio',
        visibility,
        allowDownload,
        allowShare
      };

      if (sectionId === 'images') newItem.thumbnail = fileUrl;
      else if (sectionId === 'videos') newItem.thumbnail = fileUrl;
      else { newItem.cover = fileUrl; newItem.duration = '--:--'; }

      if (!section.items) section.items = [];
      section.items.push(newItem);
      await saveContentJson();

      closeModal();
      renderFolderPage(sectionId, folderId);
      showToast('تم الرفع بنجاح!', 'success');
    };
  } catch (err) {
    console.error(err);
    showToast('خطأ: ' + err.message, 'error');
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

// ===== Section Management =====
function editSection(index) {
  const sec = repoContent.sections[index];
  const body = document.getElementById('modal-body');
  document.getElementById('modal-title').textContent = '✏️ تعديل قسم';
  body.innerHTML = `
    <div class="form-group">
      <label class="form-label">الاسم</label>
      <input type="text" class="form-input" id="edit-sec-name" value="${escapeHtml(sec.name)}">
    </div>
    <div class="form-group">
      <label class="form-label">الأيقونة (emoji)</label>
      <input type="text" class="form-input" id="edit-sec-icon" value="${sec.icon || ''}" maxlength="2">
    </div>
    <button class="submit-btn" onclick="saveEditSection(${index})">حفظ التعديل</button>
  `;
  document.getElementById('modal-overlay').classList.add('active');
}

async function saveEditSection(index) {
  const name = document.getElementById('edit-sec-name').value.trim();
  const icon = document.getElementById('edit-sec-icon').value.trim();
  if (!name) { showToast('الاسم مطلوب', 'error'); return; }
  repoContent.sections[index].name = name;
  repoContent.sections[index].icon = icon;
  await saveContentJson();
  closeModal();
  renderSectionsPage();
  showToast('تم التعديل', 'success');
}

async function deleteSection(index) {
  if (!confirm('حذف القسم وجميع محتوياته نهائياً؟')) return;
  repoContent.sections.splice(index, 1);
  await saveContentJson();
  renderSectionsPage();
  showToast('تم الحذف', 'success');
}

function openAddSectionModal() {
  const body = document.getElementById('modal-body');
  document.getElementById('modal-title').textContent = '➕ إضافة قسم جديد';
  body.innerHTML = `
    <div class="form-group">
      <label class="form-label">اسم القسم</label>
      <input type="text" class="form-input" id="new-sec-name" placeholder="مثال: المقالات">
    </div>
    <div class="form-group">
      <label class="form-label">الأيقونة</label>
      <input type="text" class="form-input" id="new-sec-icon" placeholder="📝" maxlength="2" value="📁">
    </div>
    <div class="form-group">
      <label class="form-label">نوع المحتوى</label>
      <select class="form-select" id="new-sec-type">
        <option value="image">🖼 صور</option>
        <option value="video">🎥 فيديو</option>
        <option value="audio">🎧 صوت</option>
      </select>
    </div>
    <button class="submit-btn" onclick="saveNewSection()">حفظ</button>
  `;
  document.getElementById('modal-overlay').classList.add('active');
}

async function saveNewSection() {
  const name = document.getElementById('new-sec-name').value.trim();
  const icon = document.getElementById('new-sec-icon').value.trim() || '📁';
  const type = document.getElementById('new-sec-type').value;
  if (!name) { showToast('الاسم مطلوب', 'error'); return; }
  repoContent.sections.push({
    id: 'sec_' + Date.now(), name, icon,
    folders: [], items: [], defaultType: type
  });
  await saveContentJson();
  closeModal();
  renderSectionsPage();
  showToast('تم الإضافة', 'success');
}

// ===== Folder Management =====
function editFolder(sectionId, index) {
  const section = repoContent.sections?.find(s => s.id === sectionId);
  const folder = section.folders[index];
  const body = document.getElementById('modal-body');
  document.getElementById('modal-title').textContent = '✏️ تعديل مجلد';
  body.innerHTML = `
    <div class="form-group">
      <label class="form-label">اسم المجلد</label>
      <input type="text" class="form-input" id="edit-folder-name" value="${escapeHtml(folder.name)}">
    </div>
    <button class="submit-btn" onclick="saveEditFolder('${sectionId}', ${index})">حفظ</button>
  `;
  document.getElementById('modal-overlay').classList.add('active');
}

async function saveEditFolder(sectionId, index) {
  const name = document.getElementById('edit-folder-name').value.trim();
  if (!name) { showToast('الاسم مطلوب', 'error'); return; }
  const section = repoContent.sections?.find(s => s.id === sectionId);
  section.folders[index].name = name;
  await saveContentJson();
  closeModal();
  renderSectionPage(sectionId);
  showToast('تم التعديل', 'success');
}

async function deleteFolder(sectionId, index) {
  if (!confirm('حذف المجلد؟ (العناصر ستصبح بدون مجلد)')) return;
  const section = repoContent.sections?.find(s => s.id === sectionId);
  const folderId = section.folders[index].id;
  section.folders.splice(index, 1);
  (section.items || []).forEach(item => {
    if (item.folderId === folderId) delete item.folderId;
  });
  await saveContentJson();
  renderSectionPage(sectionId);
  showToast('تم الحذف', 'success');
}

function openAddFolderModal(sectionId) {
  const body = document.getElementById('modal-body');
  document.getElementById('modal-title').textContent = '➕ إضافة مجلد جديد';
  body.innerHTML = `
    <div class="form-group">
      <label class="form-label">اسم المجلد</label>
      <input type="text" class="form-input" id="new-folder-name" placeholder="مثال: حرم الإمام الحسين">
    </div>
    <button class="submit-btn" onclick="saveNewFolder('${sectionId}')">حفظ</button>
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
  showToast('تم الإضافة', 'success');
}

// ===== Announcement Management =====
function openAddAnnouncementModal() {
  const body = document.getElementById('modal-body');
  document.getElementById('modal-title').textContent = '➕ إضافة إعلان';
  body.innerHTML = `
    <div class="form-group">
      <label class="form-label">العنوان</label>
      <input type="text" class="form-input" id="new-ann-title" placeholder="عنوان الإعلان">
    </div>
    <div class="form-group">
      <label class="form-label">النص</label>
      <input type="text" class="form-input" id="new-ann-text" placeholder="نص الإعلان">
    </div>
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;">
      <input type="checkbox" id="new-ann-active" checked style="width:18px;height:18px;">
      <label style="color:var(--text-secondary);">نشط (يظهر للزوار)</label>
    </div>
    <button class="submit-btn" onclick="saveNewAnnouncement()">حفظ</button>
  `;
  document.getElementById('modal-overlay').classList.add('active');
}

async function saveNewAnnouncement() {
  const title = document.getElementById('new-ann-title').value.trim();
  const text = document.getElementById('new-ann-text').value.trim();
  const active = document.getElementById('new-ann-active').checked;
  if (!title) { showToast('العنوان مطلوب', 'error'); return; }
  if (!repoContent.announcements) repoContent.announcements = [];
  repoContent.announcements.push({
    id: Date.now(), title, text, active,
    date: new Date().toISOString().split('T')[0]
  });
  await saveContentJson();
  closeModal();
  renderAnnouncementsPage();
  showToast('تم الإضافة', 'success');
}

function editAnnouncement(index) {
  const ann = repoContent.announcements[index];
  const body = document.getElementById('modal-body');
  document.getElementById('modal-title').textContent = '✏️ تعديل إعلان';
  body.innerHTML = `
    <div class="form-group">
      <label class="form-label">العنوان</label>
      <input type="text" class="form-input" id="edit-ann-title" value="${escapeHtml(ann.title)}">
    </div>
    <div class="form-group">
      <label class="form-label">النص</label>
      <input type="text" class="form-input" id="edit-ann-text" value="${escapeHtml(ann.text || '')}">
    </div>
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;">
      <input type="checkbox" id="edit-ann-active" ${ann.active ? 'checked' : ''} style="width:18px;height:18px;">
      <label style="color:var(--text-secondary);">نشط</label>
    </div>
    <button class="submit-btn" onclick="saveEditAnnouncement(${index})">حفظ</button>
  `;
  document.getElementById('modal-overlay').classList.add('active');
}

async function saveEditAnnouncement(index) {
  const title = document.getElementById('edit-ann-title').value.trim();
  const text = document.getElementById('edit-ann-text').value.trim();
  const active = document.getElementById('edit-ann-active').checked;
  if (!title) { showToast('العنوان مطلوب', 'error'); return; }
  repoContent.announcements[index] = { ...repoContent.announcements[index], title, text, active };
  await saveContentJson();
  closeModal();
  renderAnnouncementsPage();
  showToast('تم التعديل', 'success');
}

async function deleteAnnouncement(index) {
  if (!confirm('حذف الإعلان؟')) return;
  repoContent.announcements.splice(index, 1);
  await saveContentJson();
  renderAnnouncementsPage();
  showToast('تم الحذف', 'success');
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
    window.location.href = 'index.html';
  };
  document.getElementById('modal-close').onclick = closeModal;
  document.getElementById('modal-overlay').onclick = (e) => {
    if (e.target.id === 'modal-overlay') closeModal();
  };
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('active');
  currentUploadFile = null;
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
