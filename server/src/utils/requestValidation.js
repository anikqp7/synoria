const validKey = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{16,80}$/.test(value);
module.exports = { validKey };
