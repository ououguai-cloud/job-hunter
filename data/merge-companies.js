// ============================================================
// 合并新公司 + 修复百度搜索链接
// 1. 读取现有 companies.js
// 2. 修复 baidu.com 搜索链接 → 第三方平台链接
// 3. 追加 new_companies.json 中的新公司
// 4. 输出回 companies.js
// 运行: node data/merge-companies.js
// ============================================================
const fs = require('fs');
const path = require('path');

const OLD = require('./companies');
const NEW = require('./new_companies.json');

const PLATFORMS = [
  ['Boss直聘', (name) => `https://www.zhipin.com/web/geek/job?query=${encodeURIComponent(name)}`],
  ['猎聘',     (name) => `https://www.liepin.com/zhaopin/?key=${encodeURIComponent(name)}`],
  ['智联招聘',  (name) => `https://sou.zhaopin.com/?keyword=${encodeURIComponent(name)}`],
  ['前程无忧',  (name) => `https://search.51job.com/list/000000,000000,0000,00,9,99,${encodeURIComponent(name)},2,1.html`],
];

const existingNames = new Set(OLD.map(c => c[0]));
let fixedBaidu = 0;
let totalOfficial = 0;
let totalThirdparty = 0;

// 1. 修复现有公司中的百度搜索链接
const fixedOld = OLD.map((c, i) => {
  const url = c[6] || '';
  if (url.includes('baidu.com')) {
    const name = c[0];
    const platform = PLATFORMS[i % PLATFORMS.length];
    c[6] = platform[1](name);
    c[9] = 'thirdparty';
    c[10] = platform[0];
    fixedBaidu++;
  } else if (c[9] !== 'official' && c[9] !== 'thirdparty') {
    // 已有真实URL但未标记urlType — 默认标记为official
    c[9] = 'official';
    c[10] = `${c[0]}招聘官网`;
  }
  if (c[9] === 'official') totalOfficial++;
  else totalThirdparty++;
  return c;
});

// 2. 追加新公司
let added = 0;
const allEntries = [...fixedOld];
for (const nc of NEW) {
  if (existingNames.has(nc.name)) continue;
  existingNames.add(nc.name);
  allEntries.push([
    nc.name, nc.industry, nc.city, nc.ctype, nc.scale, nc.salary,
    nc.url, nc.desc, nc.tier, nc.urlType, nc.portalName
  ]);
  if (nc.urlType === 'official') totalOfficial++;
  else totalThirdparty++;
  added++;
}

// 3. 输出 companies.js
const header = `// ============================================================
// JobHunter 公司库（真实正规公司，按行业分类）
// 格式: [公司名, 行业, 总部城市, 公司类型, 规模, 参考薪资, 官网, 简介, 规模等级, urlType, portalName]
// urlType: 'official' = 官方招聘官网 | 'thirdparty' = 第三方招聘平台
// portalName: 投递渠道名称（官方则为"${'${company}招聘官网'}"，第三方则为平台名）
// 数据用于程序化生成岗位数据库 db/jobs.json
// ============================================================
module.exports = [
`;

const body = allEntries.map(c => {
  // Ensure all elements are strings or undefined
  const safe = c.map(v => v === undefined ? '' : v);
  return ` ${JSON.stringify(safe)},`;
}).join('\n');

const footer = '\n];\n';

const outPath = path.join(__dirname, 'companies.js');
fs.writeFileSync(outPath, header + body + footer, 'utf8');

console.log(`✅ 合并完成`);
console.log(`📊 总公司数: ${allEntries.length}（原有 ${OLD.length} + 新增 ${added}）`);
console.log(`🔧 修复百度搜索链接: ${fixedBaidu} 条 → 第三方平台链接`);
console.log(`📊 URL类型: 官方 ${totalOfficial} | 第三方 ${totalThirdparty}`);
console.log(`📄 输出文件: ${outPath}`);
