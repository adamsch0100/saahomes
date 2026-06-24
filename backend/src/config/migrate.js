import getPool from './database.js';

export const runMigrations = async () => {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    await client.query(`
      CREATE TABLE IF NOT EXISTS contact_submissions (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        phone VARCHAR(50),
        interest VARCHAR(100),
        message TEXT,
        area VARCHAR(100),
        source_page VARCHAR(255),
        utm_source VARCHAR(100),
        utm_medium VARCHAR(100),
        utm_campaign VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS market_report_submissions (
        id SERIAL PRIMARY KEY,
        first_name VARCHAR(255) NOT NULL,
        last_name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        phone VARCHAR(50),
        area VARCHAR(100),
        source_page VARCHAR(255),
        utm_source VARCHAR(100),
        utm_medium VARCHAR(100),
        utm_campaign VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

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
        source_page VARCHAR(255),
        utm_source VARCHAR(100),
        utm_medium VARCHAR(100),
        utm_campaign VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS champions_lead_submissions (
        id SERIAL PRIMARY KEY,
        first_name VARCHAR(255) NOT NULL,
        last_name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        phone VARCHAR(50),
        responder_type VARCHAR(255),
        employer_agency VARCHAR(255),
        buying_timeline VARCHAR(100),
        message TEXT,
        source_page VARCHAR(255),
        utm_source VARCHAR(100),
        utm_medium VARCHAR(100),
        utm_campaign VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      ALTER TABLE contact_submissions ADD COLUMN IF NOT EXISTS source_page VARCHAR(255);
      ALTER TABLE contact_submissions ADD COLUMN IF NOT EXISTS utm_source VARCHAR(100);
      ALTER TABLE contact_submissions ADD COLUMN IF NOT EXISTS utm_medium VARCHAR(100);
      ALTER TABLE contact_submissions ADD COLUMN IF NOT EXISTS utm_campaign VARCHAR(100);
      ALTER TABLE market_report_submissions ADD COLUMN IF NOT EXISTS source_page VARCHAR(255);
      ALTER TABLE market_report_submissions ADD COLUMN IF NOT EXISTS utm_source VARCHAR(100);
      ALTER TABLE market_report_submissions ADD COLUMN IF NOT EXISTS utm_medium VARCHAR(100);
      ALTER TABLE market_report_submissions ADD COLUMN IF NOT EXISTS utm_campaign VARCHAR(100);
      ALTER TABLE chfa_lead_submissions ADD COLUMN IF NOT EXISTS source_page VARCHAR(255);
      ALTER TABLE chfa_lead_submissions ADD COLUMN IF NOT EXISTS utm_source VARCHAR(100);
      ALTER TABLE chfa_lead_submissions ADD COLUMN IF NOT EXISTS utm_medium VARCHAR(100);
      ALTER TABLE chfa_lead_submissions ADD COLUMN IF NOT EXISTS utm_campaign VARCHAR(100);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_contact_submissions_email ON contact_submissions(email);
      CREATE INDEX IF NOT EXISTS idx_contact_submissions_created_at ON contact_submissions(created_at);
      CREATE INDEX IF NOT EXISTS idx_market_report_submissions_email ON market_report_submissions(email);
      CREATE INDEX IF NOT EXISTS idx_market_report_submissions_created_at ON market_report_submissions(created_at);
      CREATE INDEX IF NOT EXISTS idx_chfa_lead_submissions_email ON chfa_lead_submissions(email);
      CREATE INDEX IF NOT EXISTS idx_chfa_lead_submissions_created_at ON chfa_lead_submissions(created_at);
      CREATE INDEX IF NOT EXISTS idx_champions_lead_submissions_email ON champions_lead_submissions(email);
      CREATE INDEX IF NOT EXISTS idx_champions_lead_submissions_created_at ON champions_lead_submissions(created_at);
    `);

    await client.query('COMMIT');
    console.log('Database migrations completed');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', error);
    throw error;
  } finally {
    client.release();
  }
};

const isDirectRun = process.argv[1]?.includes('migrate.js');

if (isDirectRun) {
  runMigrations()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
