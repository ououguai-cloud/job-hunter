/* 网申助手填表引擎 — jsdom 单元测试 v2.6
 * 构造模拟企业网申表单 → 注入 fill-engine.js → 调用 FILL_FUNCTION(profile) → 断言填写结果
 * 运行：node tools/test-fill-engine.js （需先 npm install jsdom --no-save）
 * v2.6：新增国籍/证件类型/出生地/院系/学号/学制/学习形式/学校层次/专业类别/
 *       录取批次/QQ/博客/期望行业/期望职能/接受出差/接受外派/科研经历/竞赛经历等测试用例
 */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ENGINE_SRC = fs.readFileSync(path.join(__dirname, '..', 'extension', 'fill-engine.js'), 'utf8');

const PROFILE = {
  name: '张三', gender: '男', nationality: '中国', idType: '身份证',
  birth: '2002.05', birthplace: '浙江杭州', hometown: '浙江杭州',
  phone: '13800138000', homePhone: '0571-87654321', email: 'zhangsan@example.com',
  wechat: 'zs_wechat', qq: '12345678', blog: 'https://zhangsan.dev',
  idcard: '3301xxxxxxxxxxxxxx', school: '浙江大学', department: '计算机学院',
  major: '计算机科学与技术', majorCategory: '工学', class: 'CS2101', studentId: '2021xxxx',
  degree: '本科', isFirstDegree: '是', schoolLevel: '双一流', schoolLocation: '浙江省杭州市',
  eduDuration: '四年', eduMode: '全日制', admissionBatch: '一本',
  gradYear: '2025', gradTime: '2025.06', city: '杭州',
  preferCity: ['杭州', '上海'], preferIndustry: '互联网/IT', preferFunction: '研发',
  target: ['前端工程师', 'Java开发'],
  english: 'CET-6', skills: ['JavaScript', 'Python', 'React'],
  expSalary: '15-20K', selfIntro: '热爱编程，三年项目经验。',
  acceptTravel: '接受', acceptRelocate: '接受',
  experiences: [{ org: '阿里', role: '前端实习生', time: '2024.06-2024.09', desc: '负责中后台开发', salary: '300元/天', reason: '实习结束', referee: '李经理', refereePhone: '13900000000' }],
  research: [{ name: '智能问答系统', role: '核心成员', time: '2024.03-2024.09', desc: '基于大模型构建问答系统' }],
  competitions: [{ name: '数学建模竞赛', level: '国家级', award: '一等奖', time: '2024.09' }],
};

