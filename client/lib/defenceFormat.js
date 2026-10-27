export const dhakaInput = value => value ? new Date(new Date(value).getTime() + 6 * 3600000).toISOString().slice(0, 16) : '';
export const utcFromDhaka = value => new Date(`${value}:00+06:00`).toISOString();
