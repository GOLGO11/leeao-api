const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const communityRoutes = require('./routes/community');
const articleRoutes = require('./routes/articles');
const uploadRoutes = require('./routes/upload');

const app = express();

// 中间件
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 连接MongoDB
const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URL || 'mongodb://localhost:27017/leeao';
mongoose.connect(MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// 路由
app.use('/auth', authRoutes);
app.use('/community', communityRoutes);
app.use('/articles', articleRoutes);
app.use('/upload', uploadRoutes);

// 健康检查
app.get('/', (req, res) => {
  res.json({
    name: 'Leeao API',
    version: '1.0.0',
    status: 'running'
  });
});

// 错误处理
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
