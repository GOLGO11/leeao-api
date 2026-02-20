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
    let metadata = { title: '', description: '', coverImage: '', author: '', publishTime: '' };
    
    try {
      // 对于抖音短链接，需要先获取最终URL
      let finalUrl = url;
      if (source === 'douyin' && url.includes('v.douyin.com')) {
        finalUrl = await getFinalUrl(url);
        console.log('Final Douyin URL:', finalUrl);
      }
      
      metadata = await fetchVideoMetadata(finalUrl);
      console.log('Fetched video metadata:', { 
        title: metadata.title, 
        author: metadata.author,
        publishTime: metadata.publishTime,
        coverImage: metadata.coverImage ? 'yes' : 'no',
        source 
      });
    } catch (e) {
      console.error('获取视频元数据失败:', e);
    }

    const video = new Video({
      url,
      title: metadata.title || getDefaultTitle(source),
      description: metadata.description || '',
      coverImage: metadata.coverImage || '',
      source: source,
      author: metadata.author || '',
      publishTime: metadata.publishTime || ''
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
  const source = detectVideoSource(url);
  
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    },
    redirect: 'follow'
  });

  const html = await response.text();
  
  // 尝试从抖音页面数据中提取完整信息
  if (source === 'douyin') {
    const douyinData = extractDouyinData(html);
    if (douyinData) {
      return douyinData;
    }
  }
  
  // 尝试从B站页面数据中提取完整信息
  if (source === 'bilibili') {
    const bilibiliData = extractBilibiliData(html);
    if (bilibiliData) {
      return bilibiliData;
    }
  }

  return {
    title: extractVideoTitle(html),
    description: extractVideoDescription(html),
    coverImage: extractVideoImage(html),
    author: extractVideoAuthor(html),
    publishTime: extractVideoPublishTime(html)
  };
}

