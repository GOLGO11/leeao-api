const express = require('express');
const router = express.Router();
const Post = require('../models/Post');
const Comment = require('../models/Comment');
const User = require('../models/User');
const { authMiddleware, verifyToken } = require('../middleware/auth');

// 将 MongoDB 文档转换为前端兼容格式
function formatPost(post) {
  const obj = post.toObject ? post.toObject() : post;
  return {
    id: obj._id.toString(),
    _id: obj._id.toString(),
    board: obj.board,
    title: obj.title,
    content: obj.content,
    authorId: obj.authorId,
    authorName: obj.authorName,
    images: obj.images || [],
    commentCount: obj.commentCount || 0,
    createdAt: obj.createdAt
  };
}

function formatComment(comment) {
  const obj = comment.toObject ? comment.toObject() : comment;
  return {
    id: obj._id.toString(),
    _id: obj._id.toString(),
    postId: obj.postId,
    content: obj.content,
    authorId: obj.authorId,
    authorName: obj.authorName,
    images: obj.images || [],
    replyToAuthorId: obj.replyToAuthorId,
    replyToAuthorName: obj.replyToAuthorName,
    createdAt: obj.createdAt
  };
}

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

    res.json({ posts: posts.map(formatPost), page: parseInt(page), pageSize });
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
    res.json({ post: formatPost(post) });
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
      authorId: req.userId.toString(),
      authorName: user.username
    });
    await post.save();

    res.json({ success: true, post: formatPost(post) });
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

    // 获取用户信息检查权限
    const user = await User.findById(req.userId);
    const isAdmin = user && user.role === 'admin';
    const isAuthor = post.authorId === req.userId.toString();

    if (!isAdmin && !isAuthor) {
      return res.status(403).json({ error: '没有权限删除此帖子' });
    }

    await Post.findByIdAndDelete(req.params.id);
    await Comment.deleteMany({ postId: req.params.id });

    console.log(`Post ${req.params.id} deleted by ${user?.username} (${isAdmin ? 'admin' : 'author'})`);

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
    res.json({ comments: comments.map(formatComment) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 创建评论
router.post('/comment', authMiddleware, async (req, res) => {
  try {
    const { postId, content, images, replyToAuthorId, replyToAuthorName } = req.body;

    console.log('createComment request:', {
      userId: req.userId,
      postId,
      content: content ? `(len:${content.length})` : '(empty)',
      imagesCount: images ? images.length : 0
    });

    if (!postId) {
      return res.status(400).json({ error: '帖子ID必填' });
    }

    if (!content && (!images || images.length === 0)) {
      return res.status(400).json({ error: '内容或图片至少需要一个' });
    }

    // 查找用户
    let user;
    try {
      user = await User.findById(req.userId);
    } catch (findError) {
      console.log('Find user error:', findError.message);
      return res.status(401).json({ error: '用户不存在' });
    }

    console.log('Found user:', user ? { id: user._id.toString(), name: user.username } : 'null');

    if (!user) {
      console.log('User not found for id:', req.userId);
      return res.status(401).json({ error: '用户不存在' });
    }

    const comment = new Comment({
      postId,
      content: content || '',
      images: images || [],
      authorId: req.userId.toString(),
      authorName: user.username,
      replyToAuthorId,
      replyToAuthorName
    });
    await comment.save();

    // 更新帖子评论数
    try {
      await Post.findByIdAndUpdate(postId, {
        $inc: { commentCount: 1 }
      });
    } catch (updateError) {
      console.log('Update post error:', updateError.message);
    }

    console.log('Comment created:', comment._id.toString());

    res.json({ success: true, comment: formatComment(comment) });
  } catch (error) {
    console.error('createComment error:', error.message, error.stack);
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

    // 获取用户信息检查权限
    const user = await User.findById(req.userId);
    const isAdmin = user && user.role === 'admin';
    const isAuthor = comment.authorId === req.userId.toString();

    if (!isAdmin && !isAuthor) {
      return res.status(403).json({ error: '没有权限删除此评论' });
    }

    await Comment.findByIdAndDelete(req.params.id);

    // 更新帖子评论数
    try {
      await Post.findByIdAndUpdate(comment.postId, {
        $inc: { commentCount: -1 }
      });
    } catch (e) {
      console.log('Update post count error:', e.message);
    }

    console.log(`Comment ${req.params.id} deleted by ${user?.username} (${isAdmin ? 'admin' : 'author'})`);

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

    res.json({ posts: posts.map(formatPost), total });
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
        const formatted = formatComment(comment);
        return {
          ...formatted,
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
