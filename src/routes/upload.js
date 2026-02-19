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

// Railway 存储桶配置 (S3兼容)
const s3Client = new S3Client({
  region: process.env.AWS_DEFAULT_REGION || 'us-east-1',
  endpoint: process.env.AWS_ENDPOINT_URL,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true,
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || 'leeao-images';

// Railway 项目 URL - 确保包含 https://
let RAILWAY_URL = process.env.RAILWAY_STATIC_URL || 'https://leeao-api-production.up.railway.app';
if (!RAILWAY_URL.startsWith('http')) {
  RAILWAY_URL = 'https://' + RAILWAY_URL;
}

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

    // 上传到 Railway Bucket
    await s3Client.send(new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: fileName,
      Body: req.file.buffer,
      ContentType: req.file.mimetype,
      ACL: 'public-read',
    }));

    // 返回通过Railway代理的图片URL
    const imageUrl = `${RAILWAY_URL}/upload/image/${fileName}`;
    console.log('Upload successful, URL:', imageUrl);

    res.json({ success: true, url: imageUrl, key: fileName });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 图片代理访问 - 从Railway Bucket获取图片并返回
router.get('/image/:key(*)', async (req, res) => {
  try {
    const key = req.params.key;
    
    if (!key || key.includes('..') || key.startsWith('/')) {
      return res.status(400).json({ error: 'Invalid key' });
    }

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
    console.error('Image proxy error:', error);
    res.status(404).json({ error: '图片不存在' });
  }
});

module.exports = router;
