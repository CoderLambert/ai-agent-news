---
outline: deep
---

# 最新新闻

<script setup>
import { ref, computed, onMounted } from 'vue'

const newsList = ref([])
const selectedCategory = ref('all')
const searchQuery = ref('')

// 分类定义
const categories = [
  { key: 'all', label: '全部', color: '#3b82f6' },
  { key: 'company', label: '公司动态', color: '#8b5cf6' },
  { key: 'technology', label: '技术进展', color: '#06b6d4' },
  { key: 'product', label: '产品发布', color: '#10b981' },
  { key: 'research', label: '研究论文', color: '#f59e0b' },
  { key: 'application', label: '应用案例', color: '#ec4899' },
  { key: 'safety', label: '安全伦理', color: '#ef4444' },
  { key: 'opinion', label: '行业观点', color: '#6b7280' },
  { key: 'other', label: '其他', color: '#9ca3af' },
]

// 在客户端加载数据
onMounted(() => {
  fetch('/data/news.json')
    .then(res => res.json())
    .then(data => {
      newsList.value = data
    })
    .catch(err => {
      console.error('加载新闻数据失败:', err)
    })
})

// 按分类和搜索过滤
const filteredNews = computed(() => {
  return newsList.value.filter(news => {
    const matchCategory = selectedCategory.value === 'all' || news.category === selectedCategory.value
    const matchSearch = searchQuery.value === '' ||
      news.title.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      news.summary.toLowerCase().includes(searchQuery.value.toLowerCase())
    return matchCategory && matchSearch
  })
})

// 分类统计
const categoryStats = computed(() => {
  const stats = {}
  categories.forEach(cat => { stats[cat.key] = 0 })
  newsList.value.forEach(news => {
    if (news.category) stats[news.category]++
  })
  return stats
})

const selectCategory = (key) => {
  selectedCategory.value = key
}
</script>

<div v-if="newsList.length === 0" style="padding: 40px; text-align: center; color: #666;">
  <p>暂无新闻数据，请稍后再来...</p>
  <p style="margin-top: 1rem; font-size: 0.875rem;">首次加载可能需要等待抓取脚本运行</p>
</div>

<div v-else>
  <!-- 搜索框 -->
  <div style="margin-bottom: 1.5rem;">
    <input
      v-model="searchQuery"
      type="text"
      placeholder="搜索新闻标题或内容..."
      style="width: 100%; padding: 0.75rem 1rem; border: 1px solid var(--vp-c-divider); border-radius: 8px; font-size: 0.875rem; background: var(--vp-c-bg); color: var(--vp-c-text-1);"
    />
  </div>

  <!-- 分类按钮 -->
  <div style="display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1.5rem;">
    <button
      v-for="cat in categories"
      :key="cat.key"
      @click="selectCategory(cat.key)"
      :style="{
        padding: '0.5rem 1rem',
        border: 'none',
        borderRadius: '9999px',
        cursor: 'pointer',
        fontSize: '0.875rem',
        fontWeight: selectedCategory === cat.key ? '600' : '400',
        background: selectedCategory === cat.key ? cat.color : 'var(--vp-c-bg-soft)',
        color: selectedCategory === cat.key ? '#fff' : 'var(--vp-c-text-2)',
        transition: 'all 0.2s',
      }"
    >
      {{ cat.label }} <span style="opacity: 0.7; font-size: 0.75rem;">({{ categoryStats[cat.key] || 0 }})</span>
    </button>
  </div>

  <!-- 新闻列表 -->
  <div class="news-container">
    <article v-for="news in filteredNews" :key="news.id" class="news-card">
      <div class="news-category" :style="{ background: categories.find(c => c.key === news.category)?.color || '#9ca3af' }">
        {{ news.categoryName || '其他' }}
      </div>
      <h2 class="news-title">
        <a :href="news.originalUrl" target="_blank" rel="noopener">
          {{ news.title }}
        </a>
      </h2>
      <div class="news-meta">
        <span class="news-source">{{ news.source }}</span>
        <span class="news-date">{{ news.date }}</span>
        <span v-if="news.translated" class="news-translated">[已翻译]</span>
      </div>
      <p class="news-summary">{{ news.summary.replace(/<[^>]+>/g, '').substring(0, 200) }}...</p>
      <div class="news-actions">
        <a :href="news.originalUrl" target="_blank" rel="noopener" class="read-more">阅读原文 →</a>
      </div>
    </article>

    <div v-if="filteredNews.length === 0" style="padding: 40px; text-align: center; color: #666;">
      <p>该分类下暂无新闻</p>
    </div>
  </div>
