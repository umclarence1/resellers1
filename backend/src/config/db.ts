import mongoose from 'mongoose';
import { env } from './env';

export const connectDB = async (): Promise<void> => {
  try {
    await mongoose.connect(env.mongodbUri, { serverSelectionTimeoutMS: 4000 });
    console.log('MongoDB connected');
    return;
  } catch (error) {
    if (env.nodeEnv !== 'development') {
      console.error('MongoDB connection error:', error);
      throw error;
    }
  }

  try {
    console.warn('Local MongoDB unavailable — using in-memory database (development only)');
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    const memoryServer = await MongoMemoryServer.create({
      instance: { launchTimeout: 60000 },
    });
    await mongoose.connect(memoryServer.getUri());
    console.log('In-memory MongoDB connected');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw error;
  }
};
