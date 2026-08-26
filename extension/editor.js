/* 职聘通·网申助手 — 全页画像编辑器 v2.6
 * 功能：
 * 1. 从 chrome.storage.local 加载/保存画像
 * 2. 结构化表单双向绑定（输入即更新）
 * 3. 动态数组行（实习/科研/竞赛/校园/获奖/项目/论文/志愿/家庭），可整块删空
 * 4. 语言能力下拉（无/其他/自定义补充说明）
 * 5. 从网站导入（注入读取 localStorage）
 * 6. JSON 导入/导出
 * 7. 侧边栏滚动联动
 * 8. 自动保存提示
 * v2.6：新增科研经历/竞赛经历数组；实习经历增加离职原因/薪资/证明人字段；
 *       家庭信息独立为单独分区，增加年龄/政治面貌/联系电话字段；
 *       基本信息新增国籍/证件类型/出生地/血型/独生子女；
 *       教育背景新增班级/学号/学制/学习形式/学校层次/专业类别/录取批次/第一学历/院校所在地；
 *       联系方式新增QQ/博客/LinkedIn/GitHub/家庭电话；
 *       求职意向新增期望行业/期望职能/接受出差/接受外派
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
/* 这些 select 字段带「其他/需补充」自定义输入框 */
const CUSTOM_SELECT_KEYS = ['english', 'otherLang', 'computerLevel', 'mandarin'];

const ARRAY_NAMES = {
  experiences: '实习/工作经历',
  research: '科研经历',
  competitions: '竞赛经历',
  campus: '校园经历',
  awards: '获奖经历',
  projects: '项目经历',
  papers: '论文/著作',
  volunteer: '志愿服务经历',
  family: '家庭信息',
};

/* select 选中项需要补充说明时，显示旁边的自定义输入框 */
function syncExtVisibility(key) {
  const sel = document.querySelector(`select[data-key="${key}"]`);
  const wrap = document.querySelector(`[data-ext-wrap="${key}"]`);
  if (!sel || !wrap) return;
  const opt = sel.selectedOptions[0];
  wrap.hidden = !(opt && opt.hasAttribute('data-ext'));
}

function renderForm(profile) {
  // 简单字段：遍历所有 [data-key] 元素
  $$('[data-key]').forEach(el => {
    const key = el.dataset.key;
    let val = profile[key];
    if (Array.isArray(val)) val = val.join('、');
    if (val === undefined || val === null) val = '';

    if (el.tagName === 'SELECT' && CUSTOM_SELECT_KEYS.includes(key)) {
      const inOptions = Array.from(el.options).some(o => (o.value || o.text) === String(val));
      if (val && !inOptions) {
        // 值不在预置选项（如"雅思7.5"）→ 选「其他」，原值放自定义框
        const otherOpt = Array.from(el.options).find(o => o.text === '其他');
        if (otherOpt) el.value = otherOpt.value;
        const custom = document.querySelector(`[data-custom="${key}"]`);
        if (custom) custom.value = val;
      } else {
        el.value = val;
        const custom = document.querySelector(`[data-custom="${key}"]`);
        if (custom) custom.value = '';
      }
      syncExtVisibility(key);
    } else {
      el.value = val;
    }
  });

  // 动态数组（没有的经历整块留空，不再强制补一行）
  const arrays = ['experiences', 'research', 'competitions', 'campus', 'awards', 'projects', 'papers', 'volunteer', 'family'];
    arrays.forEach(key => {
    const arr = Array.isArray(profile[key]) ? profile[key] : [];
    const container = $('#rows-' + key);
    if (!container) return;
    container.innerHTML = '';
    if (arr.length === 0) {
      renderEmptyState(container, key);
    } else {
      arr.forEach(item => addRow(key, item));
    }
  });
}

/* 空板块占位提示 */
function renderEmptyState(container, key) {
  const div = document.createElement('div');
  div.className = 'empty-hint';
  const name = ARRAY_NAMES[key] || '内容';
  div.textContent = `暂无${name} — 没有就保持空白（填网页时会自动填「无」），点上方「+ 添加」可新增`;
  container.appendChild(div);
}

/* ========== 动态行管理 ========== */
function addRow(arrayKey, data) {
  const container = $('#rows-' + arrayKey);
  const tpl = $('#tpl-' + arrayKey);
  if (!container || !tpl) return;

  // 去掉空状态提示
  const hint = container.querySelector('.empty-hint');
  if (hint) hint.remove();

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

  // 自动聚焦第一个空输入框
  const first = row.querySelector('input');
  if (first) first.focus();

  return row;
}

