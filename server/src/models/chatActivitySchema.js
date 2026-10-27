const { Schema } = require('mongoose');
module.exports = new Schema({
  key: { type: String, required: true }, workspace: { type: Schema.Types.ObjectId, required: true },
  category: { type: String, required: true }, title: { type: String, required: true }, text: { type: String, required: true },
  target: String, meetingId: Schema.Types.ObjectId, defenceId: Schema.Types.ObjectId, createdAt: { type: Date, required: true },
}, { _id: false });
