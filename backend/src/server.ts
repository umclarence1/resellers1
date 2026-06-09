import app from './app';
import { connectDB } from './config/db';
import { env } from './config/env';
import { seedDatabase } from './services/seedService';

const start = async () => {
  await connectDB();
  await seedDatabase();

  app.listen(env.port, () => {
    console.log(`Server running on port ${env.port}`);
    console.log(`Environment: ${env.nodeEnv}`);
  });
};

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
