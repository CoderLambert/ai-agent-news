#!/bin/bash

# AI Agent News 定时抓取脚本
# 每小时执行一次，抓取最新新闻并翻译

set -e

# 项目目录
PROJECT_DIR="$HOME/ai-news"

echo "=========================================="
echo "📰 AI Agent News 定时抓取"
echo "时间：$(date '+%Y-%m-%d %H:%M:%S')"
echo "=========================================="

# 进入项目目录
cd "$PROJECT_DIR"

# 抓取新闻
echo ""
echo "🚀 开始抓取新闻..."
node src/fetch-news.js

# 翻译新闻
echo ""
echo "🌐 开始翻译新闻..."
node src/translate-news.js

# 完成
echo ""
echo "=========================================="
echo "✅ 抓取和翻译完成！"
echo "=========================================="
