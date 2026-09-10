const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();

const { authMiddleware, verifyToken } = require('../middleware/auth');
const Project = require('../models/Project');
const ProjectParticipation = require('../models/ProjectParticipation');
const User = require('../models/User');

const PROJECT_TYPES = new Set(['collaboration', 'personal']);

function isObjectId(value) {
  return mongoose.Types.ObjectId.isValid(value);
}

function formatProject(project, options = {}) {
  return {
    id: project._id.toString(),
    title: project.title,
    type: project.type,
    description: project.description,
    coverImage: project.coverImage || '',
    isPublished: project.isPublished,
    participationOpen: project.participationOpen,
    isCompleted: project.type === 'collaboration' && project.isCompleted === true,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    participantCount: options.participantCount || 0,
    completedParticipantCount: options.completedParticipantCount || 0,
    isParticipating: options.isParticipating === true,
    isParticipationCompleted: options.isParticipationCompleted === true,
    joinedAt: options.joinedAt || null,
    completedAt: options.completedAt || null,
  };
}

function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const userId = verifyToken(authHeader.substring(7));
  if (userId) {
    req.userId = userId;
  }
  return next();
}

async function requireAdmin(req, res, next) {
  try {
    const user = await User.findById(req.userId);
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: '需要管理员权限' });
    }
    req.currentUser = user;
    return next();
  } catch (error) {
    return res.status(401).json({ error: '用户不存在' });
  }
}

async function projectStats(projectIds) {
  if (projectIds.length === 0) {
    return new Map();
  }

  const stats = await ProjectParticipation.aggregate([
    { $match: { projectId: { $in: projectIds } } },
    {
      $group: {
        _id: '$projectId',
        participantCount: { $sum: 1 },
        completedParticipantCount: {
          $sum: { $cond: [{ $eq: ['$isCompleted', true] }, 1, 0] },
        },
      },
    },
  ]);

  return new Map(
    stats.map((item) => [item._id.toString(), item]),
  );
}

async function userParticipations(userId, projectIds) {
  if (!userId || projectIds.length === 0 || !isObjectId(userId)) {
    return new Map();
  }

  const participations = await ProjectParticipation.find({
    userId,
    projectId: { $in: projectIds },
  }).select('projectId joinedAt isCompleted completedAt');

  return new Map(
    participations.map((item) => [item.projectId.toString(), item]),
  );
}

function readProjectPayload(body, { creating = false } = {}) {
  const payload = {};

  if (creating || Object.prototype.hasOwnProperty.call(body, 'title')) {
    const title = (body.title || '').toString().trim();
    if (!title) {
      return { error: '项目标题不能为空' };
    }
    if (title.length > 120) {
      return { error: '项目标题不能超过120个字符' };
    }
    payload.title = title;
  }

  if (creating || Object.prototype.hasOwnProperty.call(body, 'type')) {
    const type = (body.type || '').toString();
    if (!PROJECT_TYPES.has(type)) {
      return { error: '项目类别无效' };
    }
    payload.type = type;
  }

  if (creating || Object.prototype.hasOwnProperty.call(body, 'description')) {
    const description = (body.description || '').toString().trim();
    if (!description) {
      return { error: '项目说明不能为空' };
    }
    if (description.length > 5000) {
      return { error: '项目说明不能超过5000个字符' };
    }
    payload.description = description;
  }

  if (Object.prototype.hasOwnProperty.call(body, 'coverImage')) {
    const coverImage = (body.coverImage || '').toString().trim();
    if (coverImage.length > 2048) {
      return { error: '封面地址不能超过2048个字符' };
    }
    payload.coverImage = coverImage;
  }

  if (Object.prototype.hasOwnProperty.call(body, 'isPublished')) {
    if (typeof body.isPublished !== 'boolean') {
      return { error: '发布状态格式无效' };
    }
    payload.isPublished = body.isPublished;
  }

  if (Object.prototype.hasOwnProperty.call(body, 'participationOpen')) {
    if (typeof body.participationOpen !== 'boolean') {
      return { error: '参与状态格式无效' };
    }
    payload.participationOpen = body.participationOpen;
  }

  if (Object.prototype.hasOwnProperty.call(body, 'isCompleted')) {
    if (typeof body.isCompleted !== 'boolean') {
      return { error: '完成状态格式无效' };
    }
    payload.isCompleted = body.isCompleted;
  }

  return { payload };
}

