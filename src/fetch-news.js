#!/usr/bin/env node

/**
 * AI Agent 新闻抓取脚本
 *
 * 功能：
 * - 从多个来源抓取 AI Agent 相关资讯
 * - 提取标题、摘要、原文链接
 * - 自动分类新闻
 * - 生成结构化 JSON 数据
 *
 * 稳定性特性：
 * - 指数退避重试机制
 * - 结构化日志记录
 * - API 限流保护
 */

import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';
import { parseStringPromise } from 'xml2js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);

// ==================== 日志系统 ====================
const LOG_FILE = path.join(__dirname, '../logs/fetch-news.log');

function ensureLogDir() {
  const logDir = path.dirname(LOG_FILE);
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
}

function log(level, message, data = {}) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    message,
    ...data,
  };

  const logLine = `[${timestamp}] [${level.toUpperCase()}] ${message}${Object.keys(data).length > 0 ? ' | ' + JSON.stringify(data) : ''}\n`;

  // 控制台输出
  if (level === 'error') {
    console.error(logLine);
  } else if (level === 'warn') {
    console.warn(logLine);
  } else {
    console.log(logLine);
  }

  // 写入文件
  try {
    ensureLogDir();
    fs.appendFileSync(LOG_FILE, logLine);
  } catch (e) {
    // 日志写入失败不影响主流程
  }
}

const logger = {
  info: (msg, data) => log('info', msg, data),
  warn: (msg, data) => log('warn', msg, data),
  error: (msg, data) => log('error', msg, data),
  debug: (msg, data) => log('debug', msg, data),
};

// ==================== 分类配置 ====================
const CATEGORIES = {
  company: {
    keywords: ['openai', 'anthropic', 'google', 'microsoft', 'meta', 'amazon', 'apple', 'nvidia', 'tesla', 'xAI'],
    label: '公司动态',
  },
  technology: {
    keywords: ['llm', 'transformer', 'model', 'architecture', 'training', 'inference', 'fine-tuning', 'rlhf'],
    label: '技术进展',
  },
  product: {
    keywords: ['release', 'launch', 'introduce', 'announce', 'new feature', 'update', 'beta', 'preview'],
    label: '产品发布',
  },
  research: {
    keywords: ['paper', 'research', 'arxiv', 'study', 'experiment', 'benchmark', 'evaluation'],
    label: '研究论文',
  },
  application: {
    keywords: ['tool', 'application', 'app', 'integration', 'plugin', 'extension', 'api', 'sdk'],
    label: '应用案例',
  },
  safety: {
    keywords: ['safety', 'security', 'ethics', 'regulation', 'policy', 'risk', 'alignment', 'misuse'],
    label: '安全伦理',
  },
  opinion: {
    keywords: ['opinion', 'analysis', 'comment', 'thought', 'perspective', 'review'],
    label: '行业观点',
  },
  other: {
    keywords: [],
    label: '其他',
  },
};

function categorizeNews(title, summary, url) {
  const text = `${title} ${summary} ${url}`.toLowerCase();
  let bestCategory = 'other';
  let bestScore = 0;

  for (const [category, config] of Object.entries(CATEGORIES)) {
    const score = config.keywords.filter(kw => text.includes(kw.toLowerCase())).length;
    if (score > bestScore) {
      bestScore = score;
      bestCategory = category;
    }
  }

  return {
    category: bestCategory,
    categoryName: CATEGORIES[bestCategory]?.label || '其他',
  };
}

// ==================== 抓取配置 ====================
const CONFIG = {
  outputDir: path.join(__dirname, '../data'),
  outputFile: 'news.json',
  maxNews: 80,
  maxPerSource: 20,
  sources: {
    hackerNews: {
      url: 'https://hacker-news.firebaseio.com/v0/topstories.json',
      enabled: true,
      name: 'Hacker News',
    },
    reddit: {
      subreddits: ['artificial', 'MachineLearning', 'singularity', 'LocalLLaMA'],
      enabled: true,
    },
    openai: {
      url: 'https://openai.com/news/rss.xml',
      enabled: true,
      name: 'OpenAI News',
    },
    googleAI: {
      url: 'https://blog.google/innovation-and-ai/technology/ai/rss/',
      enabled: true,
      name: 'Google AI Blog',
    },
    huggingFace: {
      url: 'https://huggingface.co/blog/feed.xml',
      enabled: true,
      name: 'Hugging Face Blog',
    },
    arxiv: {
      url: 'https://export.arxiv.org/rss/cs.AI',
      enabled: true,
      name: 'arXiv cs.AI',
    },
    simonWillison: {
      url: 'https://simonwillison.net/atom/everything/',
      enabled: true,
      name: 'Simon Willison Blog',
    },
    lilianWeng: {
      url: 'https://lilianweng.github.io/index.xml',
      enabled: true,
      name: 'Lilian Weng Blog',
    },
    mitCsail: {
      url: 'https://www.csail.mit.edu/rss.xml',
      enabled: true,
      name: 'MIT CSAIL',
    },
    techCrunchAi: {
      url: 'https://techcrunch.com/category/artificial-intelligence/feed/',
      enabled: true,
      name: 'TechCrunch AI',
    },
    wiredAi: {
      url: 'https://www.wired.com/feed/tag/ai/latest/rss',
      enabled: true,
      name: 'Wired AI',
    },
    arsTechnicaAi: {
      url: 'https://arstechnica.com/ai/feed/',
      enabled: true,
      name: 'Ars Technica AI',
    },
    qbitai: {
      url: 'https://www.qbitai.com/feed',
      enabled: true,
      name: '量子位',
    },
  },
};

