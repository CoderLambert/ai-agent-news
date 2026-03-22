# AI Agent News

AI Agent 新闻资讯聚合系统 - 每小时自动抓取、翻译并展示最新的 AI Agent 相关资讯。

## 功能特点

- **多源聚合**: 整合 Hacker News、Reddit、OpenAI、Google AI、Hugging Face、arXiv 等多个平台
- **实时更新**: 每小时自动抓取最新新闻
- **自动翻译**: 非中文内容自动翻译为中文（需配置翻译 API）
- **结构化展示**: 每条新闻包含标题、摘要、原文链接和详情
- **渠道探索**: 定期自动发现并验证新的新闻渠道

## 快速开始

### 安装依赖

```bash
cd ~/ai-news
npm install
```

### 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:5173 查看新闻网站。

### 抓取新闻

```bash
# 抓取最新新闻
npm run fetch-news

# 翻译新闻
npm run translate

# 发现新的新闻渠道
npm run discover
```

### 构建生产版本

```bash
npm run build
npm run preview
```

## 项目结构

```
~/ai-news/
├── docs/                    # VitePress 网站
│   ├── .vitepress/         # VitePress 配置
│   │   └── config.ts
│   ├── news/               # 新闻页面
│   │   └── index.md
│   ├── index.md            # 首页
│   └── about.md            # 关于页面
├── src/                    # 抓取脚本
│   ├── fetch-news.js       # 新闻抓取脚本
│   ├── translate-news.js   # 新闻翻译脚本
│   └── discover-channels.js # 渠道探索脚本
├── data/                   # 数据文件
│   ├── news.json           # 抓取到的新闻数据
│   └── feed.xml            # RSS 订阅源
├── logs/                   # 日志文件
│   └── cron.log            # 定时任务日志
├── scripts/                # 辅助脚本
│   ├── update-news.sh      # 更新新闻脚本
│   └── install-cron.sh     # 安装定时任务脚本
└── package.json
```

## 数据来源

### 已集成的渠道

| 渠道名称 | 类型 | 更新频率 |
|---------|------|---------|
| Hacker News AI | API | 实时 |
| Reddit (r/artificial, etc.) | API | 实时 |
| OpenAI News | RSS | 周更 |
| Google AI Blog | RSS | 周更 |
| Hugging Face Blog | RSS | 日更 |
| arXiv cs.AI | RSS | 日更 |
| Simon Willison Blog | Atom | 周更 |
| Lilian Weng Blog | RSS | 月更 |

### 添加新的渠道

编辑 `src/fetch-news.js` 中的 `CONFIG.sources` 配置：

```javascript
const CONFIG = {
  sources: {
    yourChannel: {
      url: 'https://example.com/rss',
      enabled: true,
      name: 'Your Channel Name',
    },
  },
};
```

或者运行 `npm run discover` 自动发现新的渠道。

## 定时任务

### 安装定时任务

```bash
./scripts/install-cron.sh
```

这将在每小时的第 10 分钟执行抓取，第 15 分钟执行翻译。

### 查看日志

```bash
tail -f ~/ai-news/logs/cron.log
```

### 移除定时任务

```bash
crontab -e
# 删除相关行后保存
```

## 翻译配置

编辑 `src/translate-news.js` 配置翻译服务：

```javascript
const CONFIG = {
  translateService: 'mymemory',  // 或 'libre'
  libreTranslateUrl: 'https://libretranslate.com/translate',
};
```

### 支持的翻译服务

- **MyMemory**: 免费，有每日限额
- **LibreTranslate**: 开源，可自建实例

## 技术栈

- [VitePress](https://vitepress.dev/) - 静态站点生成器
- Vue 3 - 前端框架
- Node.js - 后端脚本
- Cron - 定时任务调度

## 许可证

ISC
