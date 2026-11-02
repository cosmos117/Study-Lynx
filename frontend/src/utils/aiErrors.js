/**
 * When the AI provider's daily quota resets, in the student's own time: Google resets it at
 * midnight Pacific time (about 1:30 PM in India).
 */
export function quotaResetTime(now = new Date(), timeZone = 'America/Los_Angeles') {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone, hourCycle: 'h23', hour: '2-digit', minute: '2-digit', second: '2-digit' })
    .formatToParts(now).map(({ type, value }) => [type, Number(value)]));
  const secondsIntoDay = parts.hour * 3600 + parts.minute * 60 + parts.second;
  const reset = new Date(now.getTime() + (86400 - secondsIntoDay) * 1000);
  return reset.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

const MESSAGES = {
  AI_USER_LIMIT_REACHED: 'Your daily AI limit has been reached. Saved content remains available.',
  AI_LIMIT_REACHED: () => `Today's shared AI quota is used up. It resets at ${quotaResetTime()}. Saved content remains available.`,
  AI_BUSY: 'Generation is already in progress. Please retry in a moment.',
  AI_PROVIDER_UNAVAILABLE: 'The AI provider is currently unavailable. Please retry later.',
  AI_INVALID_OUTPUT: 'The AI returned unusable content. Please retry.',
  AI_TIMEOUT: 'The AI request timed out. Please retry.',
};

/** A user-facing message for a failed API call, with friendly text for AI error codes. */
export function errorMessage(error, fallback = 'Unable to complete this request') {
  const message = MESSAGES[error.response?.data?.code];
  return (typeof message === 'function' ? message() : message) || error.response?.data?.message || fallback;
}
