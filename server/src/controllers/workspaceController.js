const service=require('../services/teamService');
const created=new Set(['createWorkspace','inviteStudent','addMember','requestJoin']);
module.exports=Object.fromEntries(Object.keys(service).map(name=>[name,async(req,res)=>{
 try{res.set('Cache-Control','private, no-store');res.status(created.has(name)?201:200).json(await service[name](req));}
 catch(error){if(error.code===11000)return res.status(409).json({message:'A student can belong to only one active team. Leave the other team first.'});if(error.status)return res.status(error.status).json({message:error.message});throw error;}
}]));
