import dotenv from 'dotenv';
dotenv.config();

export const env = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/data-bundle-reseller',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  apiUrl: process.env.API_URL || 'http://localhost:5000',
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.EMAIL_FROM || 'DataBundle <noreply@localhost>',
  },
  paystack: {
    secretKey: process.env.PAYSTACK_SECRET_KEY || '',
    publicKey: process.env.PAYSTACK_PUBLIC_KEY || '',
    webhookSecret: process.env.PAYSTACK_WEBHOOK_SECRET || '',
  },
  devSkipOtp: process.env.DEV_SKIP_OTP === 'true',
  devAutoDeliver: process.env.DEV_AUTO_DELIVER === 'true',
  admin: {
    email: process.env.ADMIN_EMAIL || 'admin@localhost.com',
    password: process.env.ADMIN_PASSWORD || 'Admin@12345',
    name: process.env.ADMIN_NAME || 'Platform Admin',
  },
  demo: {
    dealerEmail: process.env.DEMO_DEALER_EMAIL || 'dealer@databundle.test',
    dealerPassword: process.env.DEMO_DEALER_PASSWORD || 'Dealer@12345',
    resellerEmail: process.env.DEMO_RESELLER_EMAIL || 'reseller@databundle.test',
    resellerPassword: process.env.DEMO_RESELLER_PASSWORD || 'Reseller@12345',
  },
  uploadDir: process.env.UPLOAD_DIR || 'uploads',
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '5242880', 10),
};
