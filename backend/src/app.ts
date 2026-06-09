import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import mongoSanitize from 'express-mongo-sanitize';
import hpp from 'hpp';
import path from 'path';
import { env } from './config/env';
import { errorHandler } from './middleware/errorHandler';
import { generalLimiter } from './middleware/rateLimiter';

import authRoutes from './routes/auth.routes';
import adminRoutes from './routes/admin.routes';
import dealerRoutes from './routes/dealer.routes';
import resellerRoutes from './routes/reseller.routes';
import storeRoutes from './routes/store.routes';
import dealerApiRoutes from './routes/dealerApi.routes';
import webhookRoutes from './routes/webhook.routes';

const app = express();

if (process.env.VERCEL) {
  app.set('trust proxy', 1);
}

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(cors({
  origin: env.nodeEnv === 'development'
    ? (origin, callback) => {
        if (!origin || /^https?:\/\/localhost(:\d+)?$/.test(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      }
    : (origin, callback) => {
        const allowed = [env.frontendUrl, env.apiUrl].filter(Boolean);
        if (!origin || allowed.some((url) => origin === url || origin.startsWith(url.replace(/\/$/, '')))) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
// Express 5 makes req.query read-only; sanitize body/params only
app.use((req, _res, next) => {
  if (req.body) req.body = mongoSanitize.sanitize(req.body);
  if (req.params) req.params = mongoSanitize.sanitize(req.params);
  next();
});
app.use(hpp());
app.use(generalLimiter);

app.use('/uploads', express.static(path.join(process.cwd(), env.uploadDir)));

app.get('/api/health', (_req, res) => {
  res.json({ success: true, message: 'Data Bundle Reseller API is running' });
});

app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/dealer', dealerRoutes);
app.use('/api/reseller', resellerRoutes);
app.use('/api/store', storeRoutes);
app.use('/api/v1/dealer', dealerApiRoutes);
app.use('/api/webhooks', webhookRoutes);

app.use(errorHandler);

export default app;
