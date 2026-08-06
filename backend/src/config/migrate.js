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
      CREATE TABLE IF NOT EXISTS chfa_dpa_lead_submissions (
        id SERIAL PRIMARY KEY,
        first_name VARCHAR(255) NOT NULL,
        last_name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        phone VARCHAR(50),
        buyer_status VARCHAR(255),
        target_county VARCHAR(255),
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
      CREATE TABLE IF NOT EXISTS ghope_lead_submissions (
        id SERIAL PRIMARY KEY,
        first_name VARCHAR(255) NOT NULL,
        last_name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL,
        phone VARCHAR(50),
        employer_name VARCHAR(255),
        target_zone VARCHAR(255),
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
      ALTER TABLE listings ADD COLUMN IF NOT EXISTS property_subtype VARCHAR(128);
      ALTER TABLE listings ADD COLUMN IF NOT EXISTS home_type VARCHAR(16) DEFAULT 'other';
      ALTER TABLE listings ADD COLUMN IF NOT EXISTS elementary_school VARCHAR(128);
      ALTER TABLE listings ADD COLUMN IF NOT EXISTS middle_school VARCHAR(128);
      ALTER TABLE listings ADD COLUMN IF NOT EXISTS high_school VARCHAR(128);
      ALTER TABLE listings ADD COLUMN IF NOT EXISTS days_on_market INTEGER;
      ALTER TABLE listings ADD COLUMN IF NOT EXISTS price_per_sqft INTEGER;
      ALTER TABLE listings ADD COLUMN IF NOT EXISTS subdivision VARCHAR(255);
      ALTER TABLE listings ADD COLUMN IF NOT EXISTS features JSONB DEFAULT '{}'::jsonb;
      ALTER TABLE listings ADD COLUMN IF NOT EXISTS original_list_price NUMERIC(12,2);
      ALTER TABLE listings ADD COLUMN IF NOT EXISTS price_change_timestamp TIMESTAMPTZ;
      ALTER TABLE listings ADD COLUMN IF NOT EXISTS half_baths NUMERIC(4,1);
      ALTER TABLE listings ADD COLUMN IF NOT EXISTS three_quarter_baths NUMERIC(4,1);
      ALTER TABLE listings ADD COLUMN IF NOT EXISTS above_grade_area NUMERIC(12,1);
      ALTER TABLE listings ADD COLUMN IF NOT EXISTS lot_size_acres NUMERIC(12,2);
      ALTER TABLE listings ADD COLUMN IF NOT EXISTS units_total INTEGER;
      ALTER TABLE listings ADD COLUMN IF NOT EXISTS photos_count INTEGER;
      ALTER TABLE listings ADD COLUMN IF NOT EXISTS school_district VARCHAR(255);
    `);

      // ---- Saved-search / follow-up engine (Aug 2026) ----
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          email VARCHAR(255) NOT NULL UNIQUE,
          name VARCHAR(255),
          manage_token VARCHAR(64) NOT NULL UNIQUE,
          status VARCHAR(16) NOT NULL DEFAULT 'active',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          last_active_at TIMESTAMP
        )
      `);
      await client.query(`
        CREATE TABLE IF NOT EXISTS saved_searches (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          name VARCHAR(255) NOT NULL DEFAULT 'My Search',
          filters JSONB NOT NULL DEFAULT '{}'::jsonb,
          is_active BOOLEAN NOT NULL DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP,
          last_run_at TIMESTAMP,
          last_email_at TIMESTAMP
        )
      `);
      await client.query(`
        CREATE TABLE IF NOT EXISTS search_snapshots (
          id SERIAL PRIMARY KEY,
          search_id INTEGER NOT NULL REFERENCES saved_searches(id) ON DELETE CASCADE,
          run_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          result_ids JSONB NOT NULL DEFAULT '[]'::jsonb
        )
      `);
      await client.query(`
        CREATE TABLE IF NOT EXISTS alert_events (
          id SERIAL PRIMARY KEY,
          search_id INTEGER NOT NULL REFERENCES saved_searches(id) ON DELETE CASCADE,
          listing_id VARCHAR(64) NOT NULL,
          type VARCHAR(32) NOT NULL,
          detail JSONB,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await client.query(`
        CREATE TABLE IF NOT EXISTS email_log (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          search_id INTEGER REFERENCES saved_searches(id) ON DELETE CASCADE,
          type VARCHAR(32),
          to_email VARCHAR(255),
          subject TEXT,
          events INTEGER DEFAULT 0,
          sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_saved_searches_user ON saved_searches(user_id);
        CREATE INDEX IF NOT EXISTS idx_snapshots_search ON search_snapshots(search_id, run_at);
        CREATE INDEX IF NOT EXISTS idx_alert_events_search ON alert_events(search_id, created_at);
      `);

      await client.query(`
        ALTER TABLE saved_searches ADD COLUMN IF NOT EXISTS frequency VARCHAR(16) DEFAULT 'daily';
        ALTER TABLE saved_searches ADD COLUMN IF NOT EXISTS send_time VARCHAR(5) DEFAULT '06:00';
        ALTER TABLE saved_searches ADD COLUMN IF NOT EXISTS send_day VARCHAR(10) DEFAULT 'Monday';
      `);

      await client.query(`
        ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(50);
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS showing_requests (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          email VARCHAR(255) NOT NULL,
          phone VARCHAR(50),
          showing_date DATE NOT NULL,
          showing_time VARCHAR(20) NOT NULL,
          message TEXT,
          listing_slug VARCHAR(255),
          listing_address VARCHAR(255),
          source_page VARCHAR(255),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
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
      CREATE INDEX IF NOT EXISTS idx_chfa_dpa_lead_submissions_email ON chfa_dpa_lead_submissions(email);
      CREATE INDEX IF NOT EXISTS idx_chfa_dpa_lead_submissions_created_at ON chfa_dpa_lead_submissions(created_at);
      CREATE INDEX IF NOT EXISTS idx_ghope_lead_submissions_email ON ghope_lead_submissions(email);
      CREATE INDEX IF NOT EXISTS idx_ghope_lead_submissions_created_at ON ghope_lead_submissions(created_at);
    `);

    // ── IDX listings (IRES feed) ──────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS listings (
        id SERIAL PRIMARY KEY,
        listing_id VARCHAR(64) NOT NULL UNIQUE,
        status VARCHAR(32) NOT NULL DEFAULT 'Active',
        property_type VARCHAR(64),
        property_subtype VARCHAR(128),
        home_type VARCHAR(16) DEFAULT 'other',
        elementary_school VARCHAR(128),
        middle_school VARCHAR(128),
        high_school VARCHAR(128),
        days_on_market INTEGER,
        price_per_sqft INTEGER,
        subdivision VARCHAR(255),
        features JSONB DEFAULT '{}'::jsonb,
        original_list_price NUMERIC(12,2),
        price_change_timestamp TIMESTAMPTZ,
        half_baths NUMERIC(4,1),
        three_quarter_baths NUMERIC(4,1),
        above_grade_area NUMERIC(12,1),
        lot_size_acres NUMERIC(12,2),
        units_total INTEGER,
        photos_count INTEGER,
        school_district VARCHAR(255),
        street_number VARCHAR(32),
        street_name VARCHAR(255),
        unit VARCHAR(32),
        city VARCHAR(100),
        state VARCHAR(2),
        postal_code VARCHAR(16),
        county VARCHAR(100),
        list_price NUMERIC(12,2),
        beds NUMERIC(4,1),
        baths NUMERIC(4,1),
        living_area NUMERIC(10,1),
        lot_size NUMERIC(12,1),
        year_built INTEGER,
        garage_spaces NUMERIC(4,1),
        hoa_fee NUMERIC(10,2),
        description TEXT,
        photos JSONB NOT NULL DEFAULT '[]'::jsonb,
        latitude NUMERIC(10,7),
        longitude NUMERIC(10,7),
        listing_url TEXT,
        mls_source VARCHAR(32) DEFAULT 'IRES',
        raw JSONB,
        slug VARCHAR(255),
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_listings_status ON listings(status);
      CREATE INDEX IF NOT EXISTS idx_listings_city ON listings(city);
      CREATE INDEX IF NOT EXISTS idx_listings_price ON listings(list_price);
      CREATE INDEX IF NOT EXISTS idx_listings_status_city ON listings(status, city);
      CREATE INDEX IF NOT EXISTS idx_listings_updated_at ON listings(updated_at);
      CREATE INDEX IF NOT EXISTS idx_listings_slug ON listings(slug);
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
