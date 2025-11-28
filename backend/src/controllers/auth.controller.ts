import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../config/database';
import { config } from '../config/env';
import { AppError } from '../middleware/errorHandler';

export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    throw new AppError('Email and password are required', 400);
  }

  // Get user from database
  const result = await pool.query(
    'SELECT user_id, email, password_hash, full_name, role, is_active FROM users WHERE email = $1',
    [email]
  );

  if (result.rows.length === 0) {
    throw new AppError('Invalid credentials', 401);
  }

  const user = result.rows[0];

  if (!user.is_active) {
    throw new AppError('Account is disabled', 401);
  }

  // Verify password
  const isValidPassword = await bcrypt.compare(password, user.password_hash);

  if (!isValidPassword) {
    throw new AppError('Invalid credentials', 401);
  }

  // Generate JWT token
  const token = jwt.sign(
    {
      user_id: user.user_id,
      email: user.email,
      role: user.role
    },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );

  res.json({
    success: true,
    data: {
      token,
      user: {
        user_id: user.user_id,
        email: user.email,
        full_name: user.full_name,
        role: user.role
      }
    }
  });
};

export const register = async (req: Request, res: Response) => {
  const { email, password, full_name, role = 'VIEWER' } = req.body;

  if (!email || !password || !full_name) {
    throw new AppError('Email, password, and full name are required', 400);
  }

  // Check if user already exists
  const existing = await pool.query('SELECT user_id FROM users WHERE email = $1', [email]);

  if (existing.rows.length > 0) {
    throw new AppError('User already exists', 400);
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, 10);

  // Create user
  const result = await pool.query(
    `INSERT INTO users (email, password_hash, full_name, role)
     VALUES ($1, $2, $3, $4)
     RETURNING user_id, email, full_name, role`,
    [email, passwordHash, full_name, role]
  );

  const user = result.rows[0];

  // Generate token
  const token = jwt.sign(
    {
      user_id: user.user_id,
      email: user.email,
      role: user.role
    },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );

  res.status(201).json({
    success: true,
    data: {
      token,
      user
    }
  });
};

export const me = async (req: any, res: Response) => {
  const result = await pool.query(
    'SELECT user_id, email, full_name, role FROM users WHERE user_id = $1',
    [req.user.user_id]
  );

  res.json({
    success: true,
    data: result.rows[0]
  });
};
