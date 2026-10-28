const ERROR_STATUS = {
  AI_LIMIT_REACHED: 429,
  AI_USER_LIMIT_REACHED: 429,
  AI_PROVIDER_UNAVAILABLE: 503,
  AI_INVALID_OUTPUT: 502,
  AI_TIMEOUT: 503,
  AI_BUSY: 409,
};

export class AiError extends Error {
  constructor(code, message, options = {}) {
    super(message);
    this.name = 'AiError';
    this.code = code;
    this.statusCode = ERROR_STATUS[code] || 500;
    this.retryable = options.retryable || false;
    this.retryAfter = options.retryAfter;
    this.providerStatus = options.providerStatus;
  }
}

export class AiLimitError extends AiError {
  constructor(code, message) {
    super(code, message);
  }
}

export class AiProviderError extends AiError {
  constructor(message, options = {}) {
    const retryable = options.retryable
      ?? (options.providerStatus === 429 || options.providerStatus >= 500);
    super('AI_PROVIDER_UNAVAILABLE', message, { ...options, retryable });
    this.providerStatus = options.providerStatus;
  }
}

export class AiTimeoutError extends AiError {
  constructor(message = 'The AI provider timed out') {
    super('AI_TIMEOUT', message, { retryable: true });
  }
}

export class AiInvalidOutputError extends AiError {
  constructor(message = 'The AI provider returned invalid structured output') {
    super('AI_INVALID_OUTPUT', message);
  }
}
