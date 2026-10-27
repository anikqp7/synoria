const service=require('../services/supervisorPeriodService');
const action=kind=>async(req,res)=>{try{res.set('Cache-Control','private, no-store');res.json(await service[kind](req));}catch(e){if(e.status)return res.status(e.status).json({message:e.message});throw e;}};
module.exports={read:action('read'),save:action('save')};
