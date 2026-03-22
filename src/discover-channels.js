#!/usr/bin/env node

/**
 * 新闻渠道探索器
 *
 * 功能：
 * - 定期搜索和发现新的 AI Agent 新闻渠道
 * - 验证 RSS/API 可用性
 * - 更新抓取配置
 *
 * 运行频率：建议每周一次
 */

import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';

const __dirname = path.dirname(new URL(import.meta.url).pathname);

// 探索配置
const CONFIG = {
  configFile: path.join(__dirname, 'fetch-news.js'),
  discoverLog: path.join(__dirname, '../logs/discovery.log'),
  // 待探索的潜在渠道列表
  channelsToExplore: [
    // AI 公司和研究机构
    { name: 'Anthropic Blog', url: 'https://www.anthropic.com/rss', type: 'rss' },
    { name: 'DeepMind Blog', url: 'https://deepmind.google/blog/feed/', type: 'rss' },
    { name: 'Meta AI Blog', url: 'https://ai.meta.com/blog/rss/', type: 'rss' },
    { name: 'Microsoft Research AI', url: 'https://www.microsoft.com/en-us/research/blog/artificial-intelligence/feed/', type: 'rss' },
    { name: 'Stanford HAI', url: 'https://hai.stanford.edu/news.xml', type: 'rss' },
    { name: 'MIT CSAIL', url: 'https://www.csail.mit.edu/rss.xml', type: 'rss' },

    // AI 新闻和媒体
    { name: 'The Verge AI', url: 'https://www.theverge.com/ai-artificial-intelligence/rss/index.xml', type: 'rss' },
    { name: 'TechCrunch AI', url: 'https://techcrunch.com/category/artificial-intelligence/feed/', type: 'rss' },
    { name: 'Wired AI', url: 'https://www.wired.com/feed/tag/ai/latest/rss', type: 'rss' },
    { name: 'Ars Technica AI', url: 'https://arstechnica.com/ai/feed/', type: 'rss' },

    // AI 开发者和社区
    { name: 'LangChain Blog', url: 'https://blog.langchain.dev/rss/', type: 'rss' },
    { name: 'LlamaIndex Blog', url: 'https://blog.llamaindex.ai/feed', type: 'rss' },
    { name: 'Pinecone Blog', url: 'https://www.pinecone.io/blog/rss/', type: 'rss' },
    { name: 'Hugging Face Daily', url: 'https://huggingface.co/papers/rss', type: 'rss' },

    // 中文 AI 媒体
    { name: '机器之心', url: 'https://www.jiqizhixin.com/feed', type: 'rss' },
    { name: '量子位', url: 'https://www.qbitai.com/feed', type: 'rss' },
    { name: '新智元', url: 'https://www.newapi.com/feed', type: 'rss' },
  ],
};

// 日志函数
function log(message) {
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] ${message}\n`;
  console.log(message);

  // 确保日志目录存在
  const logDir = path.dirname(CONFIG.discoverLog);
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  fs.appendFileSync(CONFIG.discoverLog, logLine);
}

// HTTP 请求封装（带超时）
function fetchUrl(url, timeout = 8000) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; AINewsDiscoveryBot/1.0)',
        'Accept': 'application/rss+xml, application/xml, application/atom+xml, */*',
      },
      timeout: timeout,
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          data: data,
          contentType: res.headers['content-type'] || '',
        });
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Timeout after ${timeout}ms`));
    });
  });
}

// 验证 RSS feed 是否有效
async function validateRSS(channel) {
  try {
    log(`  验证 ${channel.name}...`);
    const response = await fetchUrl(channel.url);

    if (response.statusCode !== 200) {
      log(`  ❌ ${channel.name}: HTTP ${response.statusCode}`);
      return { valid: false, reason: `HTTP ${response.statusCode}` };
    }

    // 检查内容是否为 XML/RSS
    const content = response.data.trim();
    const isValidXml = content.startsWith('<?xml') || content.startsWith('<rss') || content.startsWith('<feed');

    if (!isValidXml) {
      log(`  ❌ ${channel.name}: 无效的 RSS 格式`);
      return { valid: false, reason: 'Invalid RSS format' };
    }

    // 检查是否包含有效的 RSS 元素
    const hasItems = /<(item|entry)>/.test(content);
    if (!hasItems) {
      log(`  ❌ ${channel.name}: 没有找到文章条目`);
      return { valid: false, reason: 'No items found' };
    }

    // 统计文章数量
    const itemCount = (content.match(/<(item|entry)>/g) || []).length;
    log(`  ✅ ${channel.name}: 有效，包含 ${itemCount} 条文章`);

    return {
      valid: true,
      itemCount,
      contentType: response.contentType,
    };
  } catch (e) {
    log(`  ❌ ${channel.name}: ${e.message}`);
    return { valid: false, reason: e.message };
  }
}

// 读取当前配置
function readCurrentConfig() {
  try {
    const content = fs.readFileSync(CONFIG.configFile, 'utf-8');
    return content;
  } catch (e) {
    log(`Error reading config: ${e.message}`);
    return '';
  }
}

// 建议新的渠道配置
function generateConfigSnippet(channels) {
  const snippet = channels.map(ch => `    ${ch.name.replace(/\s+/g, '').replace(/^[0-9]/, '_$&')}: {
      url: '${ch.url}',
      enabled: true,
      name: '${ch.name}',
    }`).join(',\n');

  return `  // 新发现的渠道（${new Date().toISOString().split('T')[0]}）
${snippet}`;
}

// 主探索函数
async function exploreChannels() {
  log('========================================');
  log('🔍 开始探索新的新闻渠道');
  log('========================================\n');

  const results = {
    valid: [],
    invalid: [],
    alreadyConfigured: [],
  };

  // 读取当前配置，检查是否已配置
  const currentConfig = readCurrentConfig();

  for (const channel of CONFIG.channelsToExplore) {
    // 检查是否已配置
    if (currentConfig.includes(channel.url)) {
      log(`⊘ 已配置：${channel.name}`);
      results.alreadyConfigured.push(channel);
      continue;
    }

    // 验证渠道
    const validation = await validateRSS(channel);

    if (validation.valid) {
      results.valid.push({ ...channel, ...validation });
    } else {
      results.invalid.push({ ...channel, ...validation });
    }

    // 避免请求过快
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // 输出结果
  log('\n========================================');
  log('📊 探索结果汇总');
  log('========================================');
  log(`✅ 有效渠道：${results.valid.length}`);
  log(`❌ 无效渠道：${results.invalid.length}`);
  log(`⊘ 已配置渠道：${results.alreadyConfigured.length}`);

  // 生成新配置建议
  if (results.valid.length > 0) {
    log('\n📝 建议添加的配置：\n');
    const newConfig = generateConfigSnippet(results.valid);
    log(newConfig);

    // 保存到临时文件
    const suggestionFile = path.join(__dirname, '../data/new_channels_suggestion.txt');
    fs.writeFileSync(suggestionFile, newConfig, 'utf-8');
    log(`\n💾 配置建议已保存到：${suggestionFile}`);
  }

  return results;
}

// 运行
exploreChannels().catch(console.error);