async function findVisibleProject(projectId, userId) {
  if (!isObjectId(projectId)) {
    return null;
  }

  const project = await Project.findById(projectId);
  if (!project || project.isPublished) {
    return project;
  }

  if (!userId || !isObjectId(userId)) {
    return null;
  }

  const user = await User.findById(userId);
  return user?.role === 'admin' ? project : null;
}

// Public project list. A valid login token adds the caller's participation state.
router.get('/', optionalAuth, async (req, res) => {
  try {
    const type = req.query.type;
    if (type && !PROJECT_TYPES.has(type)) {
      return res.status(400).json({ error: '项目类别无效' });
    }

    const filter = { isPublished: true };
    if (type) {
      filter.type = type;
    }

    const projects = await Project.find(filter).sort({ createdAt: -1 });
    const projectIds = projects.map((project) => project._id);
    const [stats, participations] = await Promise.all([
      projectStats(projectIds),
      userParticipations(req.userId, projectIds),
    ]);

    return res.json({
      projects: projects.map((project) => {
        const stat = stats.get(project._id.toString());
        const participation = participations.get(project._id.toString());
        return formatProject(project, {
          participantCount: stat?.participantCount || 0,
          completedParticipantCount: stat?.completedParticipantCount || 0,
          isParticipating: Boolean(participation),
          isParticipationCompleted: participation?.isCompleted,
          joinedAt: participation?.joinedAt,
          completedAt: participation?.completedAt,
        });
      }),
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Admin list includes drafts so they can be reviewed and published.
router.get('/admin/all', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const projects = await Project.find({}).sort({ updatedAt: -1 });
    const stats = await projectStats(projects.map((project) => project._id));
    return res.json({
      projects: projects.map((project) => {
        const stat = stats.get(project._id.toString());
        return formatProject(project, {
          participantCount: stat?.participantCount || 0,
          completedParticipantCount: stat?.completedParticipantCount || 0,
        });
      }),
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// The caller's own participation history powers the personal-center view.
router.get('/mine', authMiddleware, async (req, res) => {
  try {
    const participations = await ProjectParticipation.find({ userId: req.userId })
      .sort({ joinedAt: -1 })
      .populate('projectId');

    const projectIds = participations
      .filter((participation) => participation.projectId && participation.projectId.isPublished)
      .map((participation) => participation.projectId._id);
    const stats = await projectStats(projectIds);
    const projects = participations
      .filter(
        (participation) =>
          participation.projectId && participation.projectId.isPublished,
      )
      .map((participation) => {
        const stat = stats.get(participation.projectId._id.toString());
        return formatProject(participation.projectId, {
          participantCount: stat?.participantCount || 0,
          completedParticipantCount: stat?.completedParticipantCount || 0,
          isParticipating: true,
          isParticipationCompleted: participation.isCompleted,
          joinedAt: participation.joinedAt,
          completedAt: participation.completedAt,
        });
      });

    return res.json({ projects });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/:projectId', optionalAuth, async (req, res) => {
  try {
    const project = await findVisibleProject(req.params.projectId, req.userId);
    if (!project) {
      return res.status(404).json({ error: '项目不存在' });
    }

    const [stats, participation] = await Promise.all([
      projectStats([project._id]),
      req.userId && isObjectId(req.userId)
        ? ProjectParticipation.findOne({ projectId: project._id, userId: req.userId })
        : null,
    ]);
    const stat = stats.get(project._id.toString());

    return res.json({
      project: formatProject(project, {
        participantCount: stat?.participantCount || 0,
        completedParticipantCount: stat?.completedParticipantCount || 0,
        isParticipating: Boolean(participation),
        isParticipationCompleted: participation?.isCompleted,
        joinedAt: participation?.joinedAt,
        completedAt: participation?.completedAt,
      }),
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { payload, error } = readProjectPayload(req.body, { creating: true });
    if (error) {
      return res.status(400).json({ error });
    }

    if (payload.type === 'personal') {
      payload.isCompleted = false;
    }

    const project = await Project.create({
      ...payload,
      createdBy: req.currentUser._id,
    });
    return res.status(201).json({ project: formatProject(project) });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.put('/:projectId', authMiddleware, requireAdmin, async (req, res) => {
  try {
    if (!isObjectId(req.params.projectId)) {
      return res.status(404).json({ error: '项目不存在' });
    }

    const { payload, error } = readProjectPayload(req.body);
    if (error) {
      return res.status(400).json({ error });
    }
    if (Object.keys(payload).length === 0) {
      return res.status(400).json({ error: '没有可更新的项目内容' });
    }

    const existingProject = await Project.findById(req.params.projectId);
    if (!existingProject) {
      return res.status(404).json({ error: '项目不存在' });
    }
    if ((payload.type || existingProject.type) === 'personal') {
      payload.isCompleted = false;
    }

    const project = await Project.findByIdAndUpdate(
      existingProject._id,
      payload,
      { new: true, runValidators: true },
    );
    if (!project) {
      return res.status(404).json({ error: '项目不存在' });
    }

    const stats = await projectStats([project._id]);
    const stat = stats.get(project._id.toString());
    return res.json({
      project: formatProject(project, {
        participantCount: stat?.participantCount || 0,
        completedParticipantCount: stat?.completedParticipantCount || 0,
      }),
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.delete('/:projectId', authMiddleware, requireAdmin, async (req, res) => {
  try {
    if (!isObjectId(req.params.projectId)) {
      return res.status(404).json({ error: '项目不存在' });
    }

    const project = await Project.findByIdAndDelete(req.params.projectId);
    if (!project) {
      return res.status(404).json({ error: '项目不存在' });
    }

    await ProjectParticipation.deleteMany({ projectId: project._id });
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.post('/:projectId/participate', authMiddleware, async (req, res) => {
  try {
    const project = await findVisibleProject(req.params.projectId, req.userId);
    if (!project) {
      return res.status(404).json({ error: '项目不存在' });
    }
    if (!project.participationOpen) {
      return res.status(400).json({ error: '该项目暂不开放参与' });
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(401).json({ error: '用户不存在' });
    }

    const existing = await ProjectParticipation.findOne({
      projectId: project._id,
      userId: user._id,
    });
    if (existing) {
      return res.json({ success: true, alreadyParticipating: true });
    }

    try {
      await ProjectParticipation.create({
        projectId: project._id,
        userId: user._id,
      });
    } catch (error) {
      if (error?.code !== 11000) {
        throw error;
      }
    }

    return res.status(201).json({ success: true, alreadyParticipating: false });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.delete('/:projectId/participate', authMiddleware, async (req, res) => {
  try {
    if (!isObjectId(req.params.projectId)) {
      return res.status(404).json({ error: '项目不存在' });
    }

    await ProjectParticipation.deleteOne({
      projectId: req.params.projectId,
      userId: req.userId,
    });
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// A personal project is completed independently by each participant.
router.put('/:projectId/participation-completion', authMiddleware, async (req, res) => {
  try {
    if (!isObjectId(req.params.projectId)) {
      return res.status(404).json({ error: '项目不存在' });
    }
    if (typeof req.body?.isCompleted !== 'boolean') {
      return res.status(400).json({ error: '完成状态格式无效' });
    }

    const project = await Project.findById(req.params.projectId);
    if (!project) {
      return res.status(404).json({ error: '项目不存在' });
    }
    if (project.type !== 'personal') {
      return res.status(400).json({ error: '只有个人项目可以由参与者标记完成' });
    }

    const participation = await ProjectParticipation.findOne({
      projectId: project._id,
      userId: req.userId,
    });
    if (!participation) {
      return res.status(400).json({ error: '请先参与项目' });
    }

    participation.isCompleted = req.body.isCompleted;
    participation.completedAt = req.body.isCompleted ? new Date() : null;
    await participation.save();

    const stats = await projectStats([project._id]);
    const stat = stats.get(project._id.toString());
    return res.json({
      success: true,
      completedParticipantCount: stat?.completedParticipantCount || 0,
      participation: {
        isCompleted: participation.isCompleted,
        completedAt: participation.completedAt,
      },
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

router.get('/:projectId/participants', authMiddleware, requireAdmin, async (req, res) => {
  try {
    if (!isObjectId(req.params.projectId)) {
      return res.status(404).json({ error: '项目不存在' });
    }

    const project = await Project.findById(req.params.projectId);
    if (!project) {
      return res.status(404).json({ error: '项目不存在' });
    }

    const participations = await ProjectParticipation.find({ projectId: project._id })
      .sort({ joinedAt: 1 })
      .populate('userId', 'username role');

    return res.json({
      participants: participations
        .filter((participation) => participation.userId)
        .map((participation) => ({
          id: participation._id.toString(),
          userId: participation.userId._id.toString(),
          username: participation.userId.username,
          role: participation.userId.role,
          joinedAt: participation.joinedAt,
          isCompleted: participation.isCompleted === true,
          completedAt: participation.completedAt,
        })),
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

module.exports = router;
