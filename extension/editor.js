/* 职聘通·网申助手 — 全页画像编辑器 v2.2
 * 功能：
 * 1. 从 chrome.storage.local 加载/保存画像
 * 2. 结构化表单双向绑定（输入即更新）
 * 3. 动态数组行（实习/校园/获奖/项目/论文/志愿/家庭）
 * 4. 从网站导入（注入读取 localStorage）
 * 5. JSON 导入/导出
 * 6. 侧边栏滚动联动
 * 7. 自动保存提示
 */

const LS_KEY = 'jh.profile.v2';
const STORAGE_KEY = 'profile';
const SYNC_KEY = 'syncedAt';

/* ========== 工具 ========== */
function $(sel) { return document.querySelector(sel); }
function $$(sel) { return document.querySelectorAll(sel); }
function showToast(msg, kind) {
  const el = $('#save-toast');
  el.className = 'toast ' + (kind || 'ok');
  el.textContent = msg;
  el.hidden = false;
  setTimeout(() => { el.hidden = true; }, 2500);
}
function getStorage() {
  return new Promise(res => chrome.storage.local.get([STORAGE_KEY, SYNC_KEY], res));
}
function setStorage(data) {
  return new Promise(res => chrome.storage.local.set(data, res));
}
function getActiveTab() {
  return new Promise(res => chrome.tabs.query({ active: true, currentWindow: true }, t => res(t && t[0])));
}

/* ========== 画像加载 ========== */
let currentProfile = {};
let isDirty = false;

async function loadProfile() {
  const { profile, syncedAt } = await getStorage();
  currentProfile = profile || {};
  renderForm(currentProfile);
  updateSaveStatus(false);
  if (syncedAt) {
    // 仅展示
  }
}

/* ========== 表单渲染 ========== */
function renderForm(profile) {
  // 简单字段：遍历所有 [data-key] 元素
  $$('[data-key]').forEach(el => {
    const key = el.dataset.key;
    let val = profile[key];
    if (Array.isArray(val)) val = val.join('、');
    if (val === undefined || val === null) val = '';
    el.value = val;
  });

  // 动态数组
  const arrays = ['experiences', 'campus', 'awards', 'projects', 'papers', 'volunteer', 'family'];
  arrays.forEach(key => {
    const arr = Array.isArray(profile[key]) ? profile[key] : [];
    const container = $('#rows-' + key);
    if (!container) return;
    container.innerHTML = '';
    if (arr.length === 0) {
      addRow(key); // 至少一行空行
    } else {
      arr.forEach(item => addRow(key, item));
    }
  });
}

/* ========== 动态行管理 ========== */
function addRow(arrayKey, data) {
  const container = $('#rows-' + arrayKey);
  const tpl = $('#tpl-' + arrayKey);
  if (!container || !tpl) return;

  const clone = tpl.content.cloneNode(true);
  const row = clone.querySelector('.exp-row');
  container.appendChild(row);

  // 填充已有数据
  if (data && typeof data === 'object') {
    row.querySelectorAll('[data-field]').forEach(el => {
      const f = el.dataset.field;
      el.value = data[f] || '';
    });
  }

  // 监听输入
  row.querySelectorAll('input, textarea').forEach(el => {
    el.addEventListener('input', () => { isDirty = true; updateSaveStatus(true); });
  });

  return row;
}

function removeRow(btn) {
  const row = btn.closest('.exp-row');
  const container = row.parentElement;
  row.remove();
  // 如果删到 0 行，补一行空行
  if (container.children.length === 0) {
    const key = container.closest('[data-array-key]').dataset.arrayKey;
    addRow(key);
  }
  isDirty = true;
  updateSaveStatus(true);
}

/* ========== 从表单收集画像 ========== */
function collectProfile() {
  const p = {};

  // 简单字段
  $$('[data-key]').forEach(el => {
    const key = el.dataset.key;
    let val = el.value.trim();
    // certs/skills 是逗号分隔 → 数组
    if ((key === 'certs' || key === 'skills') && val) {
      p[key] = val.split(/[,，、]/).map(s => s.trim()).filter(Boolean);
    } else {
      p[key] = val;
    }
  });

  // 动态数组
  const arrays = ['experiences', 'campus', 'awards', 'projects', 'papers', 'volunteer', 'family'];
  arrays.forEach(key => {
    const container = $('#rows-' + key);
    if (!container) return;
    const rows = container.querySelectorAll('.exp-row');
    const arr = [];
    rows.forEach(row => {
      const obj = {};
      let hasValue = false;
      row.querySelectorAll('[data-field]').forEach(el => {
        const f = el.dataset.field;
        const v = el.value.trim();
        obj[f] = v;
        if (v) hasValue = true;
      });
      if (hasValue) arr.push(obj);
    });
    p[key] = arr;
  });

  return p;
}

/* ========== 保存 ========== */
async function saveProfile() {
  const p = collectProfile();
  await setStorage({ [STORAGE_KEY]: p, [SYNC_KEY]: Date.now() });
  currentProfile = p;
  isDirty = false;
  updateSaveStatus(false);
  showToast('画像已保存', 'ok');
}

