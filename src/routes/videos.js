const express = require('express');
const router = express.Router();
const Video = require('../models/Video');
const fetch = require('node-fetch');

// 获取视频列表
router.get('/', async (req, res) => {
  try {
    const videos = await Video.find({ visible: true }).sort({ order: 1, addedAt: -1 });
    res.json({ videos });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取所有视频（管理员）
router.get('/all', async (req, res) => {
  try {
    const videos = await Video.find().sort({ order: 1, addedAt: -1 });
    res.json({ videos });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 添加视频（管理员） - 只需URL和密码，自动提取元数据
router.post('/add', async (req, res) => {
  try {
    let { url, password } = req.body;

    if (password !== (process.env.ADMIN_PASSWORD || 'leeao2025')) {
      return res.status(401).json({ error: '未授权' });
    }

    if (!url) {
      return res.status(400).json({ error: 'URL必填' });
    }

    // 清理URL（移除分享时附带的多余文字）
    url = cleanShareUrl(url);
    console.log('Cleaned URL:', url);

    // 检查是否已存在
    const existVideo = await Video.findOne({ url });
    if (existVideo) {
      return res.status(400).json({ error: '视频已存在' });
    }

    // 自动检测来源并提取元数据
    const source = detectVideoSource(url);
    let metadata = { title: '', description: '', coverImage: '' };
    
    try {
      // 对于抖音短链接，需要先获取最终URL
      let finalUrl = url;
      if (source === 'douyin' && url.includes('v.douyin.com')) {
        finalUrl = await getFinalUrl(url);
        console.log('Final Douyin URL:', finalUrl);
      }
      
      metadata = await fetchVideoMetadata(finalUrl);
      console.log('Fetched video metadata:', { title: metadata.title, source });
    } catch (e) {
      console.error('获取视频元数据失败:', e);
    }

    const video = new Video({
      url,
      title: metadata.title || getDefaultTitle(source),
      description: metadata.description || '',
      coverImage: metadata.coverImage || '',
      source: source
    });
    await video.save();

    res.json({ success: true, video });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 清理分享链接（移除多余文字）
function cleanShareUrl(url) {
  // 移除首尾空白
  url = url.trim();
  
  // 尝试提取第一个有效的URL
  const urlMatch = url.match(/(https?:\/\/[^\s]+)/i);
  if (urlMatch) {
    url = urlMatch[1];
  }
  
  // 移除URL末尾可能存在的非URL字符
  url = url.replace(/[^\x00-\x7F].*$/, ''); // 移除非ASCII字符
  url = url.replace(/\s+.*$/, ''); // 移除空格后的内容
  
  return url;
}

// 获取最终URL（处理重定向）
async function getFinalUrl(url) {
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15'
      }
    });
    return response.url || url;
  } catch (e) {
    // 如果HEAD失败，尝试GET
    try {
      const response = await fetch(url, {
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15'
        }
      });
      return response.url || url;
    } catch (e2) {
      console.error('Failed to get final URL:', e2);
      return url;
    }
  }
}

// 删除视频（管理员）
router.delete('/:id', async (req, res) => {
  try {
    const { password } = req.body;
    
    if (password !== (process.env.ADMIN_PASSWORD || 'leeao2025')) {
      return res.status(401).json({ error: '未授权' });
    }

    const video = await Video.findByIdAndDelete(req.params.id);
    if (!video) {
      return res.status(404).json({ error: '视频不存在' });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 更新视频排序（管理员）
router.put('/reorder', async (req, res) => {
  try {
    const { orders, password } = req.body;
    
    if (password !== (process.env.ADMIN_PASSWORD || 'leeao2025')) {
      return res.status(401).json({ error: '未授权' });
    }

    if (orders && Array.isArray(orders)) {
      for (const item of orders) {
        await Video.findByIdAndUpdate(item.id, { order: item.order });
      }
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 更新视频可见性（管理员）
router.put('/:id/visibility', async (req, res) => {
  try {
    const { visible, password } = req.body;
    
    if (password !== (process.env.ADMIN_PASSWORD || 'leeao2025')) {
      return res.status(401).json({ error: '未授权' });
    }

    const video = await Video.findByIdAndUpdate(
      req.params.id,
      { visible },
      { new: true }
    );
    if (!video) {
      return res.status(404).json({ error: '视频不存在' });
    }

    res.json({ success: true, video });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ========== 辅助函数 ==========

// 检测视频来源
function detectVideoSource(url) {
  if (url.includes('douyin.com') || url.includes('v.douyin.com')) {
    return 'douyin';
  } else if (url.includes('bilibili.com') || url.includes('b23.tv')) {
    return 'bilibili';
  } else if (url.includes('weixin.qq.com') || url.includes('video.qq.com')) {
    return 'wechat';
  } else if (url.includes('kuaishou.com')) {
    return 'kuaishou';
  } else if (url.includes('ixigua.com')) {
    return 'xigua';
  }
  return 'other';
}

// 获取默认标题
function getDefaultTitle(source) {
  const titles = {
    'douyin': '抖音视频',
    'bilibili': 'B站视频',
    'wechat': '微信视频',
    'kuaishou': '快手视频',
    'xigua': '西瓜视频',
    'other': '视频'
  };
  return titles[source] || '视频';
}

// 获取视频元数据
async function fetchVideoMetadata(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    },
    redirect: 'follow'
  });

  const html = await response.text();

  return {
    title: extractVideoTitle(html),
    description: extractVideoDescription(html),
    coverImage: extractVideoImage(html)
  };
}

// 提取视频标题
function extractVideoTitle(html) {
  // 抖音特定 - 从页面数据中提取
  let match = html.match(/"desc"\s*:\s*"([^"\\]+(?:\\.[^"\\]*)*)"/);
  if (match) {
    let title = decodeHtmlEntities(match[1]);
    if (title.length > 3) return title;
  }
  
  // 抖音新版页面结构
  match = html.match(/window\._ROUTER_DATA\s*=\s*(\{[^<]+\})/);
  if (match) {
    try {
      const routerData = JSON.parse(match[1]);
      const loaderData = routerData?.loaderData;
      if (loaderData) {
        for (const key in loaderData) {
          const data = loaderData[key];
          if (data?.aweme_detail?.desc) {
            return data.aweme_detail.desc;
          }
          if (data?.noteInfo?.note?.title) {
            return data.noteInfo.note.title;
          }
        }
      }
    } catch (e) {}
  }

  // OG标题
  match = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
  if (match) {
    let title = decodeHtmlEntities(match[1]);
    // 清理后缀
    title = title.replace(/\s*[-|·]\s*(抖音|今日头条|哔哩哔哩|bilibili|快手|西瓜视频).*/gi, '');
    if (title.length > 3) return title;
  }

  // HTML标题
  match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  if (match && match[1]) {
    let title = decodeHtmlEntities(match[1].trim());
    title = title.replace(/\s*[-|·]\s*(抖音|今日头条|哔哩哔哩|bilibili|快手|西瓜视频).*/gi, '');
    if (title.length > 3) return title;
  }

  return '';
}

// 提取视频描述
function extractVideoDescription(html) {
  let match = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i);
  if (match) {
    return decodeHtmlEntities(match[1]);
  }

  match = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
  if (match) {
    return decodeHtmlEntities(match[1]);
  }

  return '';
}

// 提取视频封面
function extractVideoImage(html) {
  let match = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i);
  if (match) {
    return match[1];
  }

  match = html.match(/<meta[^>]*property=["']og:video:image["'][^>]*content=["']([^"']+)["']/i);
  if (match) {
    return match[1];
  }

  return '';
}

// HTML实体解码
function decodeHtmlEntities(str) {
  if (!str) return str;
  return str
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&quot;/gi, '"')
    .replace(/&#(\d+);/g, (m, n) => String.fromCharCode(parseInt(n)))
    .replace(/&#x([0-9a-f]+);/gi, (m, h) => String.fromCharCode(parseInt(h, 16)));
}

module.exports = router;
