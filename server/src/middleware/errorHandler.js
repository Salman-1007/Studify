export const notFound = (req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
};

export const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = statusCode === 500 && process.env.NODE_ENV === 'production'
    ? 'Internal server error'
    : err.message || 'Internal server error';
  if (process.env.NODE_ENV !== 'test') {
    console.error(`[${req.method} ${req.originalUrl}]`, err.message);
  }
  res.status(statusCode).json({ success: false, message });
};
