const { Schema, model } = require('mongoose');
const schema = new Schema({
  department: { type: Schema.Types.ObjectId, required: true }, recipient: { type: Schema.Types.ObjectId, required: true },
  role: { type: String, enum: ['department', 'student', 'supervisor', 'examiner'], required: true },
  eventKey: { type: String, required: true }, category: { type: String, required: true },
  title: { type: String, maxlength: 180, required: true }, message: { type: String, maxlength: 500, required: true }, href: { type: String, required: true },
  scope: { type: String, enum: ['personal', 'workspace', 'defence'], required: true }, workspace: Schema.Types.ObjectId, defence: Schema.Types.ObjectId,
  dynamic: { type: Boolean, default: false }, withdrawnAt: { type: Date, default: null },
  checkedAt: Date, occurredAt: { type: Date, required: true }, receivedAt: { type: Date, required: true }, readAt: { type: Date, default: null },
});
schema.index({ department: 1, recipient: 1, role: 1, eventKey: 1 }, { unique: true });
schema.index({ department: 1, recipient: 1, role: 1, withdrawnAt: 1, occurredAt: -1, _id: -1 });
schema.index({ department: 1, recipient: 1, role: 1, readAt: 1, withdrawnAt: 1 });
module.exports = model('Notification', schema);
