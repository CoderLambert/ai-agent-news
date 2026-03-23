import { defineConfig } from 'vitepress'

export default defineConfig({
  lang: 'zh-CN',
  title: 'AI Agent News',
  description: '最新的 AI Agent 相关资讯',
  lastUpdated: true,
  cleanUrls: true,

  head: [
    ['meta', { name: 'theme-color', content: '#3eaf7c' }],
    ['meta', { name: 'og:type', content: 'website' }],
    ['meta', { name: 'og:locale', content: 'zh_CN' }],
  ],

  themeConfig: {
    logo: { src: '/logo.svg', alt: 'AI Agent News' },

    nav: [
      { text: '首页', link: '/' },
      { text: '新闻列表', link: '/news/' },
      { text: '关于', link: '/about' },
      { text: '开发日志', link: '/dev-log/' },
    ],

    sidebar: {
      '/news/': [
        {
          text: '最新文章',
          items: [],
        },
      ],
      '/dev-log/': [
        {
          text: '开发日志',
          items: [],
        },
      ],
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/CoderLambert/ai-agent-news' },
    ],

    footer: {
      message: '每小时自动更新 | AI Agent News',
      copyright: 'Copyright © 2026',
    },

    search: {
      provider: 'local',
      options: {
        locales: {
          zh: {
            translations: {
              button: {
                buttonText: '搜索',
                buttonAriaLabel: '搜索文档',
              },
              modal: {
                noResultsText: '无法找到相关结果',
                resetButtonTitle: '清除查询条件',
                footer: {
                  selectText: '选择',
                  navigateText: '切换',
                },
              },
            },
          },
        },
      },
    },
  },

  locales: {
    root: {
      label: '简体中文',
      lang: 'zh',
    },
  },
})
