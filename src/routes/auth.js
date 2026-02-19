const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { hashPassword, generateToken } = require('../middleware/auth');

// 注册
router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码必填' });
    }

    if (username.length < 2 || username.length > 20) {
      return res.status(400).json({ error: '用户名需要2-20个字符' });
    }

    if (password.length < 4) {
      return res.status(400).json({ error: '密码至少4个字符' });
    }

    // 检查用户名是否存在
    const existUser = await User.findOne({ username });
    if (existUser) {
      return res.status(400).json({ error: '用户名已存在' });
    }

    // 创建用户
    const hashedPassword = await hashPassword(password);
    const user = new User({
      username,
      password: hashedPassword
    });
    await user.save();

    // 生成token
    const token = generateToken(user._id.toString());

    res.json({
      success: true,
      token,
      user: { id: user._id.toString(), username: user.username, createdAt: user.createdAt }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 登录
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: '用户名和密码必填' });
    }

    const user = await User.findOne({ username });
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }

    const hashedPassword = await hashPassword(password);
    if (user.password !== hashedPassword) {
      return res.status(401).json({ error: '密码错误' });
    }

    const token = generateToken(user._id.toString());

    res.json({
      success: true,
      token,
      user: { id: user._id, username: user.username }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
