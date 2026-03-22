#!/usr/bin/env node

/**
 * 新闻翻译脚本
 *
 * 使用免费的翻译 API 将非中文新闻翻译为中文
 * 支持多种翻译服务（可配置）
 */

import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';

const __dirname = path.dirname(new URL(import.meta.url).pathname);

// 配置
const CONFIG = {
  dataFile: path.join(__dirname, '../data/news.json'),
  // 翻译服务选择：'libre' (LibreTranslate - 免费开源) | 'mymemory' (免费但有限额)
  translateService: 'mymemory',
  // LibreTranslate 实例地址（可以使用公共实例或自建）
  libreTranslateUrl: 'https://libretranslate.com/translate',
};

// 检测是否包含中文
function containsChinese(text) {
  const chineseRegex = /[\u4e00-\u9fa5]/;
  return chineseRegex.test(text);
}

// HTTP POST 请求
function postRequest(url, data) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const client = urlObj.protocol === 'https:' ? https : http;

    const postData = JSON.stringify(data);
    const options = {
      hostname: urlObj.hostname,
      port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'User-Agent': 'AINewsTranslator/1.0',
      },
    };

    const req = client.request(options, (res) => {
      let responseData = '';
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(responseData));
        } catch (e) {
          resolve({ translatedText: responseData });
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// 使用 LibreTranslate 翻译
async function translateWithLibre(text, sourceLang = 'en', targetLang = 'zh') {
  try {
    const result = await postRequest(CONFIG.libreTranslateUrl, {
      q: text,
      source: sourceLang,
      target: targetLang,
      format: 'text',
    });
    return result.translatedText || text;
  } catch (e) {
    console.error(`LibreTranslate 翻译失败：${e.message}`);
    return text;
  }
}

// 使用 MyMemory 翻译（免费，有每日限额）
async function translateWithMyMemory(text, sourceLang = 'en', targetLang = 'zh') {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${sourceLang}|${targetLang}`;

  return new Promise((resolve, reject) => {
    const client = https.get(url, { headers: { 'User-Agent': 'AINewsTranslator/1.0' }}, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.responseStatus === 200) {
            resolve(result.responseData.translatedText);
          } else {
            console.warn(`MyMemory API 警告：${result.responseDetails}`);
            resolve(text);
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    client.on('error', reject);
  });
}

// 主翻译函数
async function translateText(text, sourceLang = 'en', targetLang = 'zh') {
  if (containsChinese(text)) {
    return text;
  }

  switch (CONFIG.translateService) {
    case 'libre':
      return translateWithLibre(text, sourceLang, targetLang);
    case 'mymemory':
      return translateWithMyMemory(text, sourceLang, targetLang);
    default:
      console.warn(`未知的翻译服务：${CONFIG.translateService}`);
      return text;
  }
}

// 加载新闻数据
function loadNews() {
  if (!fs.existsSync(CONFIG.dataFile)) {
    console.error(`新闻数据文件不存在：${CONFIG.dataFile}`);
    process.exit(1);
  }

  const data = fs.readFileSync(CONFIG.dataFile, 'utf-8');
  return JSON.parse(data);
}

// 保存新闻数据
function saveNews(news) {
  fs.writeFileSync(CONFIG.dataFile, JSON.stringify(news, null, 2), 'utf-8');
}

// 翻译新闻
async function translateNews(force = false) {
  console.log('🔄 开始翻译新闻...\n');

  const news = loadNews();
  let translatedCount = 0;
  let skippedCount = 0;

  for (const item of news) {
    // 如果已经翻译过且不是强制模式，跳过
    if (item.translated && !force) {
      skippedCount++;
      continue;
    }

    // 如果已经是中文，跳过
    if (containsChinese(item.title)) {
      console.log(`⊘ 跳过（中文）：${item.title.substring(0, 40)}...`);
      skippedCount++;
      continue;
    }

    console.log(`📝 翻译：${item.title.substring(0, 40)}...`);

    try {
      // 翻译标题
      const translatedTitle = await translateText(item.title);
      item.title = translatedTitle;

      // 翻译摘要
      if (item.summary && !containsChinese(item.summary)) {
        const translatedSummary = await translateText(item.summary);
        item.summary = translatedSummary;
      }

      item.translated = true;
      item.translatedAt = new Date().toISOString();
      translatedCount++;

      console.log(`  ✅ "${translatedTitle.substring(0, 40)}..."`);

      // 保存进度（每条翻译后保存，避免中断丢失）
      saveNews(news);

      // 避免请求过快（免费 API 通常有限制）
      await sleep(500);

    } catch (e) {
      console.error(`  ❌ 翻译失败：${e.message}`);
    }
  }

  console.log(`\n✅ 翻译完成！`);
  console.log(`   翻译：${translatedCount} 条`);
  console.log(`   跳过：${skippedCount} 条`);
  console.log(`   总计：${news.length} 条`);
}

// 延迟函数
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 主函数
async function main() {
  const force = process.argv.includes('--force');
  await translateNews(force);
}

// 运行
main().catch(console.error);
