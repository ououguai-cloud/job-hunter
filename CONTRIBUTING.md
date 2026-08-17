# 贡献指南

感谢你对 职聘通 JobHunter 的兴趣！无论是修复 Bug、改进文档还是新增功能，都欢迎参与。

## 开发环境

- Node.js ≥ 18
- Chrome 或 Edge（一键投递自动化引擎需要）

## 本地开发

```bash
npm install
npm start        # http://localhost:8621
```

## 提交规范

1. **Fork** 本仓库并基于 `main` 分支创建你的功能分支（`feat/xxx` 或 `fix/xxx`）
2. 提交信息使用清晰的中文或英文描述，例如：`fix: 修复简历解析对扫描件报错的问题`
3. 提交前运行测试并保证全绿：

```bash
npm start   # 先启动服务
npm test    # 128 项断言（25 回归 + 60 全量 + 43 整合）
```

## 代码约定

- 前端为**纯原生 HTML/CSS/JS**，禁止引入框架与构建步骤
- 新增功能需同步补充 `tools/e2e-*.js` 断言并保持全绿
- 不提交任何个人数据：`resume/profile.json`、`data/applications.json`、`.profile/` 均被 `.gitignore` 忽略

## 数据类改动

- 公司/岗位库为**程序化生成**：修改 `data/companies.js` 后运行 `node data/gen-jobs.js` 重新生成 `db/jobs.json`，保证同公司不重复、结果可复现
- 扩充公司库可运行 `node data/expand-companies.js`（东方财富 A 股 API，支持断点续拉）

## Issue 模板要点

提交 Issue 时请说明：环境（OS / Node 版本 / 浏览器）、复现步骤、期望行为与实际行为、相关截图或日志。

## 许可证

参与即代表你同意你的贡献以 [MIT License](LICENSE) 发布。
