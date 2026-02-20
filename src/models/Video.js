const mongoose = require('mongoose');

const VideoSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  // 微信视频号链接
  url: {
    type: String,
    required: true
  },
  // 封面图片URL
  coverImage: {
    type: String,
    default: ''
  },
  // 视频来源类型
  source: {
    type: String,
    enum: ['wechat', 'bilibili', 'other'],
    default: 'wechat'
  },
  // 排序权重
  order: {
    type: Number,
    default: 0
  },
  // 是否显示
  visible: {
    type: Boolean,
    default: true
  },
  addedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Video', VideoSchema);
