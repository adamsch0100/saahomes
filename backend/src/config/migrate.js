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
        ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
        ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(16) DEFAULT 'client';
      `);

      // Lead score (Scout Score-style) — computed from real engagement signals
      await client.query(`
        ALTER TABLE users ADD COLUMN IF NOT EXISTS lead_score INTEGER DEFAULT 0;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS lead_score_updated_at TIMESTAMP;
      `);

      // Property views for lead scoring + digest personalization
      await client.query(`
        CREATE TABLE IF NOT EXISTS property_views (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          listing_id VARCHAR(64) NOT NULL,
          viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_property_views_user ON property_views(user_id, viewed_at DESC);
        CREATE INDEX IF NOT EXISTS idx_property_views_user_listing ON property_views(user_id, listing_id);
      `);

      // Lightweight activity events (chat_opened, etc.) for lead scoring
      await client.query(`
        CREATE TABLE IF NOT EXISTS user_events (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          event_type VARCHAR(32) NOT NULL,
          meta JSONB,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_user_events_user ON user_events(user_id, event_type, created_at DESC);
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
        CREATE TABLE IF NOT EXISTS email_outbox (
          id SERIAL PRIMARY KEY,
          to_email VARCHAR(255) NOT NULL,
          subject TEXT NOT NULL,
          html TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          sent_at TIMESTAMP
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

    // ── GreatSchools ratings cache (weekly sync, not listings sync) ─────
    // Ratings come ONLY from live JSON-LD on greatschools.org city pages.
    // Never hardcode/fabricate. Attribution required on every display.
    await client.query(`
      CREATE TABLE IF NOT EXISTS school_ratings (
        id SERIAL PRIMARY KEY,
        school_name VARCHAR(255) NOT NULL,
        city VARCHAR(100) NOT NULL,
        city_slug VARCHAR(100) NOT NULL,
        rating SMALLINT,
        review_rating NUMERIC(3,2),
        review_count INTEGER,
        url TEXT,
        level VARCHAR(32),
        fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (school_name, city_slug)
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_school_ratings_city ON school_ratings(city_slug);
      CREATE INDEX IF NOT EXISTS idx_school_ratings_name ON school_ratings(school_name);
      CREATE INDEX IF NOT EXISTS idx_school_ratings_rating ON school_ratings(rating DESC NULLS LAST);
    `);

    // ── Seller nurture track (It 11) ─────────────────────────────────────
    // Intent on signup routes buyers/sellers to the right nurture track
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS intent VARCHAR(16);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS seller_heat BOOLEAN DEFAULT FALSE;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS seller_heat_at TIMESTAMP;
    `);

    // Home profile — one (or more) owned homes for seller value updates
    await client.query(`
      CREATE TABLE IF NOT EXISTS home_profiles (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        address_line VARCHAR(255) NOT NULL,
        unit VARCHAR(32),
        city VARCHAR(100),
        state VARCHAR(2) DEFAULT 'CO',
        postal_code VARCHAR(16),
        beds NUMERIC(4,1),
        baths NUMERIC(4,1),
        living_area NUMERIC(10,1),
        year_built INTEGER,
        zpid VARCHAR(32),
        our_estimate_low INTEGER,
        our_estimate_mid INTEGER,
        our_estimate_high INTEGER,
        our_estimate_label TEXT,
        our_estimate_at TIMESTAMP,
        market_estimate_mid INTEGER,
        market_estimates JSONB DEFAULT '{}'::jsonb,
        chart_series JSONB,
        last_value_view_at TIMESTAMP,
        value_view_count INTEGER NOT NULL DEFAULT 0,
        accuracy_signal VARCHAR(32),
        value_updates_enabled BOOLEAN NOT NULL DEFAULT TRUE,
        last_digest_at TIMESTAMP,
        last_digest_value INTEGER,
        seller_heat BOOLEAN NOT NULL DEFAULT FALSE,
        meta JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_home_profiles_user ON home_profiles(user_id);
      CREATE INDEX IF NOT EXISTS idx_home_profiles_zip ON home_profiles(postal_code);
      CREATE INDEX IF NOT EXISTS idx_home_profiles_digest
        ON home_profiles(value_updates_enabled, last_digest_at)
        WHERE value_updates_enabled = TRUE;
    `);

    // Licensed AVM/API response cache — NEVER call ReefAPI inline without this
    await client.query(`
      CREATE TABLE IF NOT EXISTS zillow_api_cache (
        id SERIAL PRIMARY KEY,
        provider VARCHAR(32) NOT NULL,
        endpoint VARCHAR(64) NOT NULL,
        params_hash VARCHAR(64) NOT NULL,
        payload JSONB NOT NULL,
        credits_used INTEGER NOT NULL DEFAULT 0,
        fetched_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (provider, endpoint, params_hash)
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_zillow_api_cache_lookup
        ON zillow_api_cache(provider, endpoint, params_hash);
      CREATE INDEX IF NOT EXISTS idx_zillow_api_cache_fetched
        ON zillow_api_cache(fetched_at);
    `);

    // Monthly credit counter — hard stop at 90% of free allowance (900/1000)
    await client.query(`
      CREATE TABLE IF NOT EXISTS api_credit_usage (
        id SERIAL PRIMARY KEY,
        provider VARCHAR(32) NOT NULL,
        year_month VARCHAR(7) NOT NULL,
        credits_used INTEGER NOT NULL DEFAULT 0,
        last_flagged_at TIMESTAMP,
        notes TEXT,
        UNIQUE (provider, year_month)
      )
    `);

    // Optional address fields on market report submissions (seller track entry)
    await client.query(`
      ALTER TABLE market_report_submissions ADD COLUMN IF NOT EXISTS address_line VARCHAR(255);
      ALTER TABLE market_report_submissions ADD COLUMN IF NOT EXISTS postal_code VARCHAR(16);
      ALTER TABLE market_report_submissions ADD COLUMN IF NOT EXISTS living_area NUMERIC(10,1);
      ALTER TABLE market_report_submissions ADD COLUMN IF NOT EXISTS home_profile_id INTEGER;
    `);

    // ── Agent cockpit + FUB write-back (It 12) ───────────────────────────
    // fub_person_id links our users row to Follow Up Boss people.id
    // lifecycle_stage: new → nurturing → showing → active → closed/lost
    // next_touch_at drives the "Due today" follow-up queue
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS fub_person_id INTEGER;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS lifecycle_stage VARCHAR(32) DEFAULT 'new';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS lifecycle_stage_manual BOOLEAN DEFAULT FALSE;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS next_touch_at TIMESTAMP;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS last_touched_at TIMESTAMP;
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_fub_person
        ON users(fub_person_id) WHERE fub_person_id IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_users_next_touch
        ON users(next_touch_at) WHERE next_touch_at IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_users_lead_score
        ON users(lead_score DESC NULLS LAST);
      CREATE INDEX IF NOT EXISTS idx_users_lifecycle
        ON users(lifecycle_stage);
    `);

    // ── Account-linked saved homes (It 14a) ──────────────────────────────
    // Hearts sync server-side so favorites survive devices / incognito.
    // listing_key = IRES listing_id (stable); denormalized fields for off-market.
    // user_id is INTEGER to match existing users(id) SERIAL PK.
    await client.query(`
      CREATE TABLE IF NOT EXISTS saved_homes (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        listing_key TEXT NOT NULL,
        property_address TEXT,
        photo_url TEXT,
        list_price INTEGER,
        slug TEXT,
        saved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (user_id, listing_key)
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_saved_homes_user
        ON saved_homes(user_id, saved_at DESC);
      CREATE INDEX IF NOT EXISTS idx_saved_homes_listing_key
        ON saved_homes(listing_key);
    `);

    // ── Notification center (It 14.1 / RealScout Phase D) ─────────────────
    // Surfaces nurture events (new matches, price drops, value updates,
    // off-market) to signed-in users so they have a reason to return.
    await client.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(32) NOT NULL,
        title TEXT NOT NULL,
        body TEXT,
        link TEXT,
        image_url TEXT,
        read_at TIMESTAMP,
        dismissed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
        ON notifications(user_id, read_at) WHERE read_at IS NULL;
      CREATE INDEX IF NOT EXISTS idx_notifications_user_created
        ON notifications(user_id, created_at DESC);
    `);

    // ── Notification cadence prefs (It 18 / Phase D cadence controls) ────
    // Per-user, per-type frequency. Missing row = code default (not an error).
    // frequency: immediate | daily | weekly | monthly | off
    await client.query(`
      CREATE TABLE IF NOT EXISTS notification_prefs (
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type VARCHAR(32) NOT NULL,
        frequency VARCHAR(16) NOT NULL DEFAULT 'immediate',
        updated_at TIMESTAMP DEFAULT NOW(),
        PRIMARY KEY (user_id, type)
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_notification_prefs_user
        ON notification_prefs(user_id);
    `);

    // Optional due_at on email_outbox so daily/weekly notification emails
    // can queue until the next send window (null = send ASAP).
    await client.query(`
      ALTER TABLE email_outbox ADD COLUMN IF NOT EXISTS due_at TIMESTAMP;
      ALTER TABLE email_outbox ADD COLUMN IF NOT EXISTS user_id INTEGER;
      ALTER TABLE email_outbox ADD COLUMN IF NOT EXISTS notification_type VARCHAR(32);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_email_outbox_due
        ON email_outbox(due_at) WHERE sent_at IS NULL;
    `);

    // ── Enrich layer: disposable email block log (P4 / RealScout G4) ─────
    // Fire-and-forget observability when a lead form is rejected for a
    // known throwaway domain. Never blocks capture paths if insert fails.
    await client.query(`
      CREATE TABLE IF NOT EXISTS blocked_email_log (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        domain VARCHAR(255),
        path VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_blocked_email_log_created_at
        ON blocked_email_log(created_at);
      CREATE INDEX IF NOT EXISTS idx_blocked_email_log_domain
        ON blocked_email_log(domain);
      CREATE INDEX IF NOT EXISTS idx_blocked_email_log_path
        ON blocked_email_log(path);
    `);

    // ── A/B subject lines + open tracking (Phase D / It 19a) ─────────────
    // Nurture digests pick a deterministic subject variant per user; each
    // send logs variant + open_token; public 1×1 pixel increments opens.
    await client.query(`
      ALTER TABLE email_log ADD COLUMN IF NOT EXISTS subject_variant VARCHAR(32);
      ALTER TABLE email_log ADD COLUMN IF NOT EXISTS open_token VARCHAR(64);
      ALTER TABLE email_log ADD COLUMN IF NOT EXISTS open_count INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE email_log ADD COLUMN IF NOT EXISTS first_open_at TIMESTAMP;
      ALTER TABLE email_log ADD COLUMN IF NOT EXISTS last_open_at TIMESTAMP;
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_email_log_open_token
        ON email_log(open_token);
      CREATE INDEX IF NOT EXISTS idx_email_log_ab_stats
        ON email_log(type, subject_variant, sent_at);
    `);

    // ── Multi-agent seats (P-1) — lead ownership within team pool ─────────
    // assigned_agent_id NULL = unassigned / team pool. Agents (role=agent)
    // share all client contacts; this column only tracks who is working it.
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS assigned_agent_id INTEGER REFERENCES users(id) ON DELETE SET NULL;
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_assigned_agent
        ON users(assigned_agent_id) WHERE assigned_agent_id IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_users_role
        ON users(role);
    `);

    // ── White-label / tenant brand (P-2) — per-agent brand + email voice ──
    // NULL brand fields → fall back to marketPack (SAA / NoCO defaults).
    // voice_style: warm | professional | short (fixed email templates only).
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS brand_name VARCHAR(120);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS brokerage_name VARCHAR(120);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS brand_phone VARCHAR(30);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS voice_style VARCHAR(16) DEFAULT 'warm';
    `);

    // ── Connect CRM + contact import (P-3a) — per-agent FUB key + source ──
    // fub_api_key is NEVER returned in full by any API (mask last 4 only).
    // source on client rows: e.g. 'fub-import' for CRM-imported contacts.
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS fub_api_key TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS fub_last_import_at TIMESTAMP;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS source VARCHAR(64);
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_source
        ON users(source) WHERE source IS NOT NULL;
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