function updateSaveStatus(dirty) {
  const el = $('#save-status');
  if (dirty) {
    el.textContent = '● 未保存';
    el.className = 'save-status unsaved';
  } else {
    el.textContent = '✓ 已保存 ' + new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    el.className = 'save-status saved';
  }
}

/* ========== 从网站导入 ========== */
async function importFromSite() {
  const tab = await getActiveTab();
  if (!tab || !/^https?:/.test(tab.url || '')) {
    showToast('请先打开职聘通网站页面', 'warn');
    return;
  }
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (key) => {
        try {
          const raw = localStorage.getItem(key);
          if (!raw) return null;
          const p = JSON.parse(raw);
          return p && p.name ? p : null;
        } catch (e) { return null; }
      },
      args: [LS_KEY],
    });
    if (!result) {
      showToast('当前页面未找到职聘通画像', 'warn');
      return;
    }
    // 合并：网站数据覆盖当前表单
    currentProfile = { ...currentProfile, ...result };
    renderForm(currentProfile);
    isDirty = true;
    updateSaveStatus(true);
    showToast('已从网站导入画像：' + (result.name || '') + '（点击保存生效）', 'ok');
  } catch (e) {
    showToast('导入失败：' + (e.message || e), 'err');
  }
}

/* ========== JSON 导入/导出 ========== */
function openImportDialog() {
  $('#dlg-import').showModal();
  $('#import-area').value = '';
}
function doImport() {
  try {
    const raw = $('#import-area').value.trim();
    if (!raw) { showToast('请粘贴 JSON 文本', 'warn'); return; }
    const p = JSON.parse(raw);
    currentProfile = p;
    renderForm(p);
    isDirty = true;
    updateSaveStatus(true);
    $('#dlg-import').close();
    showToast('JSON 已导入（点击保存生效）', 'ok');
  } catch (e) {
    showToast('JSON 解析失败：' + (e.message || e), 'err');
  }
}
function openExportDialog() {
  const p = collectProfile();
  const json = JSON.stringify(p, null, 2);
  $('#export-area').value = json;
  $('#dlg-export').showModal();
}
function copyJSON() {
  const text = $('#export-area').value;
  navigator.clipboard.writeText(text).then(() => showToast('已复制到剪贴板', 'ok'));
}
function downloadJSON() {
  const p = collectProfile();
  const blob = new Blob([JSON.stringify(p, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'profile.json';
  a.click();
  URL.revokeObjectURL(url);
  showToast('文件已下载', 'ok');
}

/* ========== 清空 ========== */
function resetProfile() {
  if (!confirm('确定清空所有画像数据？此操作不可撤销。')) return;
  currentProfile = {};
  renderForm({});
  isDirty = true;
  updateSaveStatus(true);
  showToast('已清空（点击保存生效）', 'warn');
}

/* ========== 侧边栏滚动联动 ========== */
function setupScrollSpy() {
  const links = $$('.sidenav a');
  const sections = $$('.form-section');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const id = entry.target.id;
        links.forEach(l => l.classList.toggle('active', l.getAttribute('href') === '#' + id));
      }
    });
  }, { rootMargin: '-80px 0px -60% 0px', threshold: 0 });
  sections.forEach(s => observer.observe(s));

  // 点击导航
  links.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const target = $(link.getAttribute('href'));
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

/* ========== 自动保存提示 ========== */
function setupDirtyTracking() {
  document.addEventListener('input', (e) => {
    if (e.target.matches('[data-key], [data-field]')) {
      isDirty = true;
      updateSaveStatus(true);
    }
  });
  // 离开前提示
  window.addEventListener('beforeunload', (e) => {
    if (isDirty) {
      e.preventDefault();
      e.returnValue = '';
    }
  });
}

/* ========== 初始化 ========== */
document.addEventListener('DOMContentLoaded', async () => {
  await loadProfile();
  setupScrollSpy();
  setupDirtyTracking();

  $('#btn-save').addEventListener('click', saveProfile);
  $('#btn-save-2').addEventListener('click', saveProfile);
  $('#btn-import-site').addEventListener('click', importFromSite);
  $('#btn-import-json').addEventListener('click', openImportDialog);
  $('#btn-do-import').addEventListener('click', doImport);
  $('#btn-export-json').addEventListener('click', openExportDialog);
  $('#btn-copy-json').addEventListener('click', copyJSON);
  $('#btn-download-json').addEventListener('click', downloadJSON);
  $('#btn-reset').addEventListener('click', resetProfile);

  // 如果画像为空（首次使用），自动填充示例数据
  if (!currentProfile.name) {
    try {
      const resp = await fetch(chrome.runtime.getURL('profile.example.json'));
      if (resp.ok) {
        const example = await resp.json();
        // 去掉 _comment 字段
        delete example._comment;
        currentProfile = example;
        renderForm(example);
        isDirty = true;
        updateSaveStatus(true);
        showToast('首次使用已加载示例画像，请修改后保存', 'ok');
      }
    } catch (_) { /* 静默失败 */ }
  }
});
