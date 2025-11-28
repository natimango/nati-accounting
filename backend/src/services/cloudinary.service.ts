import { v2 as cloudinary } from 'cloudinary';
import { config } from '../config/env';

export class CloudinaryService {
  constructor() {
    if (config.cloudinary.cloudName && config.cloudinary.apiKey) {
      cloudinary.config({
        cloud_name: config.cloudinary.cloudName,
        api_key: config.cloudinary.apiKey,
        api_secret: config.cloudinary.apiSecret
      });
      console.log('✓ Cloudinary configured');
    } else {
      console.warn('⚠️  Cloudinary not configured. File uploads will be stored locally.');
    }
  }

  async uploadDocument(buffer: Buffer, filename: string): Promise<{ url: string; public_id: string }> {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'nati-bills',
          resource_type: 'auto',
          public_id: `bill_${Date.now()}_${filename}`,
        },
        (error, result) => {
          if (error) {
            reject(error);
          } else if (result) {
            resolve({
              url: result.secure_url,
              public_id: result.public_id
            });
          }
        }
      );

      uploadStream.end(buffer);
    });
  }

  async deleteDocument(publicId: string): Promise<void> {
    await cloudinary.uploader.destroy(publicId);
  }
}

export const cloudinaryService = new CloudinaryService();
