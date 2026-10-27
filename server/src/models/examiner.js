const mongoose = require('mongoose');

const examinerSchema = new mongoose.Schema({
  department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  email: { type: String, required: true, trim: true, lowercase: true, unique: true },
  phone: { type: String, required: true, trim: true, maxlength: 30 },
  designation: { type: String, trim: true, maxlength: 100, default: '' },
  researchInterests: { type: String, trim: true, maxlength: 500, default: '' },
  isActive: { type: Boolean, default: true },
  authVersion: { type: Number, default: 0 },
  deletedAt: { type: Date, default: null },
  passwordHash: { type: String, required: true, select: false },
}, { timestamps: true });

module.exports = mongoose.model('Examiner', examinerSchema);
