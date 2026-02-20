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

    if (password !== (process.env.ADMIN_PASSWORD || 'leeao1935')) {
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
      console.log('Fetched metadata:', {
        title: metadata.title,
        author: metadata.author,
        publishTime: metadata.publishTime
      });
    } catch (e) {
      console.error('获取元数据失败:', e);
    }

    const article = new Article({
      url,
      title: title || metadata.title,
      author: author || metadata.author,
      image: image || metadata.image,
      description: description || metadata.description,
      publishTime: publishTime || metadata.publishTime,
      source: detectSource(url)
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

    if (password !== (process.env.ADMIN_PASSWORD || 'leeao1935')) {
      return res.status(401).json({ error: '未授权' });
    }

    const id = req.params.id;
    let article;

    // 尝试用 MongoDB _id 查找
    if (id.length === 24) {
      article = await Article.findByIdAndDelete(id);
    }

    // 如果没找到，尝试用 URL 中的 ID 查找
    if (!article) {
      const fullUrl = `https://mp.weixin.qq.com/s/${id}`;
      article = await Article.findOneAndDelete({ url: fullUrl });
    }

    if (!article) {
      return res.status(404).json({ error: '文章不存在' });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 删除文章（POST方式，兼容前端）
router.post('/:id/delete', async (req, res) => {
  try {
    const { password } = req.body;

    if (password !== (process.env.ADMIN_PASSWORD || 'leeao1935')) {
      return res.status(401).json({ error: '未授权' });
    }

    const id = req.params.id;
    let article;

    // 尝试用 MongoDB _id 查找
    if (id.length === 24) {
      article = await Article.findByIdAndDelete(id);
    }

    // 如果没找到，尝试用 URL 中的 ID 查找
    if (!article) {
      const fullUrl = `https://mp.weixin.qq.com/s/${id}`;
      article = await Article.findOneAndDelete({ url: fullUrl });
    }

    if (!article) {
      return res.status(404).json({ error: '文章不存在' });
    }

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
  return match ? decodeHtmlEntities(match[1].trim()) : null;
}

function extractPublishTime(html) {
  // 方法1: publish_time 时间戳
  let match = html.match(/publish_time%22%3A(\d+)/);
  if (match) {
    const timestamp = parseInt(match[1]);
    console.log('Found publish_time timestamp:', timestamp);
    return new Date(timestamp * 1000).toISOString();
  }

  // 方法2: create_time 时间戳
  match = html.match(/create_time["']?\s*[:=]\s*["']?(\d{10})/);
  if (match) {
    const timestamp = parseInt(match[1]);
    console.log('Found create_time timestamp:', timestamp);
    return new Date(timestamp * 1000).toISOString();
  }

  // 方法3: 时间戳格式 (13位毫秒)
  match = html.match(/"create_time":(\d{13})/);
  if (match) {
    const timestamp = parseInt(match[1]);
    console.log('Found create_time ms timestamp:', timestamp);
    return new Date(timestamp).toISOString();
  }

  // 方法4: 日期格式 yyyy-mm-dd 或 yyyy/mm/dd
  match = html.match(/(\d{4})[-/年](\d{1,2})[-/月](\d{1,2})/);
  if (match) {
    const year = match[1];
    const month = match[2].padStart(2, '0');
    const day = match[3].padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    console.log('Found date format:', dateStr);
    return dateStr;
  }

  // 方法5: 中文日期格式
  match = html.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (match) {
    const year = match[1];
    const month = match[2].padStart(2, '0');
    const day = match[3].padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    console.log('Found Chinese date format:', dateStr);
    return dateStr;
  }

  console.log('No publish time found');
  return null;
}

function decodeHtmlEntities(str) {
  if (!str) return str;
  
  // 先解码常见的 HTML 实体
  let result = str
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&copy;/gi, '©')
    .replace(/&reg;/gi, '®');
  
  // 解码引号 (多种格式)
  result = result
    .replace(/&quot;/gi, '"')
    .replace(/&#34;/gi, '"')
    .replace(/&#x22;/gi, '"')
    .replace(/\\x26quot;/gi, '"')  // 微信的双重转义
    .replace(/\\x26/gi, '&');     // 通用双重转义
  
  // 解码单引号
  result = result
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'");
  
  // 解码其他数字实体
  result = result.replace(/&#(\d+);/g, (match, num) => {
    return String.fromCharCode(parseInt(num));
  });
  
  // 解码十六进制实体
  result = result.replace(/&#x([0-9a-f]+);/gi, (match, hex) => {
    return String.fromCharCode(parseInt(hex, 16));
  });
  
  return result;
}

// 检测文章来源
function detectSource(url) {
  if (!url) return 'other';
  const lowerUrl = url.toLowerCase();

  if (lowerUrl.includes('mp.weixin.qq.com')) return 'wechat';
  if (lowerUrl.includes('zhihu.com')) return 'zhihu';
  if (lowerUrl.includes('toutiao.com') || lowerUrl.includes('toutiao.cn')) return 'toutiao';
  if (lowerUrl.includes('jianshu.com')) return 'jianshu';
  if (lowerUrl.includes('csdn.net')) return 'csdn';
  if (lowerUrl.includes('juejin.cn')) return 'juejin';
  if (lowerUrl.includes('bilibili.com')) return 'bilibili';
  if (lowerUrl.includes('sspai.com')) return 'sspai';

  return 'other';
}

module.exports = router;
