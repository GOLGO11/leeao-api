const express = require('express');
const router = express.Router();
const Article = require('../models/Article');
const fetch = require('node-fetch');

// 获取文章列表
router.get('/', async (req, res) => {
  try {
    const articles = await Article.find().sort({ addedAt: -1 });
    res.json({ articles });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 添加文章 (管理员)
router.post('/add', async (req, res) => {
  try {
    const { url, password, publishTime, author, title, description, image } = req.body;

    if (password !== (process.env.ADMIN_PASSWORD || 'leeao2025')) {
      return res.status(401).json({ error: '未授权' });
    }

    if (!url) {
      return res.status(400).json({ error: 'URL必填' });
    }

    // 检查是否已存在
    const existArticle = await Article.findOne({ url });
    if (existArticle) {
      return res.status(400).json({ error: '文章已存在' });
    }

    // 获取元数据
    let metadata = {};
    try {
      metadata = await fetchMetadata(url);
    } catch (e) {
      console.error('获取元数据失败:', e);
    }

    const article = new Article({
      url,
      title: title || metadata.title,
      author: author || metadata.author,
      image: image || metadata.image,
      description: description || metadata.description,
      publishTime: publishTime || metadata.publishTime
    });
    await article.save();

    res.json({ success: true, article });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 删除文章
router.delete('/:id', async (req, res) => {
  try {
    const { password } = req.body;
    
    if (password !== (process.env.ADMIN_PASSWORD || 'leeao2025')) {
      return res.status(401).json({ error: '未授权' });
    }

    await Article.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取元数据
async function fetchMetadata(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });

  const html = await response.text();

  return {
    title: extractMeta(html, 'og:title') || extractTag(html, 'title'),
    author: extractMeta(html, 'og:article:author'),
    image: extractMeta(html, 'og:image'),
    description: extractMeta(html, 'og:description'),
    publishTime: extractPublishTime(html)
  };
}

function extractMeta(html, property) {
  let match = html.match(new RegExp(`<meta[^>]*property=["']${property}["'][^>]*content=["']([^"']+)["']`, 'i'));
  if (match) return decodeHtmlEntities(match[1]);
  
  match = html.match(new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*property=["']${property}["']`, 'i'));
  if (match) return decodeHtmlEntities(match[1]);
  
  return null;
}

function extractTag(html, tag) {
  const match = html.match(new RegExp(`<${tag}[^>]*>([^<]+)</${tag}>`, 'i'));
  return match ? match[1].trim() : null;
}

function extractPublishTime(html) {
  const match = html.match(/publish_time%22%3A(\d+)/);
  if (match) {
    return new Date(parseInt(match[1]) * 1000).toISOString();
  }
  return null;
}

function decodeHtmlEntities(str) {
  if (!str) return str;
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

module.exports = router;
