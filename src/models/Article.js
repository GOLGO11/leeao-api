const mongoose = require('mongoose');

const ArticleSchema = new mongoose.Schema({
  title: { type: String, required: true },
  author: { type: String },
  image: { type: String },
  description: { type: String },
  publishTime: { type: String },
  url: { type: String, required: true, unique: true },
  addedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Article', ArticleSchema);
