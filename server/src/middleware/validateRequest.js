const { z } = require('zod');
const { contractFor, id } = require('../validation/contracts');
module.exports = function validateRequest(req, res, next) {
  const path = `${req.baseUrl.replace(/^\/api\/auth/, '')}${req.path}`.replace(/\/$/, '');
  // Retired write actions have no valid input: their controller always denies them.
  if ((req.method === 'POST' && path === '/defences') || /\/evaluation\/reopen\/?$/.test(path)) return next();
  const contract = contractFor(req.method, path);
  if (!contract) return next(new Error(`Missing input contract: ${req.method} ${path}`));
  const params = z.strictObject(Object.fromEntries(Object.keys(req.params).map(key => [key, key === 'itemId' ? z.uuid() : id]))).safeParse(req.params);
  if (!params.success) return res.status(404).json({ message: 'Record not found.', errors: params.error.issues.map(issue => ({ field: `params.${issue.path.join('.')}`, message: issue.message })) });
  const body = contract.body.safeParse(req.body ?? {}), query = contract.query.safeParse(req.query);
  const errors = [...(!body.success ? body.error.issues.map(issue => ({ field: issue.path.join('.') || 'body', message: issue.message })) : []), ...(!query.success ? query.error.issues.map(issue => ({ field: `query.${issue.path.join('.')}`, message: issue.message })) : [])];
  if (errors.length) return res.status(400).json({ message: errors[0].message, errors });
  req.body = body.data;
  req.validatedQuery = query.data; // Express 5 exposes req.query through a getter.
  next();
};
