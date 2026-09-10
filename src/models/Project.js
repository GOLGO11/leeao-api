const mongoose = require('mongoose');

const ProjectSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    type: {
      type: String,
      enum: ['collaboration', 'personal'],
      required: true,
    },
    description: { type: String, required: true, trim: true, maxlength: 5000 },
    coverImage: { type: String, trim: true, maxlength: 2048 },
    isPublished: { type: Boolean, default: true },
    participationOpen: { type: Boolean, default: true },
    // Collaboration projects are completed by an administrator. Personal
    // projects use the per-participant completion state instead.
    isCompleted: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

ProjectSchema.index({ type: 1, isPublished: 1, createdAt: -1 });

module.exports = mongoose.model('Project', ProjectSchema);
