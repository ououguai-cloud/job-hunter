/* v2.4 专项测试：空缺项自动填「无」策略 */
const { JSDOM } = require('jsdom');

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
  url: 'https://example.com/apply',
  pretendToBeVisual: true,
});
global.window = dom.window;
global.document = dom.window.document;
global.Event = dom.window.Event;
global.HTMLInputElement = dom.window.HTMLInputElement;
global.HTMLTextAreaElement = dom.window.HTMLTextAreaElement;
global.HTMLElement = dom.window.HTMLElement;

// jsdom 布局 API 返回 0 → stub 掉可见性检查
const origGetBCR = dom.window.HTMLElement.prototype.getBoundingClientRect;
dom.window.HTMLElement.prototype.getBoundingClientRect = function () {
  if (this.__forceVisible) return { width: 200, height: 30 };
  return origGetBCR.call(this);
};
global.getComputedStyle = function () { return { visibility: 'visible', display: 'block' }; };

const { FILL_FUNCTION } = require('../extension/fill-engine.js');

let pass = 0, fail = 0;
function check(name, cond) {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name}`); }
}

function build(html) {
  document.body.innerHTML = html;
  document.querySelectorAll('input,select,textarea').forEach(el => (el.__forceVisible = true));
}

/* ---------- 场景 1：画像为空 + 开启填无 → 文本框填「无」 ---------- */
build(`
  <form>
    <div><label>获奖经历</label><textarea name="award"></textarea></div>
    <div><label>实习经历</label><textarea name="intern"></textarea></div>
    <div><label>英语水平</label><input name="english"></div>
    <div><label>证书</label><input name="cert"></div>
  </form>
`);
let r = FILL_FUNCTION({}, { fillNoneWhenEmpty: true });
check('场景1 获奖经历填「无」', document.querySelector('[name=award]').value === '无');
check('场景1 实习经历填「无」', document.querySelector('[name=intern]').value === '无');
check('场景1 英语水平填「无」', document.querySelector('[name=english]').value === '无');
check('场景1 证书填「无」', document.querySelector('[name=cert]').value === '无');
check('场景1 filledNone 计数 = 4', r.filledNone === 4);
check('场景1 skipped = 0', r.skipped === 0);

/* ---------- 场景 2：画像为空 + 关闭填无 → 跳过（旧行为不变） ---------- */
build(`
  <form>
    <div><label>获奖经历</label><textarea name="award"></textarea></div>
  </form>
`);
r = FILL_FUNCTION({}, { fillNoneWhenEmpty: false });
check('场景2 关闭填无时不填（跳过）', document.querySelector('[name=award]').value === '');
check('场景2 skipped = 1', r.skipped === 1);
r = FILL_FUNCTION({});
check('场景2 不传 opts 默认跳过（兼容旧调用）', document.querySelector('[name=award]').value === '');

/* ---------- 场景 3：页面是下拉框 → 选页面的「无」选项 ---------- */
build(`
  <form>
    <div><label>英语水平</label>
      <select name="english">
        <option value="">请选择</option>
        <option value="cet4">CET-4</option>
        <option value="cet6">CET-6</option>
        <option value="none">无</option>
      </select>
    </div>
    <div><label>获奖经历</label>
      <select name="award">
        <option value="">请选择</option>
        <option value="y">有</option>
        <option value="w">暂无</option>
      </select>
    </div>
  </form>
`);
r = FILL_FUNCTION({}, { fillNoneWhenEmpty: true });
check('场景3 英语下拉选中「无」', document.querySelector('[name=english]').value === 'none');
check('场景3 获奖下拉选中「暂无」(无选项兜底词)', document.querySelector('[name=award]').value === 'w');
check('场景3 filledNone = 2', r.filledNone === 2);

/* ---------- 场景 4：页面下拉框没有「无」选项 → 跳过不强填 ---------- */
build(`
  <form>
    <div><label>英语水平</label>
      <select name="english">
        <option value="">请选择</option>
        <option value="cet4">CET-4</option>
        <option value="cet6">CET-6</option>
      </select>
    </div>
  </form>
`);
r = FILL_FUNCTION({}, { fillNoneWhenEmpty: true });
check('场景4 下拉无「无」选项时保持默认（不强选）', document.querySelector('[name=english]').value === '');
check('场景4 计入 skipped', r.skipped === 1);

/* ---------- 场景 5：关键信息字段（姓名/手机）不填「无」 ---------- */
build(`
  <form>
    <div><label>姓名</label><input name="name"></div>
    <div><label>手机号</label><input name="phone"></div>
  </form>
`);
r = FILL_FUNCTION({}, { fillNoneWhenEmpty: true });
check('场景5 姓名不填「无」（留空待用户补）', document.querySelector('[name=name]').value === '');
check('场景5 手机号不填「无」', document.querySelector('[name=phone]').value === '');

/* ---------- 场景 6：画像有值时正常填（填无不影响正常路径） ---------- */
build(`
  <form>
    <div><label>获奖经历</label><textarea name="award"></textarea></div>
    <div><label>英语水平</label><input name="english"></div>
  </form>
`);
r = FILL_FUNCTION(
  { awards: [{ name: '国家奖学金', level: '国家级', time: '2025.10' }], english: 'CET-6' },
  { fillNoneWhenEmpty: true }
);
check('场景6 有值正常填获奖', document.querySelector('[name=award]').value.includes('国家奖学金'));
check('场景6 有值正常填英语', document.querySelector('[name=english]').value === 'CET-6');
check('场景6 filledNone = 0', r.filledNone === 0);

/* ---------- 场景 7：性别 radio 空值不瞎选 ---------- */
build(`
  <form>
    <label><input type="radio" name="gender" value="m"> 男</label>
    <label><input type="radio" name="gender" value="f"> 女</label>
  </form>
`);
r = FILL_FUNCTION({}, { fillNoneWhenEmpty: true });
check('场景7 性别 radio 不瞎选', !document.querySelector('[name=gender]').checked);

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);
