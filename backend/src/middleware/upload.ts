import multer from 'multer';
import path from 'path';

// Configure multer for file uploads
const storage = multer.memoryStorage();

const fileFilter = (req: any, file: any, cb: any) => {
  // Accept PDFs and images only
  const allowedTypes = /pdf|jpg|jpeg|png/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (extname && mimetype) {
    cb(null, true);
  } else {
    cb(new Error('Only PDF, JPG, JPEG, and PNG files are allowed'));
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB max
  }
});
