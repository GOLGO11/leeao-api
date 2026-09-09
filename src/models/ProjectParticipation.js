const mongoose = require('mongoose');

const ProjectParticipationSchema = new mongoose.Schema({
  projectId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true,
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  joinedAt: { type: Date, default: Date.now },
});

ProjectParticipationSchema.index({ projectId: 1, userId: 1 }, { unique: true });
ProjectParticipationSchema.index({ userId: 1, joinedAt: -1 });

module.exports = mongoose.model('ProjectParticipation', ProjectParticipationSchema);
