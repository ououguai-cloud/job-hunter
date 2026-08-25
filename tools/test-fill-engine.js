/* 网申助手填表引擎 — jsdom 单元测试
 * 构造模拟企业网申表单 → 注入 fill-engine.js → 调用 FILL_FUNCTION(profile) → 断言填写结果
 * 运行：node tools/test-fill-engine.js （需先 npm install jsdom --no-save）
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ENGINE_SRC = fs.readFileSync(path.join(__dirname, '..', 'extension', 'fill-engine.js'), 'utf8');

const PROFILE = {
  name: '张三', gender: '男', birth: '2002.05', hometown: '浙江杭州',
  phone: '13800138000', email: 'zhangsan@example.com', wechat: 'zs_wechat',
  idcard: '3301xxxxxxxxxxxxxx', school: '浙江大学', major: '计算机科学与技术',
  degree: '本科', gradYear: '2025', gradTime: '2025.06', city: '杭州',
  preferCity: ['杭州', '上海'], target: ['前端工程师', 'Java开发'],
  english: 'CET-6', skills: ['JavaScript', 'Python', 'React'],
  expSalary: '15-20K', selfIntro: '热爱编程，三年项目经验。',
  experiences: [{ org: '阿里', role: '前端实习生', time: '2024.06-2024.09', desc: '负责中后台开发' }],
};

// 一份典型的企业网申表单 HTML
const FORM_HTML = `<!DOCTYPE html><html><body>
<form>
  <div class="form-item"><label>姓名 *</label><input type="text" name="userName" placeholder="请输入姓名"></div>
  <div class="form-item"><label>性别</label>
    <label><input type="radio" name="gender" value="男"> 男</label>
    <label><input type="radio" name="gender" value="女"> 女</label>
  </div>
  <div class="form-item"><label>出生日期</label><input type="text" name="birthday"></div>
  <div class="form-item"><label>籍贯</label><input type="text" name="native"></div>
  <div class="form-item"><label>手机号码</label><input type="tel" name="mobile"></div>
  <div class="form-item"><label>电子邮箱</label><input type="email" name="emailAddr"></div>
  <div class="form-item"><label>微信号</label><input type="text" name="wechatNo"></div>
  <div class="form-item"><label>身份证号</label><input type="text" name="idCard"></div>
  <div class="form-item"><label>毕业院校</label><input type="text" name="schoolName"></div>
  <div class="form-item"><label>所学专业</label><input type="text" name="majorName"></div>
  <div class="form-item"><label>学历</label>
    <select name="degree"><option value="">请选择</option><option value="大专">大专</option><option value="本科">本科</option><option value="硕士">硕士</option></select>
  </div>
  <div class="form-item"><label>毕业年份</label><input type="text" name="gradYear"></div>
  <div class="form-item"><label>现居城市</label><input type="text" name="city"></div>
  <div class="form-item"><label>期望工作地</label><input type="text" name="preferCity"></div>
  <div class="form-item"><label>英语等级</label><input type="text" name="englishLevel"></div>
  <div class="form-item"><label>期望月薪</label><input type="text" name="salary"></div>
  <div class="form-item"><label>自我评价</label><textarea name="selfIntro" rows="4"></textarea></div>
  <div class="form-item"><label>实习经历</label><textarea name="experience" rows="4"></textarea></div>
  <div class="form-item"><label>图形验证码</label><input type="text" name="captcha"><img src="captcha.png"></div>
  <div class="form-item"><label>上传简历</label><input type="file" name="resume"></div>
  <div class="form-item"><label><input type="checkbox" name="agree"> 我已阅读并同意招聘协议</label></div>
  <button type="submit">提交申请</button>
</form></body></html>`;

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name} ${extra || ''}`); }
}

const dom = new JSDOM(FORM_HTML, { runScripts: 'outside-only', pretendToBeVisual: true });
// jsdom 不做布局，getBoundingClientRect 恒返回 0x0 → 引擎的可见性检查会过滤掉所有元素。
// 打桩布局相关 API 以还原真实浏览器行为（可见性逻辑本身仍被覆盖）。
const RECT = { x: 1, y: 1, width: 120, height: 24, top: 1, left: 1, right: 121, bottom: 25, toJSON() { return this; } };
dom.window.Element.prototype.getBoundingClientRect = function () { return RECT; };
dom.window.getComputedStyle = function () { return { visibility: 'visible', display: 'block' }; };
dom.window.eval(ENGINE_SRC); // 定义 window.FILL_FUNCTION
const win = dom.window;
const doc = win.document;
const res = win.FILL_FUNCTION(PROFILE);

console.log(`\n填写结果: 填${res.filled} 跳${res.skipped} 未识别${res.unmatched} 验证码${res.captcha} 文件${res.file}`);
console.log(`未识别字段: ${(res.unmatchedLabels || []).join('、') || '无'}\n`);

// 断言
ok('姓名已填', doc.querySelector('[name=userName]').value === '张三', `实际: ${doc.querySelector('[name=userName]').value}`);
ok('手机号已填', doc.querySelector('[name=mobile]').value === '13800138000');
ok('邮箱已填', doc.querySelector('[name=emailAddr]').value === 'zhangsan@example.com');
ok('微信已填', doc.querySelector('[name=wechatNo]').value === 'zs_wechat');
ok('身份证已填', doc.querySelector('[name=idCard]').value === '3301xxxxxxxxxxxxxx');
ok('学校已填', doc.querySelector('[name=schoolName]').value === '浙江大学');
ok('专业已填', doc.querySelector('[name=majorName]').value === '计算机科学与技术');
ok('学历 select 选中本科', doc.querySelector('[name=degree]').value === '本科', `实际: ${doc.querySelector('[name=degree]').value}`);
ok('出生日期已填', doc.querySelector('[name=birthday]').value === '2002.05');
ok('籍贯已填', doc.querySelector('[name=native]').value === '浙江杭州');
ok('毕业年份已填', doc.querySelector('[name=gradYear]').value === '2025');
ok('现居城市已填', doc.querySelector('[name=city]').value === '杭州');
ok('期望工作地已填(数组join)', doc.querySelector('[name=preferCity]').value === '杭州、上海');
ok('英语等级已填', doc.querySelector('[name=englishLevel]').value === 'CET-6');
ok('期望月薪已填', doc.querySelector('[name=salary]').value === '15-20K');
ok('自我评价已填', doc.querySelector('[name=selfIntro]').value === '热爱编程，三年项目经验。');
ok('实习经历已填', doc.querySelector('[name=experience]').value.includes('阿里'));
ok('性别 radio 男 已选中', doc.querySelector('[name=gender][value=男]').checked, `实际checked: ${doc.querySelector('[name=gender][value=男]').checked}`);
ok('性别 radio 女 未选中', !doc.querySelector('[name=gender][value=女]').checked);
ok('同意条款 checkbox 已勾选', doc.querySelector('[name=agree]').checked);
ok('验证码计入captcha', res.captcha === 1);
ok('简历上传计入file', res.file === 1);
ok('filled >= 18', res.filled >= 18, `实际: ${res.filled}`);

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);
