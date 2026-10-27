const {Schema,model}=require('mongoose');
const schema=new Schema({
 department:{type:Schema.Types.ObjectId,ref:'Department',required:true},
 batch:{type:String,required:true,trim:true,maxlength:50},stream:{type:String,required:true,trim:true,maxlength:80},
 startsAt:{type:Date,required:true},venue:{type:String,required:true,trim:true,maxlength:200},
 revision:{type:Number,default:0},requestKey:{type:String,required:true},
},{timestamps:true});
schema.index({department:1,startsAt:1});schema.index({department:1,requestKey:1},{unique:true});
module.exports=model('DefenceNotice',schema);
