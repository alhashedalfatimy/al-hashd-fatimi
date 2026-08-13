// ===== Admin State =====
let currentAdminTab = 'content';
let uploadFiles = [];
let repoContent = { sections: [] };
let editingItem = null;
let editingSection = null;
let editingFolder = null;
let currentContentSection = 'images';
let currentFolderSection = 'images';

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
    const token = prompt('أدخل توكن GitHub الخاص بك (للرفع والتعديل):\n\nيمكنك إنشاء توكن من:\nhttps://github.com/settings/tokens\n\nاحفظه لاستخدامه لاحقاً');
    if (token) {
      sessionStorage.setItem('github_token', token);
      location.reload();
    } else {
      showToast('يجب إدخال التوكن للمتابعة', 'error');
    }
    return;
  }

  try {
    await loadContent();
    setupAdminListeners();
    showTab('content');
    updateSectionSelects();
  } catch (err) {
    console.error('Admin init error:', err);
    showToast('خطأ في تحميل لوحة الإدارة', 'error');
  }
});

// ===== Load Content from GitHub =====
async function loadContent() {
  try {
    const resp = await fetch('https://raw.githubusercontent.com/' + REPO + '/' + BRANCH + '/content.json?nocache=' + Date.now());
    if (resp.ok) {
      repoContent = await resp.json();
      // Migrate old format
      if (!repoContent.sections) {
        repoContent = migrateOldContent(repoContent);
      }
    }
  } catch (err) {
    console.error('Load content error:', err);
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

// ===== GitHub API Helper =====
async function githubApi(path, method = 'GET', body = null) {
  const url = path.startsWith('http') ? path : 'https://api.github.com/repos/' + REPO + path;
  const options = {
    method: method,
    headers: {
      'Authorization': 'token ' + GITHUB_TOKEN,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      'User-Agent': 'AlHashdAdmin'
    }
  };
  if (body) options.body = JSON.stringify(body);

  const resp = await fetch(url, options);
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(err);
  }
  if (resp.status === 204) return null;
  return await resp.json();
}

// ===== Event Listeners =====
function setupAdminListeners() {
  // Nav tabs
  document.querySelectorAll('.admin-nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.admin-nav-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      showTab(btn.dataset.tab);
    });
  });

  // Logout
  document.getElementById('admin-logout')?.addEventListener('click', () => {
    sessionStorage.removeItem('admin_auth');
    sessionStorage.removeItem('github_token');
    window.location.href = 'index.html';
  });

  // Upload area
  const uploadArea = document.getElementById('upload-area');
  if (uploadArea) {
    uploadArea.addEventListener('click', () => document.getElementById('file-input').click());
    uploadArea.addEventListener('dragover', (e) => { e.preventDefault(); uploadArea.classList.add('dragover'); });
    uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('dragover'));
    uploadArea.addEventListener('drop', handleFileDrop);
  }

  document.getElementById('file-input')?.addEventListener('change', handleFileSelect);

  // Content section select
  document.getElementById('content-section-select')?.addEventListener('change', (e) => {
    currentContentSection = e.target.value;
    updateFolderSelect('content-folder-select', currentContentSection);
    loadContentTab(currentContentSection);
  });

  // Folder section select
  document.getElementById('folder-section-select')?.addEventListener('change', (e) => {
    currentFolderSection = e.target.value;
    renderFoldersList();
  });

  // Add buttons
  document.getElementById('add-section-btn')?.addEventListener('click', () => openManageModal('section'));
  document.getElementById('add-folder-btn')?.addEventListener('click', () => openManageModal('folder'));

  // Modals
  document.getElementById('modal-close')?.addEventListener('click', closeModal);
  document.getElementById('modal-overlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'modal-overlay') closeModal();
  });
  document.getElementById('save-item-btn')?.addEventListener('click', saveItem);

  document.getElementById('manage-modal-close')?.addEventListener('click', closeManageModal);
  document.getElementById('manage-modal-overlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'manage-modal-overlay') closeManageModal();
  });
  document.getElementById('manage-save-btn')?.addEventListener('click', saveManageItem);
}

// ===== Show Tab =====
function showTab(tab) {
  currentAdminTab = tab;
  document.getElementById('tab-content').style.display = tab === 'content' ? 'block' : 'none';
  document.getElementById('tab-sections').style.display = tab === 'sections' ? 'block' : 'none';
  document.getElementById('tab-folders').style.display = tab === 'folders' ? 'block' : 'none';

  if (tab === 'content') {
    updateFolderSelect('content-folder-select', currentContentSection);
    loadContentTab(currentContentSection);
  } else if (tab === 'sections') {
    renderSectionsList();
  } else if (tab === 'folders') {
    renderFoldersList();
  }
}

