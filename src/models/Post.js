const mongoose = require('mongoose');

const PostSchema = new mongoose.Schema({
  board: { type: String, required: true },
  title: { type: String, required: true },
  content: { type: String, required: true },
  authorId: { type: String, required: true },
  authorName: { type: String, required: true },
  images: [{ type: String }],
  commentCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

PostSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Post', PostSchema);
