# AI Agent 新闻聚合系统 - 使用指南

## 项目概述

这是一个自动化的 AI Agent 新闻资讯聚合系统，每小时自动抓取、翻译并展示最新的 AI Agent 相关资讯。

**项目位置**: `/home/lambert/ai-news/`

---

## 已集成的新闻渠道 (13 个)

### RSS 订阅源
| 渠道名称 | URL | 更新频率 |
|---------|-----|---------|
| OpenAI News | https://openai.com/news/rss.xml | 周更 |
| MIT CSAIL | https://www.csail.mit.edu/rss.xml | 周更 |
| TechCrunch AI | https://techcrunch.com/category/artificial-intelligence/feed/ | 日更 |
| Wired AI | https://www.wired.com/feed/tag/ai/latest/rss | 周更 |
| Ars Technica AI | https://arstechnica.com/ai/feed/ | 周更 |
| 量子位 | https://www.qbitai.com/feed | 日更 |
| Simon Willison Blog | https://simonwillison.net/atom/everything/ | 周更 |
| Lilian Weng Blog | https://lilianweng.github.io/index.xml | 月更 |

### API 抓取
| 渠道名称 | 类型 |
|---------|------|
| Hacker News | AI 关键词过滤 |
| Reddit | r/artificial, r/MachineLearning, r/singularity, r/LocalLLaMA |

---

## 定时任务配置

### 每小时执行（日常抓取）
```cron
# 每小时第 10 分钟抓取新闻
10 * * * * cd /home/lambert/ai-news && /usr/bin/env node src/fetch-news.js >> logs/cron.log 2>&1

# 每小时第 15 分钟翻译新闻
15 * * * * cd /home/lambert/ai-news && /usr/bin/env node src/translate-news.js >> logs/cron.log 2>&1
```

### 每周执行（渠道探索）
```cron
# 每周日上午 6 点探索新渠道
0 6 * * 0 cd /home/lambert/ai-news && /usr/bin/env node src/discover-channels.js >> logs/discovery.log 2>&1
```

---

## 使用命令

### 启动网站（开发模式）
```bash
cd ~/ai-news
npm run dev
```
访问：http://localhost:5173/

### 手动抓取新闻
```bash
npm run fetch-news
```

### 手动翻译新闻
```bash
npm run translate
```

### 探索新渠道
```bash
npm run discover
```

### 构建生产版本
```bash
npm run build
npm run preview
```

---

## 日志查看

### 查看定时任务日志
```bash
tail -f ~/ai-news/logs/cron.log
```

### 查看探索日志
```bash
tail -f ~/ai-news/logs/discovery.log
```

---

## 数据文件

- **新闻数据**: `~/ai-news/data/news.json`
- **RSS 订阅**: `~/ai-news/data/feed.xml`

---

## 网站页面

| 页面 | URL |
|-----|-----|
| 首页 | http://localhost:5173/ |
| 新闻列表 | http://localhost:5173/news/ |
| 关于 | http://localhost:5173/about |

---

## 添加新渠道

编辑 `src/fetch-news.js`，在 `CONFIG.sources` 中添加：

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

---

## 翻译配置

编辑 `src/translate-news.js` 配置翻译服务：

```javascript
const CONFIG = {
  translateService: 'mymemory',  // 或 'libre'
  libreTranslateUrl: 'https://libretranslate.com/translate',
};
```

---

## 管理定时任务

### 查看当前 crontab
```bash
crontab -l
```

### 编辑 crontab
```bash
crontab -e
```

### 移除所有任务
```bash
crontab -r
```

---

## 技术栈

- **前端**: VitePress + Vue 3
- **后端**: Node.js
- **定时任务**: Cron
- **翻译服务**: MyMemory / LibreTranslate

---

## 最近更新时间

2026-03-22 23:00