// ===== Update Section Selects =====
function updateSectionSelects() {
  const selects = ['content-section-select', 'folder-section-select'];
  selects.forEach(id => {
    const select = document.getElementById(id);
    if (!select) return;
    select.innerHTML = '';
    (repoContent.sections || []).forEach(sec => {
      const opt = document.createElement('option');
      opt.value = sec.id;
      opt.textContent = (sec.icon || '📁') + ' ' + sec.name;
      select.appendChild(opt);
    });
  });
}

function updateFolderSelect(selectId, sectionId) {
  const select = document.getElementById(selectId);
  if (!select) return;
  const section = repoContent.sections?.find(s => s.id === sectionId);
  select.innerHTML = '<option value="">📂 بدون مجلد (عام)</option>';
  (section?.folders || []).forEach(folder => {
    const opt = document.createElement('option');
    opt.value = folder.id;
    opt.textContent = '📁 ' + folder.name;
    select.appendChild(opt);
  });
}

// ===== Load Content Tab =====
function loadContentTab(sectionId) {
  const container = document.getElementById('admin-content');
  const section = repoContent.sections?.find(s => s.id === sectionId);
  if (!section) return;

  const folderId = document.getElementById('content-folder-select')?.value || '';
  let items = section.items || [];
  if (folderId) {
    items = items.filter(i => i.folderId === folderId);
  }

  renderAdminTable(container, items, sectionId);
}

