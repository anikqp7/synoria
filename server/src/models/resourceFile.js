const {Schema,model}=require('mongoose');
module.exports=model('ResourceFile',new Schema({workspace:Schema.Types.ObjectId,name:String,data:Buffer},{timestamps:true}));
