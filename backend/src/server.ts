import app from './app';
import { connectDB } from './config/db';
import { env } from './config/env';
import { validateProductionEnv } from './config/validateEnv';
import { seedDatabase } from './services/seedService';
import { warmEmailTransport } from './utils/email';

const start = async () => {
  validateProductionEnv();
  await connectDB();
  await seedDatabase();
  void warmEmailTransport();

  app.listen(env.port, () => {
    console.log(`Server running on port ${env.port}`);
    console.log(`Environment: ${env.nodeEnv}`);
  });
};

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
