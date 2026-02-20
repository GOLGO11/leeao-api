const mongoose = require('mongoose');

const ArticleSchema = new mongoose.Schema({
  title: { type: String, required: true },
  author: { type: String },
  image: { type: String },
  description: { type: String },
  publishTime: { type: String },
  url: { type: String, required: true, unique: true },
  source: { type: String, default: 'other' }, // 文章来源: wechat, zhihu, toutiao, other
  addedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Article', ArticleSchema);