// 从B站页面提取完整数据
function extractBilibiliData(html) {
  // B站新版页面使用 __INITIAL_STATE__
  let match = html.match(/window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]+?\});\s*(?:<\/script>|$)/);
  if (match) {
    try {
      const jsonStr = match[1].replace(/\n/g, '');
      const initialState = JSON.parse(jsonStr);
      console.log('B站 __INITIAL_STATE__ found');

      // 尝试多种路径获取视频数据
      let videoData = initialState?.videoData;

      // 新版B站可能使用不同路径
      if (!videoData && initialState?.videoInfo) {
        videoData = initialState.videoInfo;
      }
      if (!videoData && initialState?.uplayerView) {
        videoData = initialState.uplayerView;
      }

      if (videoData) {
        const result = {
          title: videoData.title || '',
          description: videoData.desc || videoData.description || '',
          coverImage: videoData.pic || videoData.cover || '',
          author: videoData.owner?.name || videoData.author?.name || videoData.up_name || '',
          publishTime: videoData.pubdate ? formatDate(videoData.pubdate * 1000) :
                       (videoData.ptime ? formatDate(videoData.ptime * 1000) : '')
        };
        console.log('B站 metadata:', result);
        return result;
      }
    } catch (e) {
      console.error('Parse __INITIAL_STATE__ error:', e.message);
    }
  }

  // 尝试解析 <script> 标签中的 __playinfo__ 数据
  match = html.match(/__playinfo__\s*=\s*(\{[\s\S]+?\})\s*<\/script>/);
  if (match) {
    try {
      const playInfo = JSON.parse(match[1]);
      const coverImage = playInfo?.data?.cover || '';
      console.log('B站 __playinfo__ found, cover:', !!coverImage);
      if (coverImage) {
        // 如果找到封面图，继续提取其他信息
      }
    } catch (e) {
      console.error('Parse __playinfo__ error:', e.message);
    }
  }

  // 尝试从 og meta 标签提取（最可靠的备用方法）
  const ogTitle = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
  const ogDesc = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i);
  const ogImage = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i);
  const ogVideo = html.match(/<meta[^>]*property=["']og:video["'][^>]*content=["']([^"']+)["']/i);

  // 尝试从视频URL提取封面
  let coverImage = ogImage ? ogImage[1] : '';
  if (!coverImage && ogVideo) {
    // B站封面通常在 og:video:image 或从 og:video 推断
    const ogVideoImage = html.match(/<meta[^>]*property=["']og:video:image["'][^>]*content=["']([^"']+)["']/i);
    coverImage = ogVideoImage ? ogVideoImage[1] : '';
  }

  // 尝试从页面JSON中提取up主信息
  let author = '';
  const authorMatch = html.match(/"owner"\s*:\s*\{\s*"name"\s*:\s*"([^"]+)"/)
    || html.match(/"up_name"\s*:\s*"([^"]+)"/)
    || html.match(/"author"\s*:\s*\{\s*"name"\s*:\s*"([^"]+)"/);
  if (authorMatch) {
    author = decodeHtmlEntities(authorMatch[1]);
  }

  // 尝试提取发布时间
  let publishTime = '';
  const timeMatch = html.match(/"pubdate"\s*:\s*(\d+)/)
    || html.match(/"ptime"\s*:\s*(\d+)/);
  if (timeMatch) {
    publishTime = formatDate(parseInt(timeMatch[1]) * 1000);
  }

  // 从HTML标题提取（B站格式: "标题 - UP主 - 哔哩哔哩"）
  let title = '';
  if (ogTitle) {
    title = decodeHtmlEntities(ogTitle[1]);
  } else {
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) {
      let rawTitle = decodeHtmlEntities(titleMatch[1].trim());
      // 移除 " - 哔哩哔哩" 后缀
      rawTitle = rawTitle.replace(/\s*[-_|—]\s*[^-_|—]*[哔哩哔哩bilibiliB站].*/gi, '');
      // 移除 UP主 名称（通常是最后一个部分）
      const parts = rawTitle.split(/\s*[-_|—]\s*/);
      if (parts.length > 1) {
        // 保留第一部分作为标题，最后部分可能是UP主
        title = parts[0];
        if (!author && parts.length > 1) {
          author = parts[parts.length - 1].trim();
        }
      } else {
        title = rawTitle;
      }
    }
  }

  const description = ogDesc ? decodeHtmlEntities(ogDesc[1]) : '';

  if (title || coverImage || author) {
    return {
      title: title || 'B站视频',
      description,
      coverImage,
      author,
      publishTime
    };
  }

  return null;
}

// 从抖音页面提取完整数据
function extractDouyinData(html) {
  // 辅助函数：解码 Unicode 转义的字符串
  function decodeUnicodeString(str) {
    if (!str) return '';
    return str.replace(/\\u002F/g, '/').replace(/\\u003F/g, '?').replace(/\\u003D/g, '=')
               .replace(/\\u0026/g, '&').replace(/\\u0023/g, '#').replace(/\\u0025/g, '%');
  }

  // 方法1: 尝试解析抖音的 _ROUTER_DATA
  let match = html.match(/window\._ROUTER_DATA\s*=\s*(\{[\s\S]+?\})\s*<\/script>/);
  if (match) {
    try {
      const jsonStr = match[1].replace(/\n/g, '');
      const routerData = JSON.parse(jsonStr);
      const loaderData = routerData?.loaderData;
      console.log('抖音 _ROUTER_DATA found, loaderData:', !!loaderData);

      if (loaderData) {
        for (const key in loaderData) {
          const data = loaderData[key];

          // 视频详情
          if (data?.aweme_detail) {
            const detail = data.aweme_detail;
            console.log('抖音 aweme_detail found:', {
              desc: !!detail.desc,
              cover: !!detail.video?.cover,
              author: !!detail.author?.nickname
            });

            // 获取封面图的多种方式 - 抖音封面通常在 video.cover.url_list 或直接在 cover.url_list
            let coverImage = '';
            const coverList = detail.video?.cover?.url_list || detail.cover?.url_list;
            if (coverList && coverList[0]) {
              coverImage = decodeUnicodeString(coverList[0]);
            }
            if (!coverImage && detail.video?.origin_cover?.url_list?.[0]) {
              coverImage = decodeUnicodeString(detail.video.origin_cover.url_list[0]);
            }
            if (!coverImage && detail.video?.dynamic_cover?.url_list?.[0]) {
              coverImage = decodeUnicodeString(detail.video.dynamic_cover.url_list[0]);
            }
            if (!coverImage && detail.video?.cover) {
              coverImage = detail.video.cover;
            }

            const result = {
              title: detail.desc || '',
              description: detail.desc || '',
              coverImage,
              author: detail.author?.nickname || detail.author?.unique_id || '',
              publishTime: detail.create_time ? formatDate(detail.create_time * 1000) : ''
            };
            console.log('抖音 metadata:', { ...result, coverImage: !!result.coverImage });
            return result;
          }

          // 图文笔记
          if (data?.noteInfo?.note) {
            const note = data.noteInfo.note;
            let coverImage = '';
            const imgList = note.imageList?.[0]?.urlList;
            if (imgList && imgList[0]) {
              coverImage = decodeUnicodeString(imgList[0]);
            }
            return {
              title: note.title || note.desc || '',
              description: note.desc || '',
              coverImage,
              author: note.authorInfo?.nickname || '',
              publishTime: note.createTime ? formatDate(note.createTime) : ''
            };
          }
        }
      }
    } catch (e) {
      console.error('Parse _ROUTER_DATA error:', e.message);
    }
  }

  // 方法2: 从原始 HTML JSON 中提取（更可靠）
  // 提取 desc
  const descMatch = html.match(/"desc"\s*:\s*"([^"]+)"/);
  const title = descMatch ? decodeHtmlEntities(descMatch[1]) : '';

  // 提取 nickname
  const nicknameMatch = html.match(/"nickname"\s*:\s*"([^"]+)"/);
  const author = nicknameMatch ? decodeHtmlEntities(nicknameMatch[1]) : '';

  // 提取封面 - 从 cover.url_list 中提取
  let coverImage = '';
  const coverUrlListMatch = html.match(/"cover"\s*:\s*\{[^}]*"url_list"\s*:\s*\[([^\]]+)\]/);
  if (coverUrlListMatch) {
    // 提取第一个 URL
    const firstUrl = coverUrlListMatch[1].match(/"([^"]+)"/);
    if (firstUrl) {
      coverImage = decodeUnicodeString(firstUrl[1]);
    }
  }

  // 如果没找到，尝试其他格式
  if (!coverImage) {
    const coverUrlMatch = html.match(/"url"\s*:\s*"([^"]*\.webp[^"]*)"/);
    if (coverUrlMatch) {
      coverImage = decodeUnicodeString(coverUrlMatch[1]);
    }
  }

  // 提取创建时间
  const timeMatch = html.match(/"create_time"\s*:\s*(\d+)/);
  const publishTime = timeMatch ? formatDate(parseInt(timeMatch[1]) * 1000) : '';

  if (title || coverImage) {
    console.log('抖音 fallback extraction:', { title: !!title, author: !!author, coverImage: !!coverImage });
    return {
      title: title || '抖音视频',
      description: title,
      coverImage,
      author,
      publishTime
    };
  }

  return null;
}

