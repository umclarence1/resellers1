import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler';

/** Reject requests that include client-supplied financial or privilege fields. */
export function rejectFields(...forbidden: string[]) {
  const blocked = new Set(forbidden.map((f) => f.toLowerCase()));

  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.body || typeof req.body !== 'object') {
      next();
      return;
    }

    for (const key of Object.keys(req.body)) {
      if (blocked.has(key.toLowerCase())) {
        throw new AppError('Invalid request', 400);
      }
    }

    next();
  };
}
