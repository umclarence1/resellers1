import app from './app';
import { connectDB } from './config/db';
import { seedDatabase } from './services/seedService';

let ready: Promise<void> | null = null;

function ensureReady(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      await connectDB();
      await seedDatabase();
    })();
  }
  return ready;
}

app.use(async (req, res, next) => {
  if (req.path === '/api/health') {
    return next();
  }
  try {
    await ensureReady();
    next();
  } catch (err) {
    next(err);
  }
});

export default app;
