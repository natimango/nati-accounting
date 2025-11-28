import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: process.env.PORT || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',

  database: {
    url: process.env.DATABASE_URL || 'postgresql://nati_user:nati_password@localhost:5432/nati_accounting'
  },

  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-key',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  },

  gemini: {
    apiKey: process.env.GEMINI_API_KEY || ''
  },

  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
    apiKey: process.env.CLOUDINARY_API_KEY || '',
    apiSecret: process.env.CLOUDINARY_API_SECRET || ''
  },

  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000'
  },

  ecommerce: {
    apiKey: process.env.ECOMMERCE_API_KEY || ''
  }
};
