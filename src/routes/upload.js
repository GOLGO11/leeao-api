const express = require('express');
const router = express.Router();
const multer = require('multer');
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { authMiddleware } = require('../middleware/auth');

// 配置 multer
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

// R2 配置
const r2Client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
  }
});

// Railway API URL (用于生成图片访问URL)
const RAILWAY_URL = process.env.RAILWAY_STATIC_URL || 'https://leeao-api-production.up.railway.app';

// 图片上传
router.post('/image', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '没有文件' });
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(req.file.mimetype)) {
      return res.status(400).json({ error: '不支持的文件类型' });
    }

    // 生成文件名
    const ext = req.file.mimetype.split('/')[1];
    const fileName = `images/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${ext}`;

    // 上传到 R2
    await r2Client.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: fileName,
      Body: req.file.buffer,
      ContentType: req.file.mimetype
    }));

    // 返回通过Railway代理的图片URL
    const imageUrl = `${RAILWAY_URL}/upload/image/${fileName}`;

    res.json({ success: true, url: imageUrl, key: fileName });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 图片代理访问 - 从R2获取图片并返回
router.get('/image/:key(*)', async (req, res) => {
  try {
    const key = req.params.key;
    
    if (!key || key.includes('..') || key.startsWith('/')) {
      return res.status(400).json({ error: 'Invalid key' });
    }

    // 从R2获取图片
    const command = new GetObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key
    });

    const response = await r2Client.send(command);
    
    // 设置响应头
    res.setHeader('Content-Type', response.ContentType || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=31536000'); // 缓存1年
    res.setHeader('Access-Control-Allow-Origin', '*');

    // 流式传输图片数据
    const stream = response.Body;
    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    res.send(Buffer.concat(chunks));
  } catch (error) {
    console.error('Image proxy error:', error);
    res.status(404).json({ error: '图片不存在' });
  }
});

module.exports = router;