// ==================== 工具函数 ====================
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * 带指数退避重试机制的 HTTP 请求
 * @param {string} url - 请求 URL
 * @param {object} options - 请求选项
 * @param {number} maxRetries - 最大重试次数
 * @returns {Promise<any>} 请求结果
 */
async function fetchWithRetry(url, options = {}, maxRetries = 3) {
  const baseTimeout = options.timeout || 10000;
  let lastError;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // 指数退避：1s, 2s, 4s, 8s...
      const delay = attempt > 1 ? Math.min(1000 * Math.pow(2, attempt - 2), 8000) : 0;
      if (delay > 0) {
        logger.debug(`重试前等待 ${delay}ms`, { url, attempt });
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      return await fetch(url, { timeout: baseTimeout * attempt });
    } catch (error) {
      lastError = error;
      logger.warn(`请求失败 (尝试 ${attempt}/${maxRetries})`, {
        url,
        error: error.message,
        attempt,
      });
    }
  }

  logger.error(`所有重试均失败`, { url, maxRetries, finalError: lastError?.message });
  throw lastError;
}

function fetch(url, options = {}) {
  const timeout = options.timeout || 10000;

  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AINewsBot/1.0)',
        'Accept': '*/*',
      },
      timeout: timeout,
    }, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Request failed: ${res.statusCode}`));
        return;
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Request timeout after ${timeout}ms`));
    });
  });
}

function generateSummary(title, url) {
  const urlDomain = url ? new URL(url).hostname.replace('www.', '') : 'unknown';
  return `来自 ${urlDomain} 的 AI 相关资讯：${title}`;
}

