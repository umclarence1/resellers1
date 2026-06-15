import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler';

const BLOCKED_METHODS = new Set(['TRACE', 'TRACK']);

/** Reject unsafe HTTP methods (TRACE can expose headers). */
export function blockUnsafeHttpMethods(req: Request, _res: Response, next: NextFunction): void {
  if (BLOCKED_METHODS.has(req.method.toUpperCase())) {
    next(new AppError('Method not allowed', 405));
    return;
  }
  next();
}

/** Require JSON content type for state-changing API requests with a body. */
export function requireJsonContentType(req: Request, _res: Response, next: NextFunction): void {
  if (!['POST', 'PUT', 'PATCH'].includes(req.method)) {
    next();
    return;
  }
  if (req.path.startsWith('/api/webhooks/')) {
    next();
    return;
  }
  const contentType = req.headers['content-type'] || '';
  const contentLength = Number.parseInt(req.headers['content-length'] || '0', 10);
  if (!contentType && (contentLength === 0 || Number.isNaN(contentLength))) {
    next();
    return;
  }
  if (!contentType.includes('application/json') && !contentType.includes('multipart/form-data')) {
    next(new AppError('Unsupported content type', 415));
    return;
  }
  next();
}