</div>

<style scoped>
.news-container {
  max-width: 960px;
  margin: 0 auto;
  padding: 2rem;
}

.news-card {
  background: var(--vp-c-bg-soft);
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
  border: 1px solid var(--vp-c-divider);
}

.news-title {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 0.75rem;
}

.news-title a {
  color: var(--vp-c-text-1);
  text-decoration: none;
}

.news-title a:hover {
  color: var(--vp-c-brand);
}

.news-meta {
  display: flex;
  gap: 1rem;
  font-size: 0.875rem;
  color: var(--vp-c-text-2);
  margin-bottom: 1rem;
  flex-wrap: wrap;
}

.news-category {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 600;
  color: #fff;
  margin-bottom: 0.75rem;
}

.news-source {
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand);
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-weight: 500;
}

.news-translated {
  background: #fef3c7;
  color: #92400e;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
}

.news-summary {
  line-height: 1.7;
  color: var(--vp-c-text-2);
  margin-bottom: 1rem;
}

.news-actions {
  display: flex;
  gap: 1rem;
}

.read-more {
  color: var(--vp-c-brand);
  text-decoration: none;
  font-weight: 500;
}

.read-more:hover {
  text-decoration: underline;
}

/* 移动端响应式样式 */
@media (max-width: 768px) {
  .news-container {
    padding: 1rem;
  }

  .news-card {
    padding: 1.25rem;
    margin-bottom: 1rem;
    border-radius: 10px;
  }

  .news-title {
    font-size: 1.125rem;
    margin-bottom: 0.625rem;
  }

  .news-meta {
    gap: 0.75rem;
    font-size: 0.8125rem;
  }

  .news-summary {
    font-size: 0.9375rem;
    line-height: 1.6;
  }

  /* 搜索框移动端优化 */
  input[type="text"] {
    padding: 0.875rem 1rem;
    font-size: 1rem !important; /* 防止 iOS 自动缩放 */
  }
}

@media (max-width: 640px) {
  .news-container {
    padding: 0.75rem;
  }

  .news-card {
    padding: 1rem;
    border-radius: 8px;
  }

  .news-title {
    font-size: 1rem;
    word-break: break-word;
  }

  .news-category {
    padding: 0.2rem 0.625rem;
    font-size: 0.7rem;
  }

  .news-meta {
    gap: 0.5rem;
    font-size: 0.75rem;
  }

  .news-source,
  .news-translated {
    padding: 0.1875rem 0.375rem;
    font-size: 0.7rem;
  }

  .news-summary {
    font-size: 0.875rem;
    line-height: 1.6;
  }

  /* 阅读原文按钮优化 */
  .read-more {
    display: inline-block;
    padding: 0.5rem 0.75rem;
    background: var(--vp-c-brand-soft);
    border-radius: 6px;
    min-height: 44px; /* 触摸友好 */
    line-height: 1.4;
  }
}

/* 移动端分类按钮滚动 */
@media (max-width: 640px) {
  /* 分类容器改为可滚动 */
  div[style*="display: flex"]:has(button) {
    overflow-x: auto;
    flex-wrap: nowrap;
    -webkit-overflow-scrolling: touch;
    padding-bottom: 0.5rem;
    margin-bottom: 1rem;
    scrollbar-width: none; /* Firefox 隐藏滚动条 */
  }

  div[style*="display: flex"]:has(button)::-webkit-scrollbar {
    display: none; /* Chrome/Safari 隐藏滚动条 */
  }

  /* 分类按钮触摸优化 */
  button[style*="border-radius: 9999px"] {
    min-height: 44px; /* 触摸区域至少 44px */
    min-width: 44px;
    padding: 0.5rem 0.875rem;
    flex-shrink: 0; /* 防止按钮被压缩 */
  }
}

/* 确保触摸设备友好的点击区域 */
@media (pointer: coarse) {
  button {
    min-height: 44px;
    min-width: 44px;
  }

  a.read-more {
    min-height: 44px;
    display: inline-flex;
    align-items: center;
  }
}
</style>