function formatDate(timestamp) {
  const date = new Date(timestamp * 1000);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function containsChinese(text) {
  const chineseRegex = /[\u4e00-\u9fa5]/;
  return chineseRegex.test(text);
}

// ==================== 抓取函数 ====================
async function fetchHackerNews() {
  logger.info('📰 抓取 Hacker News...');
  try {
    const topStories = await fetchWithRetry(CONFIG.sources.hackerNews.url, { timeout: 15000 }, 3);
    const news = [];
    const maxItems = CONFIG.maxPerSource || 20;

    for (let i = 0; i < Math.min(topStories.length, 50); i++) {
      if (news.length >= maxItems) break;

      const id = topStories[i];
      try {
        const item = await fetchWithRetry(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, { timeout: 8000 }, 2);
        if (item && item.type === 'story' && item.title) {
          const keywords = [
            'ai', 'agent', 'llm', 'gpt', 'claude', 'anthropic', 'openai',
            'language model', 'machine learning', 'transformer', 'neural',
            'deep learning', 'generative', 'diffusion', 'inference',
            'codex', 'copilot', 'assistant', 'chatbot', 'agi',
            'robot', 'autonomous', 'automation', 'nlp', 'computer vision'
          ];
          const textToCheck = `${item.title || ''} ${item.url || ''} ${item.descendants || ''}`.toLowerCase();
          const isRelevant = keywords.some(kw => textToCheck.includes(kw));

          if (isRelevant) {
            const { category, categoryName } = categorizeNews(item.title, '', item.url || '');
            news.push({
              id: `hn-${item.id}`,
              title: item.title,
              summary: generateSummary(item.title, item.url),
              originalUrl: item.url || `https://news.ycombinator.com/item?id=${item.id}`,
              source: 'Hacker News',
              date: formatDate(item.time),
              score: item.score || 0,
              translated: false,
              fetchedAt: new Date().toISOString(),
              category,
              categoryName,
            });
          }
        }
      } catch (e) {
        logger.debug(`跳过失败的 HN 条目`, { id, error: e.message });
      }
    }

    logger.info(`Hacker News 抓取完成`, { count: news.length });
    return news;
  } catch (e) {
    logger.error('Hacker News 抓取失败', { error: e.message });
    return [];
  }
}

async function fetchReddit() {
  logger.info('📰 抓取 Reddit...');
  const allNews = [];
  const subredditStats = {};

  for (const subreddit of CONFIG.sources.reddit.subreddits) {
    try {
      const url = `https://www.reddit.com/r/${subreddit}/hot.json?limit=25`;
      const data = await fetchWithRetry(url, { timeout: 15000 }, 3);

      if (data && data.data && data.data.children) {
        const posts = data.data.children
          .filter(post => !post.data.stickied && !post.data.over_18)
          .slice(0, 15)
          .map(post => {
            const { category, categoryName } = categorizeNews(post.data.title, '', post.data.url || '');
            return {
              id: `reddit-${post.data.id}`,
              title: post.data.title,
              summary: generateSummary(post.data.title, post.data.url),
              originalUrl: post.data.url || `https://reddit.com${post.data.permalink}`,
              source: `r/${subreddit}`,
              date: formatDate(post.data.created_utc),
              score: post.data.ups,
              translated: false,
              fetchedAt: new Date().toISOString(),
              category,
              categoryName,
            };
          });

        allNews.push(...posts);
        subredditStats[subreddit] = posts.length;
        logger.debug(`r/${subreddit} 抓取完成`, { count: posts.length });
      }
    } catch (e) {
      logger.warn(`r/${subreddit} 抓取失败`, { error: e.message });
      subredditStats[subreddit] = 0;
    }
  }

  logger.info('Reddit 抓取完成', { total: allNews.length, subreddits: subredditStats });
  return allNews;
}

async function parseRSS(xmlContent, sourceName) {
  try {
    const result = await parseStringPromise(xmlContent);
    const items = [];
    const maxItemsPerSource = CONFIG.maxPerSource || 15;

    const getText = (field) => {
      if (!field) return '';
      if (typeof field === 'string') return field;
      if (Array.isArray(field)) return getText(field[0]);
      if (field._) return field._;
      return '';
    };

    if (result.rss && result.rss.channel) {
      const channel = Array.isArray(result.rss.channel) ? result.rss.channel[0] : result.rss.channel;
      if (channel.item) {
        const rssItems = Array.isArray(channel.item) ? channel.item : [channel.item];
        for (const item of rssItems.slice(0, maxItemsPerSource)) {
          items.push({
            title: getText(item.title),
            link: getText(item.link),
            description: getText(item.description),
            pubDate: getText(item.pubDate),
          });
        }
      }
    }

    if (result.feed && result.feed.entry) {
      const entries = Array.isArray(result.feed.entry) ? result.feed.entry : [result.feed.entry];
      for (const entry of entries.slice(0, maxItemsPerSource)) {
        const linkHref = entry.link?.[0]?.$?.href || getText(entry.link);
        const summary = getText(entry.summary) || getText(entry.content) || '';
        const pubDate = getText(entry.published) || getText(entry.updated) || '';

        items.push({
          title: getText(entry.title),
          link: linkHref,
          description: summary,
          pubDate: pubDate,
        });
      }
    }

    return items.map(item => {
      const { category, categoryName } = categorizeNews(item.title, item.description, item.link);
      return {
        id: `${sourceName.replace(/\s+/g, '').toLowerCase()}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        title: item.title || '无标题',
        summary: item.description ? String(item.description).substring(0, 200) : generateSummary(item.title, item.link),
        originalUrl: item.link,
        source: sourceName,
        date: item.pubDate ? formatDate(new Date(item.pubDate).getTime() / 1000) : new Date().toLocaleString('zh-CN'),
        score: 0,
        translated: false,
        fetchedAt: new Date().toISOString(),
        category,
        categoryName,
      };
    });
  } catch (e) {
    console.error(`Error parsing RSS for ${sourceName}:`, e.message);
    return [];
  }
}

/**
 * 抓取单个 RSS 源（带重试机制）
 * @param {object} source - RSS 源配置
 * @returns {Promise<Array>} 新闻列表
 */
async function fetchSingleRSS(source) {
  const url = source.url;
  const sourceName = source.name || source;

  const xmlContent = await fetchWithRetry(url, { timeout: 15000 }, 3);
  return await parseRSS(xmlContent, sourceName);
}

async function fetchRSS() {
  console.log('📰 抓取 RSS 订阅源...');
  const allNews = [];

  const rssSources = Object.entries(CONFIG.sources).filter(
    ([, source]) => source.url && source.enabled !== false
  );

  for (const [name, source] of rssSources) {
    try {
      const url = source.url;
      const sourceName = source.name || name;
      console.log(`  - ${sourceName}: ${url}`);

      const xmlContent = await fetchWithRetry(url, { timeout: 15000 }, 3);
      const items = await parseRSS(xmlContent, sourceName);
      allNews.push(...items);
      console.log(`    获取 ${items.length} 条`);
    } catch (e) {
      console.error(`  ❌ ${source.name || name}: ${e.message}`);
    }
  }

  return allNews;
}

async function translateIfNeeded(news) {
  const newsToTranslate = news.filter(n => !containsChinese(n.title));

  if (newsToTranslate.length === 0) {
    logger.info('✅ 无需翻译');
    return news;
  }

  logger.info(`🔄 需要翻译 ${newsToTranslate.length} 条新闻...`);

  for (const item of newsToTranslate) {
    item.translated = false;
    logger.debug(`待翻译：${item.title.substring(0, 50)}...`);
  }

  return news;
}

function mergeAndDeduplicate(allNews) {
  const seen = new Set();
  const unique = [];

  for (const news of allNews) {
    const key = news.originalUrl;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(news);
    }
  }

  unique.sort((a, b) => new Date(b.fetchedAt) - new Date(a.fetchedAt));
  return unique.slice(0, CONFIG.maxNews);
}

function saveNews(news) {
  ensureDir(CONFIG.outputDir);
  const outputPath = path.join(CONFIG.outputDir, CONFIG.outputFile);
  fs.writeFileSync(outputPath, JSON.stringify(news, null, 2), 'utf-8');
  logger.info(`✅ 已保存 ${news.length} 条新闻到 ${outputPath}`);
}

function generateRSS(news) {
  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>AI Agent News</title>
    <link>https://example.com</link>
    <description>最新的 AI Agent 相关资讯</description>
    <language>zh-cn</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    ${news.map(item => `
    <item>
      <title>${item.title}</title>
      <link>${item.originalUrl}</link>
      <description>${item.summary}</description>
      <pubDate>${new Date(item.fetchedAt).toUTCString()}</pubDate>
      <source>${item.source}</source>
      <category>${item.categoryName}</category>
    </item>`).join('')}
  </channel>
</rss>`;

  const rssPath = path.join(CONFIG.outputDir, 'feed.xml');
  fs.writeFileSync(rssPath, rss, 'utf-8');
  logger.info(`✅ RSS 订阅源已保存到 ${rssPath}`);
}

// ==================== 主函数 ====================
async function main() {
  const startTime = Date.now();
  logger.info('🚀 开始抓取 AI Agent 新闻', { startTime: new Date().toISOString() });

  const allNews = [];
  const sourceStats = {};

  // 1. 抓取 Hacker News
  if (CONFIG.sources.hackerNews.enabled) {
    try {
      const hnNews = await fetchHackerNews();
      allNews.push(...hnNews);
      sourceStats['Hacker News'] = hnNews.length;
    } catch (e) {
      logger.error('Hacker News 抓取失败', { error: e.message });
      sourceStats['Hacker News'] = 0;
    }
  }

  // 2. 抓取 Reddit
  if (CONFIG.sources.reddit.enabled) {
    try {
      const redditNews = await fetchReddit();
      allNews.push(...redditNews);
      sourceStats['Reddit'] = redditNews.length;
    } catch (e) {
      logger.error('Reddit 抓取失败', { error: e.message });
      sourceStats['Reddit'] = 0;
    }
  }

  // 3. 抓取 RSS 源（排除 Hacker News 和 Reddit）
  const rssSources = Object.entries(CONFIG.sources).filter(
    ([key, source]) => source.url && source.enabled !== false && key !== 'hackerNews'
  );

  for (const [name, source] of rssSources) {
    try {
      const sourceName = source.name || name;
      logger.info(`正在抓取 ${sourceName}`);
      const rssItems = await fetchSingleRSS(source);
      allNews.push(...rssItems);
      sourceStats[sourceName] = rssItems.length;
      logger.info(`${sourceName} 抓取完成`, { count: rssItems.length });
    } catch (e) {
      logger.error(`RSS 源抓取失败：${source.name || name}`, { error: e.message });
      sourceStats[source.name || name] = 0;
    }
  }

  logger.info('所有来源抓取完成', { sourceStats, totalBeforeDedupe: allNews.length });

  const processedNews = await translateIfNeeded(allNews);
  const finalNews = mergeAndDeduplicate(processedNews);

  saveNews(finalNews);
  generateRSS(finalNews);

  const duration = Date.now() - startTime;
  logger.info('✅ 新闻抓取完成', {
    totalNews: finalNews.length,
    duration: `${duration}ms`,
    sources: Object.keys(sourceStats).length,
  });

  // 输出分类统计
  const stats = {};
  finalNews.forEach(news => {
    stats[news.categoryName] = (stats[news.categoryName] || 0) + 1;
  });
  logger.info('📊 分类统计', stats);

  // 输出来源统计
  logger.info('📊 来源统计', sourceStats);
}

main().catch(console.error);
