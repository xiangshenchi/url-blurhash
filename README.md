# URL to BlurHash

一个移动端友好的开源网页工具，用来把远程图片 URL 转换为 BlurHash。适合博客图片已经上传到图床、但又想为文章生成占位符的场景。

页面顶部使用了 `src/logo.png` 里的品牌图，桌面和移动端都会以它作为主识别元素。
在手机上，标题区会保持 logo 与文字的垂直居中对齐，避免首屏显得头重脚轻。

## 功能

- 输入单个图片 URL 并生成 BlurHash
- 通过 Cloudflare Pages Function 代理图片，绕开常见图床 CORS 限制
- 移动端优先的单列界面
- 图片预览、原始 BlurHash 和可直接贴进 Markdown 的图片语法
- 一键复制结果
- 输入框支持直接粘贴图片链接、Markdown 图片或带 `#blurhash` 的链接
- 前端结果区会输出两种内容：
  - Markdown 图片语法优先
  - 形如 `![image.png](https://...#blurhash=...&width=...&height=...)` 的可直接贴入博客内容
  - 原始 `BlurHash` 作为备用复制项
- MIT 开源

## 本地开发

```bash
npm install
npm run dev
```

本地只运行 Vite 时，`/api/image` 需要 Cloudflare Pages Functions 环境。完整验证可以先构建，再使用 Wrangler：

```bash
npm run build
npx wrangler pages dev dist
```

## Cloudflare Pages 部署

这套项目就是按 Cloudflare Pages 来设计的，前端静态站点加上 `functions/` 目录里的 API。

### 1. 准备仓库

把代码推到 GitHub、GitLab 或你常用的 Git 托管平台。

### 2. 在 Cloudflare Pages 新建项目

进入 Cloudflare Dashboard，打开 `Workers & Pages`，创建 `Pages` 项目并连接你的仓库。

### 3. 配置构建参数

在 Pages 的构建设置里填入：

- Build command: `npm run build`
- Build output directory: `dist`
- Root directory: `.`
- Functions directory: `functions`

仓库也包含 `wrangler.toml`，本地 Pages 开发和兼容日期已经预置好了。

### 4. 部署后端函数

`functions/api/image.js` 会自动作为 Pages Function 部署，不需要单独创建 API 服务。

它提供这个接口：

```text
GET /api/image?url=<encoded-image-url>
```

这个接口只允许 `http` 和 `https` URL，并且只转发 `image/*` 响应。

### 5. 发布前先本地验收

推荐先跑一遍本地 Pages 环境：

```bash
npm install
npm run build
npx wrangler pages dev dist
```

然后打开 `http://127.0.0.1:8788` 测试：

- 输入图片 URL
- 生成 Markdown 图片并复制
- 复制 `Fragment URL`
- 验证图床图片可以通过代理正常读取

### 6. 可选的自定义域名

如果你想把工具放到自己的域名下，在 Pages 项目的 `Custom domains` 里绑定即可。

## CORS 说明

浏览器直接读取远程图片像素时，经常会被图床的 CORS 策略拦住，导致 canvas 无法生成 BlurHash。本项目让 Cloudflare Pages Function 在服务端代取图片，再把图片作为同源资源返回给前端，从而让前端可以安全读取像素并编码。

## License

MIT
