const { z } = require('zod');
const payload = z.strictObject({ at: z.iso.datetime(), id: z.string().regex(/^(?:message:[a-f0-9]{24}|system:[A-Za-z0-9:_-]{1,240})$/) });
function decode(value) { try { if (!value || value.length > 768 || !/^[A-Za-z0-9_-]+$/.test(value)) return null; const result = payload.safeParse(JSON.parse(Buffer.from(value, 'base64url').toString())); return result.success ? result.data : null; } catch { return null; } }
const encode = entry => Buffer.from(JSON.stringify({ at: entry.createdAt, id: entry.id })).toString('base64url');
module.exports = { decode, encode };
