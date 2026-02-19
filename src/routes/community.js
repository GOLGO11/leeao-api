const express = require('express');
const router = express.Router();
const Post = require('../models/Post');
const Comment = require('../models/Comment');
const User = require('../models/User');
const { authMiddleware, verifyToken } = require('../middleware/auth');

// 获取帖子列表
router.get('/posts', async (req, res) => {
  try {
    const { board = 'all', page = 1 } = req.query;
    const pageSize = 20;
    const skip = (page - 1) * pageSize;

    const query = board === 'all' ? {} : { board };
    const posts = await Post.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize);

    res.json({ posts, page: parseInt(page), pageSize });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取帖子详情
router.get('/post/:id', async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ error: '帖子不存在' });
    }
    res.json({ post });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 创建帖子
router.post('/post', authMiddleware, async (req, res) => {
  try {
    const { board, title, content, images } = req.body;

    if (!board || !title || !content) {
      return res.status(400).json({ error: '版块、标题和内容必填' });
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(401).json({ error: '用户不存在' });
    }

    const post = new Post({
      board,
      title,
      content,
      images: images || [],
      authorId: req.userId,
      authorName: user.username
    });
    await post.save();

    res.json({ success: true, post });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 删除帖子
router.delete('/post/:id', authMiddleware, async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ error: '帖子不存在' });
    }

    if (post.authorId !== req.userId) {
      return res.status(403).json({ error: '只能删除自己的帖子' });
    }

    await Post.findByIdAndDelete(req.params.id);
    await Comment.deleteMany({ postId: req.params.id });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取评论列表
router.get('/comments/:postId', async (req, res) => {
  try {
    const comments = await Comment.find({ postId: req.params.postId })
      .sort({ createdAt: 1 });
    res.json({ comments });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 创建评论
router.post('/comment', authMiddleware, async (req, res) => {
  try {
    const { postId, content, images, replyToAuthorId, replyToAuthorName } = req.body;

    if (!postId) {
      return res.status(400).json({ error: '帖子ID必填' });
    }

    if (!content && (!images || images.length === 0)) {
      return res.status(400).json({ error: '内容或图片至少需要一个' });
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(401).json({ error: '用户不存在' });
    }

    const comment = new Comment({
      postId,
      content: content || '',
      images: images || [],
      authorId: req.userId,
      authorName: user.username,
      replyToAuthorId,
      replyToAuthorName
    });
    await comment.save();

    // 更新帖子评论数
    await Post.findByIdAndUpdate(postId, {
      $inc: { commentCount: 1 }
    });

    res.json({ success: true, comment });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 删除评论
router.delete('/comment/:id', authMiddleware, async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) {
      return res.status(404).json({ error: '评论不存在' });
    }

    if (comment.authorId !== req.userId) {
      return res.status(403).json({ error: '只能删除自己的评论' });
    }

    await Comment.findByIdAndDelete(req.params.id);

    // 更新帖子评论数
    await Post.findByIdAndUpdate(comment.postId, {
      $inc: { commentCount: -1 }
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取用户的帖子
router.get('/user/:userId/posts', async (req, res) => {
  try {
    const posts = await Post.find({ authorId: req.params.userId })
      .sort({ createdAt: -1 })
      .limit(10);

    const total = await Post.countDocuments({ authorId: req.params.userId });

    res.json({ posts, total });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取用户的评论
router.get('/user/:userId/comments', async (req, res) => {
  try {
    const comments = await Comment.find({ authorId: req.params.userId })
      .sort({ createdAt: -1 })
      .limit(10);

    // 获取评论对应的帖子标题
    const commentsWithPostTitle = await Promise.all(
      comments.map(async (comment) => {
        const post = await Post.findById(comment.postId);
        return {
          ...comment.toObject(),
          postTitle: post ? post.title : '未知帖子'
        };
      })
    );

    const total = await Comment.countDocuments({ authorId: req.params.userId });

    res.json({ comments: commentsWithPostTitle, total });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
