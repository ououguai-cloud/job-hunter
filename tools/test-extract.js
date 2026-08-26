/* extractProfile 单元测试 — 验证新增字段提取 */
const fs = require('fs');
const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');
const lines = html.split('\n');

// extractProfile 在第1173行(1-indexed)，函数体结束在 return p; (第1526行)
// 提取 index 1172 到 1525 (不含 1526 的 } )，保留 return p;
let fnCode = lines.slice(1172, 1526).join('\n');
// 去掉外层 function 声明行
fnCode = fnCode.replace(/^function extractProfile\(text\)\s*\{/, '');

// 依赖
const pre = `
const NEXT_LABEL = /(调剂意向|调剂意愿|是否接受调剂|接受调剂|服从调剂|期望薪资|期望月薪|期望年薪|期望城市|期望就业城市|意向城市|求职城市|求职意向|意向岗位|目标岗位|应聘岗位|期望职位|意向职位|求职方向|期望岗位|应聘方向|现居城市|所在城市|现居地|政治面貌|籍贯|生源地|户籍地|毕业时间|毕业年份|英语水平|其他外语|电话|手机|邮箱|微信|性别)/;
const cutAtLabel = s => String(s || '').split(NEXT_LABEL)[0];
function locateSection(linesArr, re) {
  let start = -1;
  for (let i = 0; i < linesArr.length; i++) {
    if (re.test(linesArr[i]) && linesArr[i].length < 30) { start = i; break; }
  }
  if (start < 0) return null;
  const NEXT_RE = /^(教育|学历|实习|工作|项目|校园|实践|技能|自我|证书|奖项|荣誉|个人|求职|期望|简介|总结|评价|特长|优势)/;
  let end = linesArr.length;
  for (let j = start + 1; j < linesArr.length; j++) {
    if (NEXT_RE.test(linesArr[j]) && linesArr[j].length < 30 && j > start + 1) { end = j; break; }
  }
  return { start, end };
}
function detectJobTarget(text, skills, experiences, major) { return []; }
`;

const fn = new Function('text', pre + fnCode);

const cases = {
  c1_full: '姓名：张三\n性别：男\n出生年月：2003.05\n民族：汉族\n政治面貌：共青团员\n籍贯：湖南长沙\n现居城市：西安\n调剂意向：接受\n通讯地址：湖南省长沙市岳麓区麓山南路5号\n邮编：410083\n身高：178cm\n2021.09-2025.06 湖南大学金融学院 金融学 本科 统招\n论文题目：基于机器学习的股票预测模型',
  c2_real: '王艺凯 \n\n西安信息职业大学 | 通信软件工程 | 本科在读·2027届 \n\n19271767041 | ououguai@foxmail.com | 西安 | 可适应国内外出差及外派 \n\n求职方向：销售管培生 / 大客户销售（KA Sales）·期望城市：重庆 / 成都 / 深圳 / 西安 / 郑州 / 合肥 \n\n调剂意向：接受调剂',
  c3_pz: '裴子豪\n年龄：21\n民族：汉族\n政治面貌：群众\n学历：大学本科\n培养方式：统招\n到岗时间：随时到岗\n身高175cm\n通讯地址：福建省三明市三元区\n邮编：365000\n2023.09-2026.06 三明学院 电子信息工程学院 电子信息工程',
};

let pass = 0, fail = 0;
for (const [k, text] of Object.entries(cases)) {
  const p = fn(text);
  const result = {
    name: p.name, gender: p.gender, birth: p.birth, age: p.age, nation: p.nation, politics: p.politics,
    hometown: p.hometown, city: p.city, address: p.address, postcode: p.postcode, height: p.height,
    school: p.school, department: p.department, major: p.major, degree: p.degree, eduType: p.eduType,
    gradYear: p.gradYear, gradTime: p.gradTime, thesis: p.thesis,
    acceptAdjust: p.acceptAdjust, availableTime: p.availableTime,
    preferCity: (p.preferCity||[]).slice(0,3), province: p.province, health: p.health
  };
  console.log(`\n=== ${k} ===`);
  console.log(JSON.stringify(result, null, 1));
  // 断言
  if (k === 'c1_full') {
    if (p.nation === '汉族') pass++; else { fail++; console.log('  FAIL: nation=' + p.nation); }
    if (p.politics === '共青团员') pass++; else { fail++; console.log('  FAIL: politics=' + p.politics); }
    if (p.address && p.address.includes('岳麓区')) pass++; else { fail++; console.log('  FAIL: address=' + p.address); }
    if (p.postcode === '410083') pass++; else { fail++; console.log('  FAIL: postcode=' + p.postcode); }
    if (p.height === '178cm') pass++; else { fail++; console.log('  FAIL: height=' + p.height); }
    if (p.department === '金融学院') pass++; else { fail++; console.log('  FAIL: department=' + p.department); }
    if (p.eduType === '统招') pass++; else { fail++; console.log('  FAIL: eduType=' + p.eduType); }
    if (p.thesis && p.thesis.includes('股票预测')) pass++; else { fail++; console.log('  FAIL: thesis=' + p.thesis); }
    if (p.age === '23') pass++; else { fail++; console.log('  FAIL: age=' + p.age + ' (expected 23 from 2003)'); }
    if (p.health === '良好') pass++; else { fail++; console.log('  FAIL: health=' + p.health); }
  }
  if (k === 'c3_pz') {
    if (p.nation === '汉族') pass++; else { fail++; console.log('  FAIL: nation=' + p.nation); }
    if (p.politics === '群众') pass++; else { fail++; console.log('  FAIL: politics=' + p.politics); }
    if (p.eduType === '统招') pass++; else { fail++; console.log('  FAIL: eduType=' + p.eduType); }
    if (p.availableTime === '随时到岗') pass++; else { fail++; console.log('  FAIL: availableTime=' + p.availableTime); }
    if (p.height === '175cm') pass++; else { fail++; console.log('  FAIL: height=' + p.height); }
    if (p.address && p.address.includes('三明')) pass++; else { fail++; console.log('  FAIL: address=' + p.address); }
    if (p.postcode === '365000') pass++; else { fail++; console.log('  FAIL: postcode=' + p.postcode); }
    if (p.department === '电子信息工程学院') pass++; else { fail++; console.log('  FAIL: department=' + p.department); }
  }
  if (k === 'c2_real') {
    if (p.acceptAdjust === '接受') pass++; else { fail++; console.log('  FAIL: acceptAdjust=' + p.acceptAdjust); }
    if (p.preferCity && p.preferCity.length >= 3) pass++; else { fail++; console.log('  FAIL: preferCity=' + p.preferCity); }
    if (p.province === '陕西') pass++; else { fail++; console.log('  FAIL: province=' + p.province + ' (expected 陕西 from city 西安)'); }
  }
}

console.log(`\n${'='.repeat(40)}`);
console.log(`通过: ${pass} / 失败: ${fail}`);
process.exit(fail > 0 ? 1 : 0);
