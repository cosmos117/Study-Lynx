const MESSAGES = {
  AI_USER_LIMIT_REACHED: 'Your daily AI limit has been reached. Saved content remains available.',
  AI_LIMIT_REACHED: 'The shared AI limit has been reached. Please try again later.',
  AI_BUSY: 'Generation is already in progress. Please retry in a moment.',
  AI_PROVIDER_UNAVAILABLE: 'The AI provider is currently unavailable. Please retry later.',
  AI_INVALID_OUTPUT: 'The AI returned unusable content. Please retry.',
  AI_TIMEOUT: 'The AI request timed out. Please retry.',
};

/** A user-facing message for a failed API call, with friendly text for AI error codes. */
export function errorMessage(error, fallback = 'Unable to complete this request') {
  return MESSAGES[error.response?.data?.code] || error.response?.data?.message || fallback;
}
