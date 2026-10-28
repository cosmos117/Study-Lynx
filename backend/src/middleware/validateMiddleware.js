import { createHttpError } from '../utils/httpError.js';

export function validate(schema, source = 'body') {
  return (request, _response, next) => {
    const result = schema.safeParse(request[source]);

    if (!result.success) {
      const message = result.error.issues
        .map((issue) => `${issue.path.join('.') || source}: ${issue.message}`)
        .join('; ');
      return next(createHttpError(400, message));
    }

    request[source] = result.data;
    return next();
  };
}
