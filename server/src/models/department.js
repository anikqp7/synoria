const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  university: { type: String, required: true, trim: true, maxlength: 160 },
  email: { type: String, required: true, lowercase: true, trim: true, unique: true },
  proposalPeriod: { type: new mongoose.Schema({
    status: { type: String, enum: ['open', 'paused', 'closed'], default: 'closed' },
    notice: { type: String, default: '', maxlength: 2000 },
    deadline: { type: Date, default: null },
    revision: { type: Number, default: 0 },
    updatedAt: Date,
  }, { _id: false }), default: () => ({}) },
  evaluationPeriod: {type:new mongoose.Schema({status:{type:String,enum:['open','paused','closed'],default:'closed'},notice:{type:String,default:'',maxlength:2000},deadline:{type:Date,default:null},revision:{type:Number,default:0},updatedAt:Date},{_id:false}),default:()=>({})},
  evaluationNotices:[{revision:Number,notice:String,deadline:Date,status:String,publishedAt:Date}],
  resultPeriod: {type:new mongoose.Schema({status:{type:String,enum:['open','paused','closed'],default:'closed'},notice:{type:String,default:'',maxlength:2000},deadline:{type:Date,default:null},revision:{type:Number,default:0},updatedAt:Date},{_id:false}),default:()=>({})},
  resultNotices:[{revision:Number,notice:String,deadline:Date,status:String,publishedAt:Date}],
  supervisorPeriod: { type: new mongoose.Schema({
    status: { type: String, enum: ['open','paused','closed'], default: 'closed' },
    notice: { type: String, default: '', maxlength: 2000 }, deadline: { type: Date, default: null },
    revision: { type: Number, default: 0 }, updatedAt: Date,
  }, { _id: false }), default: () => ({}) },
  supervisorNotices: [{ revision: Number, notice: String, deadline: Date, status: String, publishedAt: Date }],
  resourcePeriod: { type: new mongoose.Schema({
    status: { type: String, enum: ['open','paused','closed'], default: 'closed' },
    notice: { type: String, default: '', maxlength: 2000 }, deadline: { type: Date, default: null },
    revision: { type: Number, default: 0 }, updatedAt: Date,
  }, { _id: false }), default: () => ({}) },
  resourceNotices: [{ revision: Number, notice: String, deadline: Date, status: String, publishedAt: Date }],
  proposalNotices: [{ revision: Number, notice: String, deadline: Date, status: String, publishedAt: Date }],
  proposalGate: { token: String, until: Date },
  passwordHash: { type: String, required: true, select: false },
}, { timestamps: true });

module.exports = mongoose.model('Department', departmentSchema);
