const express = require('express');
const router = express.Router();
const multer = require('multer');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
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

    // 返回图片URL
    const imageUrl = `${process.env.R2_PUBLIC_URL}/${fileName}`;

    res.json({ success: true, url: imageUrl, key: fileName });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
