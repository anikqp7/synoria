const { Schema } = require('mongoose');
const actor = new Schema({ id: Schema.Types.ObjectId, name: String, role: { type: String, enum: ['student', 'supervisor'] } }, { _id: false });
module.exports = new Schema({
  workspace: { type: Schema.Types.ObjectId, required: true }, supervisorId: { type: Schema.Types.ObjectId, required: true }, supervisorName: String,
  title: { type: String, required: true, maxlength: 150 }, agenda: { type: String, maxlength: 1000 }, startsAt: { type: Date, required: true },
  durationMinutes: { type: Number, min: 15, max: 240 }, venue: { type: String, maxlength: 200 }, meetingLink: { type: String, maxlength: 2048 },
  status: { type: String, enum: ['scheduled', 'completed', 'cancelled'], default: 'scheduled' }, summary: String, decisions: String,
  revision: { type: Number, default: 0 }, createdAt: Date, updatedAt: Date,
  history: [{ type: { type: String, enum: ['scheduled', 'rescheduled', 'cancelled', 'summary'] }, actor, createdAt: Date, requestKey: String, fingerprint: String,
    title: String, agenda: String, startsAt: Date, durationMinutes: Number, venue: String, meetingLink: String, summary: String, decisions: String, reason: String }],
});
