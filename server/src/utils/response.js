export const ok = (res, data, statusCode = 200) => res.status(statusCode).json({ success: true, data });
export const fail = (res, statusCode, message) => res.status(statusCode).json({ success: false, message });
