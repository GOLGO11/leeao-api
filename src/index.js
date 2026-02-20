const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const communityRoutes = require('./routes/community');
const articleRoutes = require('./routes/articles');
const videoRoutes = require('./routes/videos');
const uploadRoutes = require('./routes/upload');
const User = require('./models/User');

const app = express();

// 中间件
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 连接MongoDB并初始化管理员
const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URL || 'mongodb://localhost:27017/leeao';

async function initializeAdmin() {
  try {
    // 查找管理员用户
    const adminUser = await User.findOne({ username: '爱华山樱' });

    if (adminUser && adminUser.role !== 'admin') {
      // 更新为管理员
      await User.findByIdAndUpdate(adminUser._id, { role: 'admin' });
      console.log('Admin role updated for user: 爱华山樱');
    } else if (adminUser) {
      console.log('Admin already exists: 爱华山樱');
    } else {
      console.log('Admin user not found yet');
    }
  } catch (error) {
    console.error('Init admin error:', error.message);
  }
}

// 连接MongoDB（异步，不阻塞启动）
mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log('MongoDB connected');
    // 初始化管理员
    initializeAdmin();
  })
  .catch(err => console.error('MongoDB connection error:', err));

// 路由
app.use('/auth', authRoutes);
app.use('/community', communityRoutes);
app.use('/articles', articleRoutes);
app.use('/videos', videoRoutes);
app.use('/upload', uploadRoutes);

// 健康检查 - 立即响应，不依赖数据库状态
app.get('/', (req, res) => {
  res.json({
    name: 'Leeao API',
    version: '1.0.0',
    status: 'running',
    db: mongoose.connection.readyState === 1 ? 'connected' : 'connecting'
  });
});

// 错误处理
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message });
});

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`Server running on port ${PORT}`);
});
