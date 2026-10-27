const { Schema, model } = require('mongoose');
const schema = new Schema({
  workspace: { type: Schema.Types.ObjectId, required: true }, userId: { type: Schema.Types.ObjectId, required: true },
  role: { type: String, enum: ['student', 'supervisor'], required: true }, lastReadSeq: { type: Number, default: 0 },
}, { timestamps: true });
schema.index({ workspace: 1, userId: 1, role: 1 }, { unique: true });
module.exports = model('ChatRead', schema);
