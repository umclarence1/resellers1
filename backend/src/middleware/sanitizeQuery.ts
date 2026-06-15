import { Request, Response, NextFunction } from 'express';
import mongoSanitize from 'express-mongo-sanitize';

/** Sanitize query strings — Express 5 makes req.query read-only, so we replace it safely. */
export function sanitizeQuery(req: Request, _res: Response, next: NextFunction): void {
  if (!req.query || typeof req.query !== 'object') {
    next();
    return;
  }

  const sanitized = mongoSanitize.sanitize(
    req.query as Record<string, unknown>
  ) as typeof req.query;

  Object.defineProperty(req, 'query', {
    value: sanitized,
    writable: true,
    configurable: true,
    enumerable: true,
  });

  next();
}
