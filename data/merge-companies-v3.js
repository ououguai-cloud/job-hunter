// ============================================================
// 合并 v3 批次新公司到 companies.js
// 运行: node data/merge-companies-v3.js
// ============================================================
const fs = require('fs');
const path = require('path');

const OLD = require('./companies');
const NEW = require('./new_companies_v3.json');

const existingNames = new Set(OLD.map(c => c[0]));
let added = 0;
let totalOfficial = 0, totalThirdparty = 0;

const allEntries = [...OLD.map(c => c)];
for (const nc of NEW) {
  if (existingNames.has(nc.name)) continue;
  existingNames.add(nc.name);
  allEntries.push([
    nc.name, nc.industry, nc.city, nc.ctype, nc.scale, nc.salary,
    nc.url, nc.desc, nc.tier, nc.urlType, nc.portalName
  ]);
  added++;
}

for (const c of allEntries) {
  if (c[9] === 'official') totalOfficial++;
  else totalThirdparty++;
}

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
  const safe = c.map(v => v === undefined ? '' : v);
  return ` ${JSON.stringify(safe)},`;
}).join('\n');

const outPath = path.join(__dirname, 'companies.js');
fs.writeFileSync(outPath, header + body + '\n];\n', 'utf8');

console.log(`✅ 合并完成`);
console.log(`📊 总公司数: ${allEntries.length}（原有 ${OLD.length} + 新增 ${added}）`);
console.log(`📊 URL类型: 官方 ${totalOfficial} | 第三方 ${totalThirdparty}`);
console.log(`📄 输出文件: ${outPath}`);
