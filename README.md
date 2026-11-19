# Latent Space

个人技术知识库：大模型/Agent、编程语言特性与系统架构学习笔记。

基于 [VitePress](https://vitepress.dev/) 搭建，支持中英文切换和多套主题。

在线阅读：https://go0d-cat.github.io/latent-space/

## 本地运行

需要 Node.js 22.12 或更高版本。

```bash
npm install
npm run docs:dev      # 本地预览
npm run docs:build    # 构建静态站点到 docs/.vitepress/dist
npm run docs:preview  # 预览构建结果
```

## 目录结构

```
.github/workflows/deploy.yml  # 推送到 main 后自动部署 GitHub Pages
docs/
├── .vitepress/
│   ├── config.mts            # 站点配置（中英文、分类列表、侧边栏自动生成）
│   └── theme/                # 主题与语言切换：themes.ts、i18n.ts、*Switcher.vue、styles/ 每套主题一个 CSS
├── index.md                  # 中文首页
├── llm/                      # 大模型原理
├── agent/                    # Agent 应用
├── language/                 # 语言特性
├── architecture/             # 系统架构
└── en/                       # 英文版，目录结构与中文一致
templates/note.md             # 笔记模板
```

## 写笔记

1. 复制 `templates/note.md` 到对应分类目录，例如 `docs/agent/rag-basics.md`；英文版放在 `docs/en/` 下的同名路径，例如 `docs/en/agent/rag-basics.md`。
2. 侧边栏根据目录自动生成：标题优先取 frontmatter 的 `title`，其次取第一个 `#` 标题。
3. 按文件名排序，需要固定顺序时可加数字前缀，如 `01-intro.md`。
4. 子目录会成为可折叠分组，在子目录里放 `index.md` 可作为分组首页。
5. 以 `.` 或 `_` 开头的文件和目录不会出现在侧边栏，可用于草稿。
6. 侧边栏和页面列表在启动时生成，新增文件后需重启 `docs:dev`。
7. 二级、三级标题会自动编号（`1.`、`1.1`），正文和右侧文章目录一致，标题里不要再手写编号。不需要编号的页面在 frontmatter 里加 `pageClass: no-heading-numbers`。

## 阅读布局

- 左侧边栏和右侧文章目录的边缘可以拖动调整宽度，也可以聚焦后用方向键微调；双击恢复默认宽度。
- 文章目录标题右侧的「收起」按钮可以隐藏目录，正文随之变宽；收起后点右上角的「目录」按钮展开。
- 宽度和收起状态保存在浏览器的 localStorage 中，只在桌面宽度下生效：侧边栏 ≥ 960px，右侧文章目录 ≥ 1024px（CSS 像素，系统缩放 150% 的 2K 笔记本也在这个范围内）。更窄时目录收进顶部的「本页目录」弹出菜单。
- 两栏的实际宽度都不会超过可用空间，保证正文文字区至少 26rem（约 416px）。

## 中英文

导航栏右侧的「语言」下拉框在中文（根路径）和英文（`/en/`）之间切换。切换时会跳到另一种语言的同一页面；该页面还没有翻译时，回到目标语言的首页。笔记不要求两种语言都写。

## 新增分类

1. 在 `docs/` 和 `docs/en/` 下各新建目录并添加 `index.md`。
2. 在 `docs/.vitepress/config.mts` 的 `categories` 数组中加一行，填上中英文名称。
3. 按需在 `docs/index.md` 和 `docs/en/index.md` 首页添加入口。

## 主题

导航栏右侧可以切换主题，选择会保存在浏览器的 localStorage 中：

| 主题 | 说明 |
|---|---|
| macOS（默认） | 灰阶分层、毛玻璃侧边栏、衬线标题，支持深浅色 |
| 复古电玩 | 像素字体、硬阴影、CRT 扫描线，支持深浅色 |
| 樱花粉 | 樱花粉配淡紫渐变，支持深浅色 |

新增主题：在 `docs/.vitepress/theme/themes.ts` 中加一项，再在 `styles/` 下新建 CSS，所有选择器以 `html[data-theme='<id>']` 开头，最后在 `theme/index.ts` 中引入。

## 部署

推送到 `main` 分支后，GitHub Actions 会自动构建并发布到 GitHub Pages。首次使用需要在仓库 **Settings → Pages → Build and deployment → Source** 中选择 **GitHub Actions**。

如果仓库改名，需要同步修改 `config.mts` 中的 `BASE`。
