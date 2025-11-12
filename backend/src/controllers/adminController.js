import bcrypt from 'bcrypt';
import pool from '../config/database.js';
import { generateToken } from '../middleware/auth.js';
import logger from '../utils/logger.js';
import dotenv from 'dotenv';

dotenv.config();

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'adam@saahomes.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

export const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  // Simple check against environment variables
  // In production, you'd want to hash the password and store it securely
  if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
    const token = generateToken({ email, role: 'admin' });
    logger.info('Admin login successful', { email });
    return res.json({ success: true, token });
  }

  logger.warn('Failed admin login attempt', { email });
  return res.status(401).json({ error: 'Invalid credentials' });
};

export const getSubmissions = async (req, res) => {
  try {
    const { type, limit = 50, offset = 0 } = req.query;
    const limitNum = Math.min(parseInt(limit) || 50, 100); // Max 100
    const offsetNum = parseInt(offset) || 0;

    let query, countQuery;
    
    if (type === 'market-report') {
      query = `
        SELECT * FROM market_report_submissions
        ORDER BY created_at DESC
        LIMIT $1 OFFSET $2
      `;
      countQuery = 'SELECT COUNT(*) FROM market_report_submissions';
    } else if (type === 'contact') {
      query = `
        SELECT * FROM contact_submissions
        ORDER BY created_at DESC
        LIMIT $1 OFFSET $2
      `;
      countQuery = 'SELECT COUNT(*) FROM contact_submissions';
    } else {
      // Get both types
      query = `
        SELECT 
          'contact' as type,
          id,
          name as first_name,
          '' as last_name,
          email,
          phone,
          interest,
          message,
          area,
          created_at
        FROM contact_submissions
        UNION ALL
        SELECT 
          'market-report' as type,
          id,
          first_name,
          last_name,
          email,
          phone,
          NULL as interest,
          NULL as message,
          area,
          created_at
        FROM market_report_submissions
        ORDER BY created_at DESC
        LIMIT $1 OFFSET $2
      `;
      countQuery = `
        SELECT 
          (SELECT COUNT(*) FROM contact_submissions) +
          (SELECT COUNT(*) FROM market_report_submissions) as count
      `;
    }

    const [results, countResult] = await Promise.all([
      pool.query(query, [limitNum, offsetNum]),
      pool.query(countQuery),
    ]);

    const total = parseInt(countResult.rows[0].count || countResult.rows[0]?.count || 0);

    res.json({
      success: true,
      data: results.rows,
      pagination: {
        total,
        limit: limitNum,
        offset: offsetNum,
        hasMore: offsetNum + limitNum < total,
      },
    });
  } catch (error) {
    logger.error('Error fetching submissions', error);
    res.status(500).json({ error: 'Failed to fetch submissions' });
  }
};

export const getSubmission = async (req, res) => {
  try {
    const { id, type } = req.params;

    let query;
    if (type === 'market-report') {
      query = 'SELECT * FROM market_report_submissions WHERE id = $1';
    } else {
      query = 'SELECT * FROM contact_submissions WHERE id = $1';
    }

    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    logger.error('Error fetching submission', error);
    res.status(500).json({ error: 'Failed to fetch submission' });
  }
};

export const getStats = async (req, res) => {
  try {
    const [contactCount, marketReportCount, recentContacts, recentMarketReports] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM contact_submissions'),
      pool.query('SELECT COUNT(*) FROM market_report_submissions'),
      pool.query(`
        SELECT COUNT(*) FROM contact_submissions 
        WHERE created_at >= NOW() - INTERVAL '7 days'
      `),
      pool.query(`
        SELECT COUNT(*) FROM market_report_submissions 
        WHERE created_at >= NOW() - INTERVAL '7 days'
      `),
    ]);

    res.json({
      success: true,
      data: {
        totalContacts: parseInt(contactCount.rows[0].count),
        totalMarketReports: parseInt(marketReportCount.rows[0].count),
        contactsLast7Days: parseInt(recentContacts.rows[0].count),
        marketReportsLast7Days: parseInt(recentMarketReports.rows[0].count),
      },
    });
  } catch (error) {
    logger.error('Error fetching stats', error);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
};