// 一份典型的企业网申表单 HTML（含 v2.6 新增字段）
const FORM_HTML = `<!DOCTYPE html><html><body>
<form>
  <div class="form-item"><label>姓名 *</label><input type="text" name="userName" placeholder="请输入姓名"></div>
  <div class="form-item"><label>性别</label>
    <label><input type="radio" name="gender" value="男"> 男</label>
    <label><input type="radio" name="gender" value="女"> 女</label>
  </div>
  <div class="form-item"><label>国籍</label><input type="text" name="nationality"></div>
  <div class="form-item"><label>证件类型</label>
    <select name="idType"><option value="">请选择</option><option value="身份证">身份证</option><option value="护照">护照</option></select>
  </div>
  <div class="form-item"><label>出生日期</label><input type="text" name="birthday"></div>
  <div class="form-item"><label>出生地</label><input type="text" name="birthplace"></div>
  <div class="form-item"><label>籍贯</label><input type="text" name="native"></div>
  <div class="form-item"><label>手机号码</label><input type="tel" name="mobile"></div>
  <div class="form-item"><label>家庭电话</label><input type="text" name="homePhone"></div>
  <div class="form-item"><label>电子邮箱</label><input type="email" name="emailAddr"></div>
  <div class="form-item"><label>微信号</label><input type="text" name="wechatNo"></div>
  <div class="form-item"><label>QQ号</label><input type="text" name="qqNo"></div>
  <div class="form-item"><label>个人主页</label><input type="text" name="blogUrl"></div>
  <div class="form-item"><label>身份证号</label><input type="text" name="idCard"></div>
  <div class="form-item"><label>毕业院校</label><input type="text" name="schoolName"></div>
  <div class="form-item"><label>院系</label><input type="text" name="department"></div>
  <div class="form-item"><label>所学专业</label><input type="text" name="majorName"></div>
  <div class="form-item"><label>专业类别</label>
    <select name="majorCat"><option value="">请选择</option><option value="工学">工学</option><option value="理学">理学</option></select>
  </div>
  <div class="form-item"><label>班级</label><input type="text" name="className"></div>
  <div class="form-item"><label>学号</label><input type="text" name="studentId"></div>
  <div class="form-item"><label>学历</label>
    <select name="degree"><option value="">请选择</option><option value="大专">大专</option><option value="本科">本科</option><option value="硕士">硕士</option></select>
  </div>
  <div class="form-item"><label>是否第一学历</label>
    <select name="firstDegree"><option value="">请选择</option><option value="是">是</option><option value="否">否</option></select>
  </div>
  <div class="form-item"><label>学校层次</label>
    <select name="schoolLevel"><option value="">请选择</option><option value="985">985</option><option value="双一流">双一流</option><option value="211">211</option></select>
  </div>
  <div class="form-item"><label>院校所在地</label><input type="text" name="schoolLoc"></div>
  <div class="form-item"><label>学制</label>
    <select name="eduDur"><option value="">请选择</option><option value="四年">四年</option><option value="三年">三年</option></select>
  </div>
  <div class="form-item"><label>学习形式</label>
    <select name="eduMode"><option value="">请选择</option><option value="全日制">全日制</option><option value="非全日制">非全日制</option></select>
  </div>
  <div class="form-item"><label>录取批次</label>
    <select name="admBatch"><option value="">请选择</option><option value="一本">一本</option><option value="二本">二本</option></select>
  </div>
  <div class="form-item"><label>毕业年份</label><input type="text" name="gradYear"></div>
  <div class="form-item"><label>现居城市</label><input type="text" name="city"></div>
  <div class="form-item"><label>期望工作地</label><input type="text" name="preferCity"></div>
  <div class="form-item"><label>期望行业</label><input type="text" name="preferIndustry"></div>
  <div class="form-item"><label>期望职能</label><input type="text" name="preferFunction"></div>
  <div class="form-item"><label>英语等级</label><input type="text" name="englishLevel"></div>
  <div class="form-item"><label>期望月薪</label><input type="text" name="salary"></div>
  <div class="form-item"><label>接受出差</label>
    <select name="acceptTravel"><option value="">请选择</option><option value="接受">接受</option><option value="不接受">不接受</option></select>
  </div>
  <div class="form-item"><label>接受外派</label>
    <select name="acceptRelocate"><option value="">请选择</option><option value="接受">接受</option><option value="不接受">不接受</option></select>
  </div>
  <div class="form-item"><label>自我评价</label><textarea name="selfIntro" rows="4"></textarea></div>
  <div class="form-item"><label>实习经历</label><textarea name="experience" rows="4"></textarea></div>
  <div class="form-item"><label>科研经历</label><textarea name="research" rows="4"></textarea></div>
  <div class="form-item"><label>竞赛经历</label><textarea name="competition" rows="4"></textarea></div>
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

// ========== 原有断言 ==========
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

// ========== v2.6 新增断言 ==========
ok('国籍已填', doc.querySelector('[name=nationality]').value === '中国', `实际: ${doc.querySelector('[name=nationality]').value}`);
ok('证件类型 select 选中身份证', doc.querySelector('[name=idType]').value === '身份证', `实际: ${doc.querySelector('[name=idType]').value}`);
ok('出生地已填', doc.querySelector('[name=birthplace]').value === '浙江杭州', `实际: ${doc.querySelector('[name=birthplace]').value}`);
ok('家庭电话已填', doc.querySelector('[name=homePhone]').value === '0571-87654321', `实际: ${doc.querySelector('[name=homePhone]').value}`);
ok('QQ号已填', doc.querySelector('[name=qqNo]').value === '12345678', `实际: ${doc.querySelector('[name=qqNo]').value}`);
ok('个人主页已填', doc.querySelector('[name=blogUrl]').value === 'https://zhangsan.dev', `实际: ${doc.querySelector('[name=blogUrl]').value}`);
ok('院系已填', doc.querySelector('[name=department]').value === '计算机学院', `实际: ${doc.querySelector('[name=department]').value}`);
ok('专业类别 select 选中工学', doc.querySelector('[name=majorCat]').value === '工学', `实际: ${doc.querySelector('[name=majorCat]').value}`);
ok('班级已填', doc.querySelector('[name=className]').value === 'CS2101', `实际: ${doc.querySelector('[name=className]').value}`);
ok('学号已填', doc.querySelector('[name=studentId]').value === '2021xxxx', `实际: ${doc.querySelector('[name=studentId]').value}`);
ok('是否第一学历 select 选中是', doc.querySelector('[name=firstDegree]').value === '是', `实际: ${doc.querySelector('[name=firstDegree]').value}`);
ok('学校层次 select 选中双一流', doc.querySelector('[name=schoolLevel]').value === '双一流', `实际: ${doc.querySelector('[name=schoolLevel]').value}`);
ok('院校所在地已填', doc.querySelector('[name=schoolLoc]').value === '浙江省杭州市', `实际: ${doc.querySelector('[name=schoolLoc]').value}`);
ok('学制 select 选中四年', doc.querySelector('[name=eduDur]').value === '四年', `实际: ${doc.querySelector('[name=eduDur]').value}`);
ok('学习形式 select 选中全日制', doc.querySelector('[name=eduMode]').value === '全日制', `实际: ${doc.querySelector('[name=eduMode]').value}`);
ok('录取批次 select 选中一本', doc.querySelector('[name=admBatch]').value === '一本', `实际: ${doc.querySelector('[name=admBatch]').value}`);
ok('期望行业已填', doc.querySelector('[name=preferIndustry]').value === '互联网/IT', `实际: ${doc.querySelector('[name=preferIndustry]').value}`);
ok('期望职能已填', doc.querySelector('[name=preferFunction]').value === '研发', `实际: ${doc.querySelector('[name=preferFunction]').value}`);
ok('接受出差 select 选中接受', doc.querySelector('[name=acceptTravel]').value === '接受', `实际: ${doc.querySelector('[name=acceptTravel]').value}`);
ok('接受外派 select 选中接受', doc.querySelector('[name=acceptRelocate]').value === '接受', `实际: ${doc.querySelector('[name=acceptRelocate]').value}`);
ok('科研经历已填', doc.querySelector('[name=research]').value.includes('智能问答系统'), `实际: ${doc.querySelector('[name=research]').value}`);
ok('竞赛经历已填', doc.querySelector('[name=competition]').value.includes('数学建模'), `实际: ${doc.querySelector('[name=competition]').value}`);
ok('实习经历含薪资', doc.querySelector('[name=experience]').value.includes('300元/天'), `实际: ${doc.querySelector('[name=experience]').value}`);
ok('实习经历含离职原因', doc.querySelector('[name=experience]').value.includes('实习结束'), `实际: ${doc.querySelector('[name=experience]').value}`);
ok('实习经历含证明人', doc.querySelector('[name=experience]').value.includes('李经理'), `实际: ${doc.querySelector('[name=experience]').value}`);

ok('filled >= 35', res.filled >= 35, `实际: ${res.filled}`);

console.log(`\n结果: ${pass} 通过 / ${fail} 失败`);
process.exit(fail ? 1 : 0);
