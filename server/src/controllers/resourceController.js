const service=require('../services/resourceService');
const action=kind=>async(req,res)=>{try{res.set('Cache-Control','private, no-store');res.json(await service[kind](req));}catch(e){if(e.status)return res.status(e.status).json({message:e.message});throw e;}};
module.exports=Object.fromEntries(['list','read','save','download'].map(k=>[k,action(k)]));
