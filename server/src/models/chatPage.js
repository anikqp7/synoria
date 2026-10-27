const { Schema, model } = require('mongoose');
const message = new Schema({
  senderId: { type: Schema.Types.ObjectId, required: true }, senderRole: { type: String, enum: ['student', 'supervisor'], required: true },
  senderName: String, requestKey: { type: String, required: true }, text: { type: String, required: true, maxlength: 2000 }, createdAt: { type: Date, required: true },
});
const schema = new Schema({
  department: { type: Schema.Types.ObjectId, required: true }, workspace: { type: Schema.Types.ObjectId, required: true },
  page: { type: Number, required: true }, messages: { type: [message], default: [] },
}, { timestamps: true });
schema.index({ workspace: 1, page: 1 }, { unique: true });
// Same-array compound index prevents a retry being appended to a later page.
schema.index({ workspace: 1, 'messages.senderRole': 1, 'messages.senderId': 1, 'messages.requestKey': 1 }, { unique: true, name: 'uniqueChatRetry' });
module.exports = model('ChatPage', schema);
