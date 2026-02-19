const mongoose = require('mongoose');

const CommentSchema = new mongoose.Schema({
  postId: { type: String, required: true },
  content: { type: String, default: '' },
  authorId: { type: String, required: true },
  authorName: { type: String, required: true },
  images: [{ type: String }],
  replyToAuthorId: { type: String },
  replyToAuthorName: { type: String },
  createdAt: { type: Date, default: Date.now }
});

CommentSchema.index({ postId: 1, createdAt: 1 });

module.exports = mongoose.model('Comment', CommentSchema);