function removeRow(btn) {
  const row = btn.closest('.exp-row');
  const container = row.parentElement;
  const block = container.closest('[data-array-key]');
  const key = block ? block.dataset.arrayKey : '';
  row.remove();
  // 删到 0 行：显示空状态提示，不再强制补空行
  if (container.children.length === 0) {
    renderEmptyState(container, key);
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

    // 带「其他/需补充」的 select：合并自定义输入框的值
    if (el.tagName === 'SELECT' && CUSTOM_SELECT_KEYS.includes(key)) {
      const opt = el.selectedOptions[0];
      const custom = document.querySelector(`[data-custom="${key}"]`);
      const cv = custom ? custom.value.trim() : '';
      if (opt && opt.hasAttribute('data-ext') && cv) {
        val = (opt.text === '其他') ? cv : opt.text + cv; // 雅思+7.5=雅思7.5；其他→直接用自定义值
      }
    }

    // certs/skills 是逗号分隔 → 数组
    if ((key === 'certs' || key === 'skills') && val) {
      p[key] = val.split(/[,，、]/).map(s => s.trim()).filter(Boolean);
    } else {
      p[key] = val;
    }
  });

  // 动态数组
  const arrays = ['experiences', 'research', 'competitions', 'campus', 'awards', 'projects', 'papers', 'volunteer', 'family'];
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
    if (e.target.matches('[data-key], [data-field], [data-custom]')) {
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

/* ========== 事件委托（MV3 CSP 禁止内联 onclick，统一在此绑定） ========== */
function setupDelegatedClicks() {
  document.addEventListener('click', (e) => {
    const t = e.target;
    // 添加动态行
    const addBtn = t.closest('[data-add]');
    if (addBtn) {
      addRow(addBtn.dataset.add);
      isDirty = true;
      updateSaveStatus(true);
      return;
    }
    // 删除动态行
    const delBtn = t.closest('[data-del]');
    if (delBtn) {
      removeRow(delBtn);
      return;
    }
    // 关闭对话框
    const closeBtn = t.closest('[data-close]');
    if (closeBtn) {
      const dlg = document.getElementById(closeBtn.dataset.close);
      if (dlg && typeof dlg.close === 'function') dlg.close();
    }
  });
}

/* ========== 载入示例画像（手动触发，不再自动填充） ========== */
async function loadExample() {
  try {
    const resp = await fetch(chrome.runtime.getURL('profile.example.json'));
    if (!resp.ok) return;
    const example = await resp.json();
    delete example._comment;
    currentProfile = example;
    renderForm(example);
    isDirty = true;
    updateSaveStatus(true);
    showToast('已载入示例画像，请修改后保存', 'ok');
  } catch (_) { showToast('载入示例失败', 'err'); }
}

/* ========== 初始化 ========== */
document.addEventListener('DOMContentLoaded', async () => {
  await loadProfile();
  setupScrollSpy();
  setupDirtyTracking();
  setupDelegatedClicks();

  $('#btn-save').addEventListener('click', saveProfile);
  $('#btn-save-2').addEventListener('click', saveProfile);
  $('#btn-example').addEventListener('click', loadExample);
  $('#btn-import-site').addEventListener('click', importFromSite);
  $('#btn-import-json').addEventListener('click', openImportDialog);
  $('#btn-do-import').addEventListener('click', doImport);
  $('#btn-export-json').addEventListener('click', openExportDialog);
  $('#btn-copy-json').addEventListener('click', copyJSON);
  $('#btn-download-json').addEventListener('click', downloadJSON);
  $('#btn-reset').addEventListener('click', resetProfile);

  // 语言能力 select：切换选项时联动自定义输入框
  CUSTOM_SELECT_KEYS.forEach(key => {
    const sel = document.querySelector(`select[data-key="${key}"]`);
    if (sel) {
      sel.addEventListener('change', () => {
        syncExtVisibility(key);
        isDirty = true;
        updateSaveStatus(true);
      });
    }
  });

  // 首次使用：表单留空 + 引导提示（不自动塞示例数据）
  if (!currentProfile.name) {
    showToast('表单已留空，按需填写即可；可点右上「📋 载入示例」参考格式', 'ok');
  }
});
