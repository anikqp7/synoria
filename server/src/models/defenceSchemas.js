const { Schema } = require('mongoose');
const examiner = new Schema({ id: Schema.Types.ObjectId, name: String, designation: String }, { _id: false });
const student = new Schema({ id: Schema.Types.ObjectId, name: String, studentId: String }, { _id: false });
const actor = new Schema({ id: Schema.Types.ObjectId, name: String, role:String }, { _id: false });
const fields = {
  submittedForEvaluationAt:Date,submittedBy:actor,workspace: Schema.Types.ObjectId, workspaceName: String, title: String, workType: String,
  status: { type: String, enum: ['scheduled', 'cancelled', 'published'] }, startsAt: Date, endsAt: Date, durationMinutes: Number,
  venue: String, venueKey: String, meetingLink: String, linkKey: String, board: [examiner], team: [student],
  noticeId: Schema.Types.ObjectId, noticeRevision: Number, batch: String, stream: String,
  proposalVersion: Number, proposalApprovedAt: Date,
};
const event = new Schema({ ...fields, version: Number, type: String, reason: String, actor, createdAt: Date, requestKey: String, fingerprint: String });
const defenceSchema = new Schema({ ...fields, revision: { type: Number, default: 0 }, history: [event], evaluation: { type: require('./evaluationSchemas').evaluationSchema, default: null }, createdAt: Date, updatedAt: Date });
module.exports = { defenceSchema };
