const express = require('express');
const router = express.Router();
const multer = require('multer');
const crypto = require('crypto');
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const fetch = require('node-fetch');
const { authMiddleware } = require('../middleware/auth');
const { isAllowedExternalImageUrl } = require('../utils/image_proxy');

// 配置 multer
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

// Railway 存储桶配置 (S3兼容)
const s3Config = {
  region: process.env.AWS_DEFAULT_REGION || 'us-east-1',
  endpoint: process.env.AWS_ENDPOINT_URL,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
  // New Railway Buckets use virtual-hosted style. Older buckets can still
  // opt into path style through the AWS_S3_URL_STYLE variable.
  forcePathStyle:
    (process.env.AWS_S3_URL_STYLE || 'virtual').toLowerCase() === 'path',
};

console.log('S3 Config:', {
  region: s3Config.region,
  endpoint: s3Config.endpoint,
  hasCredentials: !!(s3Config.credentials.accessKeyId && s3Config.credentials.secretAccessKey)
});

const s3Client = new S3Client(s3Config);

const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || 'leeao-images';
const MAX_EXTERNAL_IMAGE_BYTES = 10 * 1024 * 1024;

// Railway 项目 URL - 确保包含 https://
let RAILWAY_URL = process.env.RAILWAY_STATIC_URL || 'https://leeao-api-production.up.railway.app';
if (!RAILWAY_URL.startsWith('http')) {
  RAILWAY_URL = 'https://' + RAILWAY_URL;
}

// 图片上传
router.post('/image', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      console.error('Upload error: No file');
      return res.status(400).json({ error: '没有文件' });
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(req.file.mimetype)) {
      console.error('Upload error: Invalid type', req.file.mimetype);
      return res.status(400).json({ error: '不支持的文件类型' });
    }

    // 生成文件名
    const ext = req.file.mimetype.split('/')[1];
    const fileName = `images/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${ext}`;

    console.log('Uploading to bucket:', BUCKET_NAME, 'key:', fileName);

    // 上传到 Railway Bucket
    const uploadParams = {
      Bucket: BUCKET_NAME,
      Key: fileName,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
    };

    await s3Client.send(new PutObjectCommand(uploadParams));

    // 返回通过Railway代理的图片URL
    const imageUrl = `${RAILWAY_URL}/upload/image/${fileName}`;
    console.log('Upload successful, URL:', imageUrl);

    res.json({ success: true, url: imageUrl, key: fileName });
  } catch (error) {
    console.error('Upload error:', error.message, error.stack);
    res.status(500).json({ error: error.message });
  }
});

// 代理并缓存受支持的第三方封面，避免客户端直接访问境外图片 CDN。
router.get('/external', async (req, res) => {
  const imageUrl = typeof req.query.url === 'string' ? req.query.url : '';
  if (!isAllowedExternalImageUrl(imageUrl)) {
    return res.status(400).json({ error: '不支持的图片地址' });
  }

  const cacheKey = `images/external/${crypto
    .createHash('sha256')
    .update(imageUrl)
    .digest('hex')}`;

  try {
    const cached = await s3Client.send(new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: cacheKey,
    }));
    return sendImageResponse(res, cached.Body, cached.ContentType);
  } catch (error) {
    console.log('External image cache miss:', error.name || error.message);
  }

  try {
    const source = new URL(imageUrl);
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
        Referer: source.hostname.includes('douyin')
          ? 'https://www.douyin.com/'
          : source.hostname.includes('bilibili') || source.hostname.includes('hdslb')
              ? 'https://www.bilibili.com/'
              : 'https://mp.weixin.qq.com/',
      },
      timeout: 15000,
    });

    if (!response.ok) {
      return res.status(502).json({ error: `图片源返回 ${response.status}` });
    }

    const contentType = (response.headers.get('content-type') || '').split(';')[0];
    if (!contentType.startsWith('image/')) {
      return res.status(502).json({ error: '图片源返回的不是图片' });
    }

    const contentLength = Number(response.headers.get('content-length') || 0);
    if (contentLength > MAX_EXTERNAL_IMAGE_BYTES) {
      return res.status(413).json({ error: '图片过大' });
    }

    const chunks = [];
    let totalBytes = 0;
    for await (const chunk of response.body) {
      totalBytes += chunk.length;
      if (totalBytes > MAX_EXTERNAL_IMAGE_BYTES) {
        return res.status(413).json({ error: '图片过大' });
      }
      chunks.push(chunk);
    }
    const imageBuffer = Buffer.concat(chunks);

    try {
      await s3Client.send(new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: cacheKey,
        Body: imageBuffer,
        ContentType: contentType,
      }));
    } catch (error) {
      console.error('External image cache write failed:', error.message);
    }

    return sendImageResponse(res, imageBuffer, contentType);
  } catch (error) {
    console.error('External image proxy failed:', error.message);
    return res.status(502).json({ error: '图片源暂时无法访问' });
  }
});

// 图片代理访问 - 从Railway Bucket获取图片并返回
router.get('/image/:key(*)', async (req, res) => {
  try {
    const key = req.params.key;
    
    if (!key || key.includes('..') || key.startsWith('/')) {
      return res.status(400).json({ error: 'Invalid key' });
    }

    console.log('Fetching image:', key);

    // 从Railway Bucket获取图片
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key
    });

    const response = await s3Client.send(command);
    
    // 设置响应头
    res.setHeader('Content-Type', response.ContentType || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=31536000');
    res.setHeader('Access-Control-Allow-Origin', '*');

    // 流式传输图片数据
    const stream = response.Body;
    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    res.send(Buffer.concat(chunks));
  } catch (error) {
    console.error('Image proxy error:', error.message);
    res.status(404).json({ error: '图片不存在' });
  }
});

function sendImageResponse(res, body, contentType) {
  res.setHeader('Content-Type', contentType || 'image/jpeg');
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (Buffer.isBuffer(body)) {
    return res.send(body);
  }
  return body.pipe(res);
}

module.exports = router;
