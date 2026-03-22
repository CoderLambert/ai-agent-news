#!/usr/bin/env node

/**
 * AI Agent 新闻抓取脚本
 *
 * 功能：
 * - 从多个来源抓取 AI Agent 相关新闻
 * - 提取标题、摘要、原文链接
 * - 自动分类新闻
 * - 生成结构化 JSON 数据
 */

import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';
import { parseStringPromise } from 'xml2js';

const __dirname = path.dirname(new URL(import.meta.url).pathname);

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
  console.log('📰 抓取 Hacker News...');
  try {
    const topStories = await fetch(CONFIG.sources.hackerNews.url);
    const news = [];
    const maxItems = CONFIG.maxPerSource || 20;

    for (let i = 0; i < Math.min(topStories.length, 50); i++) {
      if (news.length >= maxItems) break;

      const id = topStories[i];
      try {
        const item = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, { timeout: 5000 });
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
        // 跳过失败的请求
      }
    }

    console.log(`  获取 ${news.length} 条 Hacker News`);
    return news;
  } catch (e) {
    console.error('Error fetching Hacker News:', e.message);
    return [];
  }
}

async function fetchReddit() {
  console.log('📰 抓取 Reddit...');
  const allNews = [];

  for (const subreddit of CONFIG.sources.reddit.subreddits) {
    try {
      const url = `https://www.reddit.com/r/${subreddit}/hot.json?limit=25`;
      const data = await fetch(url);

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
      }
    } catch (e) {
      console.error(`Error fetching r/${subreddit}:`, e.message);
    }
  }

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

      const xmlContent = await fetch(url);
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
    console.log('✅ 无需翻译');
    return news;
  }

  console.log(`🔄 需要翻译 ${newsToTranslate.length} 条新闻...`);

  for (const item of newsToTranslate) {
    item.translated = false;
    console.log(`  - "${item.title.substring(0, 50)}..." [保留原文]`);
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
  console.log(`✅ 已保存 ${news.length} 条新闻到 ${outputPath}`);
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
  console.log(`✅ RSS 订阅源已保存到 ${rssPath}`);
}

// ==================== 主函数 ====================
async function main() {
  console.log('🚀 开始抓取 AI Agent 新闻...\n');

  const allNews = [];

  if (CONFIG.sources.hackerNews.enabled) {
    const hnNews = await fetchHackerNews();
    allNews.push(...hnNews);
  }

  if (CONFIG.sources.reddit.enabled) {
    const redditNews = await fetchReddit();
    allNews.push(...redditNews);
  }

  const rssNews = await fetchRSS();
  allNews.push(...rssNews);

  const processedNews = await translateIfNeeded(allNews);
  const finalNews = mergeAndDeduplicate(processedNews);

  saveNews(finalNews);
  generateRSS(finalNews);

  console.log('\n✅ 新闻抓取完成！');

  // 输出分类统计
  const stats = {};
  finalNews.forEach(news => {
    stats[news.categoryName] = (stats[news.categoryName] || 0) + 1;
  });
  console.log('\n📊 分类统计:');
  for (const [cat, count] of Object.entries(stats)) {
    console.log(`  ${cat}: ${count}`);
  }
}

main().catch(console.error);
