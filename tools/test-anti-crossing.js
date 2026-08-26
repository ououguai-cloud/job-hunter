/* v2.3 串位修复专项测试：验证 exclude 规则生效 */
const { JSDOM } = require('jsdom');
const { FILL_FUNCTION } = require('../extension/fill-engine.js');

const dom = new JSDOM(`<!DOCTYPE html><html><body>
<form>
  <div class="form-group"><label>姓名</label><input id="f-name"></div>
  <div class="form-group"><label>手机号</label><input id="f-phone"></div>
  <div class="form-group"><label>籍贯</label><input id="f-hometown"></div>
  <div class="form-group"><label>户口所在地</label><input id="f-hukou"></div>
  <div class="form-group"><label>出生地</label><input id="f-birthplace"></div>
  <div class="form-group"><label>紧急联系人姓名</label><input id="f-em-name"></div>
  <div class="form-group"><label>紧急联系电话</label><input id="f-em-phone"></div>
  <div class="form-group"><label>高中学校</label><input id="f-hschool"></div>
  <div class="form-group"><label>毕业院校</label><input id="f-school"></div>
  <div class="form-group"><label>社区服务活动</label><textarea id="f-vol"></textarea></div>
  <div class="form-group"><label>个人简历</label><textarea id="f-intro"></textarea></div>
  <div class="form-group"><label>期望工作城市</label><input id="f-prefer"></div>
  <div class="form-group"><label>现居城市</label><input id="f-city"></div>
</form>
</body></html>`, { url: 'https://example.com/apply' });

global.window = dom.window;
global.document = dom.window.document;
global.Event = dom.window.Event;
global.HTMLInputElement = dom.window.HTMLInputElement;
global.HTMLTextAreaElement = dom.window.HTMLTextAreaElement;
global.HTMLElement = dom.window.HTMLElement;
global.getComputedStyle = dom.window.getComputedStyle;
global.document.querySelectorAll = dom.window.document.querySelectorAll.bind(dom.window.document);

// stub 布局 API（jsdom 的 getBoundingClientRect 返回 0）
for (const Tag of [dom.window.HTMLInputElement, dom.window.HTMLTextAreaElement, dom.window.HTMLSelectElement]) {
  Tag.prototype.getBoundingClientRect = function () { return { width: 200, height: 24, top: 0, left: 0 }; };
  Tag.prototype.closest = Tag.prototype.closest || function () { return null; };
}

const profile = {
  name: '张三', phone: '13800000001',
  hometown: '浙江省杭州市', hukouLocation: '浙江省杭州市西湖区',
  emergencyContact: '李四', emergencyPhone: '13900000002',
  school: '浙江大学', volunteer: [{ org: '社区服务中心', role: '志愿者', time: '2024.05', desc: '社区环保' }],
  selfIntro: '认真负责的大学生', preferCity: '杭州', city: '杭州市',
};

const r = FILL_FUNCTION(profile);
const g = id => document.getElementById(id).value;

let pass = 0, fail = 0;
function check(desc, cond) {
  if (cond) { pass++; console.log('  ✅ ' + desc); }
  else { fail++; console.log('  ❌ ' + desc); }
}

console.log(`填写结果: 填${r.filled} 跳${r.skipped} 未识别${r.unmatched}`);
console.log('未识别: ' + (r.unmatchedLabels.join(' | ') || '无'));
console.log('');

check('姓名 → 姓名栏', g('f-name') === '张三');
check('手机号 → 手机号栏（未被紧急电话吞掉）', g('f-phone') === '13800000001');
check('籍贯 → 籍贯栏', g('f-hometown') === '浙江省杭州市');
check('户口所在地 → hukouLocation（未被籍贯吞掉）', g('f-hukou') === '浙江省杭州市西湖区');
check('出生地 → 籍贯 hometown', g('f-birthplace') === '浙江省杭州市');
check('紧急联系人姓名 → emergencyContact（未被姓名吞掉）', g('f-em-name') === '李四');
check('紧急联系电话 → emergencyPhone（未被手机号吞掉）', g('f-em-phone') === '13900000002');
check('高中学校 → 不填（exclude 生效）', g('f-hschool') === '');
check('毕业院校 → 学校', g('f-school') === '浙江大学');
check('社区服务活动 → volunteer', g('f-vol').includes('社区服务中心'));
check('个人简历 → selfIntro（不再被 file 误拦）', g('f-intro') === '认真负责的大学生');
check('期望工作城市 → preferCity（不被现居城市吞掉）', g('f-prefer') === '杭州');
check('现居城市 → city', g('f-city') === '杭州市');

console.log('');
console.log(`结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail > 0 ? 1 : 0);
