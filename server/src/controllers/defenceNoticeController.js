const service=require('../services/defenceNoticeService');
const action=kind=>async(req,res)=>{try{res.set('Cache-Control','private, no-store');res.json(await service[kind](req));}catch(error){if(error.status)return res.status(error.status).json({message:error.message});throw error;}};
module.exports={list:action('list'),save:action('save'),remove:action('remove')};