// 格式化日期
function formatDate(timestamp) {
  if (!timestamp) return '';
  try {
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  } catch (e) {
    return '';
  }
}

// 提取视频标题
function extractVideoTitle(html) {
  // 抖音desc字段
  let match = html.match(/"desc"\s*:\s*"([^"\\]+(?:\\.[^"\\]*)*)"/);
  if (match) {
    let title = decodeHtmlEntities(match[1]);
    if (title.length > 3) return title;
  }
  
  // OG标题
  match = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i);
  if (match) {
    let title = decodeHtmlEntities(match[1]);
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

// 提取视频作者
function extractVideoAuthor(html) {
  // 抖音作者昵称
  let match = html.match(/"nickname"\s*:\s*"([^"\\]+)"/);
  if (match) {
    return decodeHtmlEntities(match[1]);
  }
  
  // 抖音作者ID
  match = html.match(/"unique_id"\s*:\s*"([^"]+)"/);
  if (match) {
    return decodeHtmlEntities(match[1]);
  }
  
  // OG视频作者
  match = html.match(/<meta[^>]*property=["']video:director["'][^>]*content=["']([^"']+)["']/i);
  if (match) {
    return decodeHtmlEntities(match[1]);
  }

  return '';
}

// 提取视频发布时间
function extractVideoPublishTime(html) {
  // 抖音创建时间（时间戳）
  let match = html.match(/"create_time"\s*:\s*(\d+)/);
  if (match) {
    return formatDate(parseInt(match[1]) * 1000);
  }
  
  // 文章发布时间
  match = html.match(/<meta[^>]*property=["']article:published_time["'][^>]*content=["']([^"']+)["']/i);
  if (match) {
    return match[1];
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
