const mongoose = require('mongoose');
const { ROLE_VALUES } = require('../utils/teamRoles');
const { draftSchema, submissionSchema } = require('./proposalSchemas');
const invitationSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  role: { type: String, enum: ROLE_VALUES, default: 'Member' },
  legacyRole: String,
  status: { type: String, enum: ['pending', 'accepted', 'declined', 'cancelled'], default: 'pending' },
  respondedAt: { type: Date, default: null },
}, { timestamps: true });
const workspaceSchema = new mongoose.Schema({
  department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  workType: { type: String, enum: ['project', 'thesis', 'research'], required: true },
  leader: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true }],
  status: { type: String, enum: ['draft', 'submitted', 'active', 'defenceScheduled', 'evaluated', 'archived'], default: 'draft' },
  isActive: { type: Boolean, default: true },
  invitations: [invitationSchema],
  memberRoles: [{ _id: false, student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' }, role: { type: String, enum: ROLE_VALUES }, legacyRole: String }],
  joinRequests: [{ student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true }, status: { type: String, enum: ['pending','accepted','declined','cancelled'], default: 'pending' }, createdAt: { type: Date, default: Date.now }, respondedAt: Date }],
  chatActivities: { type: [require('./chatActivitySchema')], default: [] },
  teamEvents: [{ type: { type: String, enum: ['memberRemoved', 'memberLeft', 'workspaceUpdated', 'memberAdded', 'roleUpdated'] }, member: mongoose.Schema.Types.ObjectId, actor: { id: mongoose.Schema.Types.ObjectId, name: String }, createdAt: Date }],
  supervisorRequest: {
    choices: [{ _id: false, supervisor: { type: mongoose.Schema.Types.ObjectId, ref: 'Supervisor' }, name: String }],
    revision: { type: Number, default: 0 },
    submittedAt: Date,
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
  },
  proposalDraft: { type: draftSchema, default: () => ({}) },
  projectCreatedAt: { type: Date, default: null },
  projectParticipants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Student' }],
  proposalRevision: { type: Number, default: 0 },
  proposalVersions: { type: [submissionSchema], default: [] },
}, { timestamps: true });
// Single-document membership updates plus this unique multikey index enforce one
// active team per student, even for concurrent create/accept calls on standalone MongoDB.
workspaceSchema.index({ members: 1 }, { unique: true, partialFilterExpression: { isActive: true }, name: 'oneActiveTeamPerStudent' });
workspaceSchema.index({ projectParticipants: 1 });
workspaceSchema.index({ 'proposalVersions.members.id': 1 });
workspaceSchema.index({ 'invitations.student': 1, isActive: 1 });
module.exports = mongoose.model('Workspace', workspaceSchema);