function renderAdminTable(container, items, type) {
  if (items.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📂</div>
        <div class="empty-state-text">لا يوجد محتوى</div>
      </div>
    `;
    return;
  }

  let html = `
    <table class="admin-table">
      <thead>
        <tr>
          <th>الصورة</th>
          <th>العنوان</th>
          <th>الوصف</th>
          <th>المجلد</th>
          <th>الإجراءات</th>
        </tr>
      </thead>
      <tbody>
  `;

  const section = repoContent.sections?.find(s => s.id === type);
  const folders = section?.folders || [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const folder = folders.find(f => f.id === item.folderId);
    html += `
      <tr>
        <td><img src="${item.thumbnail || item.cover || item.url || ''}" alt="${item.title}" onerror="this.src='https://via.placeholder.com/60x40'"></td>
        <td>${escapeHtml(item.title)}</td>
        <td>${escapeHtml(item.description || '').substring(0, 50)}...</td>
        <td>${folder ? escapeHtml(folder.name) : 'عام'}</td>
        <td>
          <button class="admin-action-btn delete" onclick="deleteItem(${i}, '${type}', '${item.folderId || ''}')">حذف</button>
        </td>
      </tr>
    `;
  }

  html += '</tbody></table>';
  container.innerHTML = html;
}

// ===== Sections Management =====
function renderSectionsList() {
  const container = document.getElementById('sections-list');
  const sections = repoContent.sections || [];

  if (sections.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📂</div><div class="empty-state-text">لا توجد أقسام</div></div>';
    return;
  }

  container.innerHTML = sections.map((sec, index) => `
    <div class="glass-card section-card">
      <div class="info">
        <span class="icon">${sec.icon || '📁'}</span>
        <span class="name">${escapeHtml(sec.name)}</span>
      </div>
      <div class="actions">
        <button class="admin-action-btn edit" onclick="editSection(${index})">تعديل</button>
        <button class="admin-action-btn delete" onclick="deleteSection(${index})">حذف</button>
      </div>
    </div>
  `).join('');
}

function editSection(index) {
  editingSection = index;
  const sec = repoContent.sections[index];
  document.getElementById('manage-modal-title').textContent = 'تعديل قسم';
  document.getElementById('manage-name').value = sec.name;
  document.getElementById('manage-icon').value = sec.icon || '';
  document.getElementById('manage-icon-group').style.display = 'block';
  document.getElementById('manage-type-group').style.display = 'none';
  document.getElementById('manage-modal-overlay').classList.add('active');
}

async function deleteSection(index) {
  if (!confirm('هل أنت متأكد من حذف هذا القسم وجميع محتوياته؟')) return;
  repoContent.sections.splice(index, 1);
  await saveContentJson();
  renderSectionsList();
  updateSectionSelects();
  showToast('تم حذف القسم', 'success');
}

// ===== Folders Management =====
function renderFoldersList() {
  const container = document.getElementById('folders-list');
  const section = repoContent.sections?.find(s => s.id === currentFolderSection);
  const folders = section?.folders || [];

  if (folders.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📂</div><div class="empty-state-text">لا توجد مجلدات</div></div>';
    return;
  }

  container.innerHTML = folders.map((folder, index) => {
    const count = section.items?.filter(i => i.folderId === folder.id).length || 0;
    return `
      <div class="glass-card folder-card">
        <div class="info">
          <span class="icon">📁</span>
          <div>
            <div class="name">${escapeHtml(folder.name)}</div>
            <div style="color:var(--text-secondary);font-size:0.85rem;">${count} عنصر</div>
          </div>
        </div>
        <div class="actions">
          <button class="admin-action-btn edit" onclick="editFolder(${index})">تعديل</button>
          <button class="admin-action-btn delete" onclick="deleteFolder(${index})">حذف</button>
        </div>
      </div>
    `;
  }).join('');
}

function editFolder(index) {
  editingFolder = { sectionId: currentFolderSection, index: index };
  const section = repoContent.sections?.find(s => s.id === currentFolderSection);
  const folder = section.folders[index];
  document.getElementById('manage-modal-title').textContent = 'تعديل مجلد';
  document.getElementById('manage-name').value = folder.name;
  document.getElementById('manage-icon-group').style.display = 'none';
  document.getElementById('manage-type-group').style.display = 'none';
  document.getElementById('manage-modal-overlay').classList.add('active');
}

async function deleteFolder(index) {
  if (!confirm('هل أنت متأكد من حذف هذا المجلد؟ (لن يتم حذف العناصر، ستصبح بدون مجلد)')) return;
  const section = repoContent.sections?.find(s => s.id === currentFolderSection);
  const folderId = section.folders[index].id;
  section.folders.splice(index, 1);
  // Remove folderId from items
  (section.items || []).forEach(item => {
    if (item.folderId === folderId) delete item.folderId;
  });
  await saveContentJson();
  renderFoldersList();
  showToast('تم حذف المجلد', 'success');
}

// ===== Manage Modal =====
function openManageModal(type) {
  editingSection = null;
  editingFolder = null;
  document.getElementById('manage-name').value = '';
  document.getElementById('manage-icon').value = '';
  document.getElementById('manage-modal-overlay').classList.add('active');

  if (type === 'section') {
    document.getElementById('manage-modal-title').textContent = 'إضافة قسم جديد';
    document.getElementById('manage-icon-group').style.display = 'block';
    document.getElementById('manage-type-group').style.display = 'block';
  } else {
    document.getElementById('manage-modal-title').textContent = 'إضافة مجلد جديد';
    document.getElementById('manage-icon-group').style.display = 'none';
    document.getElementById('manage-type-group').style.display = 'none';
  }
}

function closeManageModal() {
  document.getElementById('manage-modal-overlay').classList.remove('active');
  editingSection = null;
  editingFolder = null;
}

async function saveManageItem() {
  const name = document.getElementById('manage-name').value.trim();
  if (!name) {
    showToast('الرجاء إدخال الاسم', 'error');
    return;
  }

  try {
    if (editingSection !== null) {
      // Edit section
      const sec = repoContent.sections[editingSection];
      sec.name = name;
      sec.icon = document.getElementById('manage-icon').value.trim() || sec.icon;
    } else if (editingFolder !== null) {
      // Edit folder
      const section = repoContent.sections?.find(s => s.id === editingFolder.sectionId);
      section.folders[editingFolder.index].name = name;
    } else if (document.getElementById('manage-icon-group').style.display !== 'none') {
      // Add new section
      const icon = document.getElementById('manage-icon').value.trim() || '📁';
      const type = document.getElementById('manage-type').value;
      const id = 'section_' + Date.now();
      repoContent.sections.push({
        id: id,
        name: name,
        icon: icon,
        folders: [],
        items: [],
        defaultType: type
      });
    } else {
      // Add new folder
      const section = repoContent.sections?.find(s => s.id === currentFolderSection);
      if (!section.folders) section.folders = [];
      section.folders.push({
        id: 'folder_' + Date.now(),
        name: name
      });
    }

    await saveContentJson();
    closeManageModal();
    updateSectionSelects();

    if (currentAdminTab === 'sections') renderSectionsList();
    if (currentAdminTab === 'folders') renderFoldersList();
    showToast('تم الحفظ بنجاح', 'success');
  } catch (err) {
    console.error(err);
    showToast('خطأ في الحفظ: ' + err.message, 'error');
  }
}

// ===== File Upload =====
function handleFileDrop(e) {
  e.preventDefault();
  document.getElementById('upload-area').classList.remove('dragover');
  const files = Array.from(e.dataTransfer.files);
  processFiles(files);
}

function handleFileSelect(e) {
  const files = Array.from(e.target.files);
  processFiles(files);
}

function processFiles(files) {
  uploadFiles = files;
  if (files.length > 0) {
    openUploadModal(files[0]);
  }
}

function openUploadModal(file) {
  const modal = document.getElementById('modal-overlay');
  const section = repoContent.sections?.find(s => s.id === currentContentSection);
  document.getElementById('modal-title').textContent = 'إضافة ' + (section?.name || 'محتوى');
  document.getElementById('item-title').value = '';
  document.getElementById('item-desc').value = '';

  // Update folder select in modal
  const folderSelect = document.getElementById('item-folder-select');
  folderSelect.innerHTML = '<option value="">بدون مجلد</option>';
  (section?.folders || []).forEach(folder => {
    const opt = document.createElement('option');
    opt.value = folder.id;
    opt.textContent = folder.name;
    folderSelect.appendChild(opt);
  });
  document.getElementById('folder-select-group').style.display = 'block';

  const preview = document.getElementById('modal-preview');
  const url = URL.createObjectURL(file);

  if (file.type.startsWith('image/')) {
    preview.innerHTML = `<img src="${url}" style="max-width:100%;max-height:200px;border-radius:12px;">`;
  } else if (file.type.startsWith('video/')) {
    preview.innerHTML = `<video src="${url}" controls style="max-width:100%;max-height:200px;border-radius:12px;"></video>`;
  } else if (file.type.startsWith('audio/')) {
    preview.innerHTML = `<audio src="${url}" controls style="width:100%;"></audio>`;
  }

  modal.classList.add('active');
}

async function saveItem() {
  const title = document.getElementById('item-title').value.trim();
  const description = document.getElementById('item-desc').value.trim();
  const folderId = document.getElementById('item-folder-select')?.value || '';

  if (!title) {
    showToast('العنوان مطلوب', 'error');
    return;
  }

  showToast('جاري الحفظ...', 'info');

  try {
    if (uploadFiles.length > 0) {
      const file = uploadFiles[0];
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
          folderId: folderId || undefined,
          url: fileUrl,
          type: currentContentSection === 'images' ? 'image' : currentContentSection === 'videos' ? 'video' : 'audio'
        };

        if (currentContentSection === 'images') {
          newItem.thumbnail = fileUrl;
        } else if (currentContentSection === 'videos') {
          newItem.thumbnail = fileUrl;
        } else {
          newItem.cover = fileUrl;
          newItem.duration = '--:--';
        }

        const section = repoContent.sections?.find(s => s.id === currentContentSection);
        if (!section.items) section.items = [];
        section.items.push(newItem);
        await saveContentJson();

        closeModal();
        loadContentTab(currentContentSection);
        showToast('تم الرفع بنجاح!', 'success');
      };
    } else {
      const url = prompt('أدخل رابط المحتوى:');
      if (!url) return;

      const newItem = {
        id: Date.now(),
        title: title,
        description: description,
        folderId: folderId || undefined,
        url: url,
        type: currentContentSection === 'images' ? 'image' : currentContentSection === 'videos' ? 'video' : 'audio'
      };

      if (currentContentSection === 'images') {
        newItem.thumbnail = url;
      } else if (currentContentSection === 'videos') {
        newItem.thumbnail = url;
      } else {
        newItem.cover = url;
        newItem.duration = '--:--';
      }

      const section = repoContent.sections?.find(s => s.id === currentContentSection);
      if (!section.items) section.items = [];
      section.items.push(newItem);
      await saveContentJson();

      closeModal();
      loadContentTab(currentContentSection);
      showToast('تم الإضافة بنجاح!', 'success');
    }
  } catch (err) {
    console.error(err);
    showToast('خطأ في الحفظ: ' + err.message, 'error');
  }
}

async function deleteItem(index, type, folderId) {
  if (!confirm('هل أنت متأكد من حذف هذا العنصر؟')) return;

  const section = repoContent.sections?.find(s => s.id === type);
  let items = section?.items || [];
  if (folderId) {
    items = items.filter(i => i.folderId === folderId);
  }
  const item = items[index];
  const realIndex = section.items.findIndex(i => i.id === item.id);

  section.items.splice(realIndex, 1);
  await saveContentJson();
  loadContentTab(type);
  showToast('تم الحذف', 'success');
}

async function saveContentJson() {
  const content = btoa(unescape(encodeURIComponent(JSON.stringify(repoContent, null, 2))));

  let sha = null;
  try {
    const data = await githubApi('/contents/content.json');
    sha = data.sha;
  } catch (e) {}

  const body = {
    message: 'Update content.json via admin panel',
    content: content,
    branch: BRANCH
  };
  if (sha) body.sha = sha;

  await githubApi('/contents/content.json', 'PUT', body);
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('active');
  uploadFiles = [];
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
  if (!toast) return;
  toast.textContent = message;
  toast.className = 'toast ' + type;
  toast.classList.add('active');
  setTimeout(() => toast.classList.remove('active'), 3000);
}
