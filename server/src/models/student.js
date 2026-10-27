const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
  department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  email: { type: String, required: true, trim: true, lowercase: true, unique: true },
  phone: { type: String, required: true, trim: true, maxlength: 30 },
  studentId: { type: String, required: true, trim: true, maxlength: 50 },
  batch: { type: String, trim: true, maxlength: 50, default: '' },
  academicSession: { type: String, trim: true, maxlength: 50, default: '' },
  isActive: { type: Boolean, default: true },
  authVersion: { type: Number, default: 0 },
  deletedAt: { type: Date, default: null },
  passwordHash: { type: String, required: true, select: false },
}, { timestamps: true });

studentSchema.index({ department: 1, studentId: 1 }, { unique: true });
module.exports = mongoose.model('Student', studentSchema);
