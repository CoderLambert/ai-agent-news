#!/bin/bash

# 安装 AI Agent News 定时任务到系统 crontab
# 运行此脚本将自动配置每小时执行的任务

set -e

PROJECT_DIR="$HOME/ai-news"
CRON_FILE="/tmp/ai-news-cron-$$.txt"

echo "🔧 正在配置 AI Agent News 定时任务..."

# 创建日志目录
mkdir -p "$PROJECT_DIR/logs"

# 备份现有 crontab
crontab -l > "$CRON_FILE.bak" 2>/dev/null || true

# 添加新任务到 crontab
cat >> "$CRON_FILE" << 'EOF'
# AI Agent News - 每小时自动抓取新闻
# 在每小时的第 10 分钟执行（避免与其他任务冲突）
10 * * * * cd /home/lambert/ai-news && /usr/bin/node src/fetch-news.js >> /home/lambert/ai-news/logs/cron.log 2>&1
15 * * * * cd /home/lambert/ai-news && /usr/bin/node src/translate-news.js >> /home/lambert/ai-news/logs/cron.log 2>&1
EOF

# 合并 crontab
if [ -f "$CRON_FILE.bak" ]; then
  cat "$CRON_FILE.bak" "$CRON_FILE" | crontab -
else
  crontab "$CRON_FILE"
fi

# 清理临时文件
rm -f "$CRON_FILE" "$CRON_FILE.bak"

echo ""
echo "✅ 定时任务已安装！"
echo ""
echo "📋 当前 crontab 内容:"
crontab -l
echo ""
echo "📝 日志文件位置：$PROJECT_DIR/logs/cron.log"
echo ""
echo "💡 提示："
echo "   - 查看日志：tail -f $PROJECT_DIR/logs/cron.log"
echo "   - 移除任务：crontab -e 然后删除相关行"
echo "   - 手动测试：$PROJECT_DIR/scripts/update-news.sh"
