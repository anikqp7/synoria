const { Schema, model } = require('mongoose');
const { submissionSchema } = require('./proposalSchemas');
// One department document is the authoritative allocation record. Capacity changes,
// reassignment and their history commit together on standalone MongoDB.
const schema = new Schema({
  _id: { type: Schema.Types.ObjectId, ref: 'Department' },
  chatMeetings: { type: [require('./chatMeetingSchema')], default: [] },
  chatActivities: { type: [require('./chatActivitySchema')], default: [] },
  resources: { type: [Schema.Types.Mixed], default: [] },
  revision: { type: Number, default: 0 },
  capacityHistory: [{ supervisor: Schema.Types.ObjectId, from: Number, to: Number, actor: Schema.Types.ObjectId, createdAt: Date }],
  limits: [{ _id: false, supervisor: Schema.Types.ObjectId, maxLoad: Number }],
  assignments: [{ _id: false, workspace: Schema.Types.ObjectId, supervisor: Schema.Types.ObjectId, assignedAt: Date }],
  rubricVersions: { type: [require('./evaluationSchemas').rubricSchema], default: [] },
  defences: { type: [require('./defenceSchemas').defenceSchema], default: [] },
  reviews: [{ workspace: Schema.Types.ObjectId, version: Number, decision: { type: String, enum: ['approved', 'rejected', 'revisionRequested'] }, comment: String, reviewer: { id: Schema.Types.ObjectId, name: String }, createdAt: Date, approvedScope: { type: submissionSchema, default: null } }],
  scopeChanges: [{ workspace: Schema.Types.ObjectId, version: Number, reason: String, requestedBy: Schema.Types.ObjectId, createdAt: Date }],
  history: [{ workspace: Schema.Types.ObjectId, from: { id: Schema.Types.ObjectId, name: String }, to: { id: Schema.Types.ObjectId, name: String }, actor: Schema.Types.ObjectId, reason: String, requestCancellation: { type: new Schema({ revision: Number, choices: [{ _id:false, supervisor: Schema.Types.ObjectId, name: String }] },{_id:false}), default: undefined }, createdAt: Date }],
}, { timestamps: true });
module.exports = model('SupervisionLedger', schema);
