import pool from './database.js';

const createTables = async () => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Create contact_submissions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS contact_submissions (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        phone VARCHAR(50),
        interest VARCHAR(100),
        message TEXT,
        area VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create market_report_submissions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS market_report_submissions (
        id SERIAL PRIMARY KEY,
        first_name VARCHAR(255) NOT NULL,
        last_name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        phone VARCHAR(50),
        area VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create chfa_lead_submissions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS chfa_lead_submissions (
        id SERIAL PRIMARY KEY,
        first_name VARCHAR(255) NOT NULL,
        last_name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        phone VARCHAR(50),
        school_employer VARCHAR(255),
        buying_timeline VARCHAR(100),
        message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes for better query performance
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_contact_submissions_email ON contact_submissions(email);
      CREATE INDEX IF NOT EXISTS idx_contact_submissions_created_at ON contact_submissions(created_at);
      CREATE INDEX IF NOT EXISTS idx_market_report_submissions_email ON market_report_submissions(email);
      CREATE INDEX IF NOT EXISTS idx_market_report_submissions_created_at ON market_report_submissions(created_at);
      CREATE INDEX IF NOT EXISTS idx_chfa_lead_submissions_email ON chfa_lead_submissions(email);
      CREATE INDEX IF NOT EXISTS idx_chfa_lead_submissions_created_at ON chfa_lead_submissions(created_at);
    `);

    await client.query('COMMIT');
    console.log('Database tables created successfully');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating tables:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Run migrations
createTables()
  .then(() => {
    console.log('Migration completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Migration failed:', error);
    process.exit(1);
  });

