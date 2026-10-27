const { Schema } = require('mongoose');
const draftSchema = new Schema({
  title: { type: String, default: '', maxlength: 200 },
  abstract: { type: String, default: '', maxlength: 4000 },
  researchArea: { type: String, default: '', maxlength: 120 },
  supervisorPreference: { type: Schema.Types.ObjectId, ref: 'Supervisor', default: null },
  savedAt: { type: Date, default: null },
}, { _id: false });
const submissionSchema = new Schema({
  version: { type: Number, required: true },
  title: { type: String, required: true, maxlength: 200 },
  abstract: { type: String, required: true, maxlength: 4000 },
  researchArea: { type: String, required: true, maxlength: 120 },
  supervisorPreference: { id: Schema.Types.ObjectId, name: String, email: String, designation: String },
  members: [{ _id: false, id: Schema.Types.ObjectId, name: String, email: String, studentId: String }],
  submittedBy: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  submittedAt: { type: Date, required: true },
}, { _id: false });
module.exports = { draftSchema, submissionSchema };
