export function notFoundMiddleware(request, response) {
  response.status(404).json({
    success: false,
    message: `Route not found: ${request.method} ${request.originalUrl}`,
  });
}

export function errorMiddleware(error, _request, response, _next) {
  if (error.code?.startsWith('AI_')) {
    console.error('AI request failed', { code: error.code, status: error.statusCode, providerStatus: error.providerStatus });
  } else if (error.code === 'LIMIT_FILE_SIZE') {
    response.status(413).json({ success: false, message: 'File exceeds the allowed size limit' });
    return;
  } else if (error.code === 'LIMIT_UNEXPECTED_FILE') {
    response.status(400).json({ success: false, message: 'Unexpected file field' });
    return;
  } else if (error.message === 'Unsupported file type') {
    response.status(415).json({ success: false, message: error.message });
    return;
  } else if (!error.statusCode || error.statusCode >= 500) {
    console.error(error);
  }

  response.status(error.statusCode || 500).json({
    success: false,
    message: error.statusCode ? error.message : 'Internal server error',
    ...(error.code ? { code: error.code } : {}),
  });
}
