import { AppError } from '../middleware/errorHandler';

type MongoErrorLike = {
  code?: number;
  keyPattern?: Record<string, unknown>;
  message?: string;
};

export function isMongoDuplicateKeyError(err: unknown): err is MongoErrorLike & { code: 11000 } {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as MongoErrorLike).code === 11000
  );
}

export function toOrderCreationError(err: unknown): AppError {
  if (err instanceof AppError) return err;

  if (isMongoDuplicateKeyError(err)) {
    console.error('Order creation duplicate key error:', err);
    return new AppError(
      'We could not complete your order right now. Please try again in a moment or contact support.',
      503
    );
  }

  console.error('Order creation failed:', err);
  return new AppError(
    'We could not complete your order right now. Please try again or contact support.',
    500
  );
}
