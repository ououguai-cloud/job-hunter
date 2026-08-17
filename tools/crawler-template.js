/**
 * 校招岗位抓取脚本模板（Node.js）
 * -------------------------------------------------
 * 作用：从公开校招信息源（公司官网招聘页 / 校招聚合站）抓取岗位，导出为
 *      data/jobs_import.json，然后在前端"公司筛选 → 导入 JSON"直接并入岗位库。
 *
 * 注意：
 *  - 不同站点 DOM 结构不同，请按目标站点修改下方 selector 与解析逻辑
 *  - 遵守 robots.txt 与站点条款，控制抓取频率（建议 1-2 秒/请求），仅用于个人求职
 *  - 抓取后务必人工核对 URL 是否指向官方投递页
 *
 * 运行：node tools/crawler-template.js
 */
'use strict';
const fs = require('fs');
const path = require('path');

// 站点适配器：按需补充
const ADAPTERS = {
  /** 北森系校招页通用适配（很多公司用 zhiye.com，但页面结构不一，需按实际站点微调） */
  'zhiye': async (fetch, baseUrl) => {
    const res = await fetch(baseUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
    const html = await res.text();
    // 简单正则抽取（演示用；实际站点请用 cheerio 解析）
    const jobs = [];
    const re = /职位名称[^<]*?([^<]{2,40})|"name"\s*:\s*"([^"]{2,60})/g;
    let m;
    while ((m = re.exec(html)) && jobs.length < 50) {
      const title = (m[1] || m[2] || '').trim();
      if (title && !jobs.some(j => j.title === title)) {
        jobs.push({
          company: '待填写公司名',
          logoColor: '#4A6CF7',
          title,
          type: '校招',
          city: '待填写城市',
          industry: '待填写行业',
          degree: '本科及以上',
          gradYear: '2026-2027届',
          salary: '面议',
          tags: ['校招'],
          kw: [],
          url: baseUrl,
          portal: '待填写',
          desc: '待补充职位描述',
          _source: baseUrl,
        });
      }
    }
    return jobs;
  },
};

async function main() {
  // 示例：抓取一个北森系页面（把 URL 换成目标公司招聘页）
  const targets = process.argv.slice(2);
  if (!targets.length) {
    console.log('用法: node tools/crawler-template.js <招聘页URL...>');
    console.log('示例: node tools/crawler-template.js https://example.zhiye.com');
    process.exit(1);
  }
  const all = [];
  for (const url of targets) {
    console.log(`抓取 ${url} …`);
    try {
      const jobs = await ADAPTERS.zhiye(fetch, url);
      all.push(...jobs);
      console.log(`  获得 ${jobs.length} 条`);
    } catch (e) {
      console.error(`  失败: ${e.message}`);
    }
    await new Promise(r => setTimeout(r, 1500));
  }
  const out = path.join(__dirname, '..', 'data', 'jobs_import.json');
  fs.writeFileSync(out, JSON.stringify(all, null, 2), 'utf8');
  console.log(`✅ 已导出 ${all.length} 条 → ${out}`);
  console.log('   然后在前端「公司筛选 → 导入 JSON」并入岗位库');
}

main();
