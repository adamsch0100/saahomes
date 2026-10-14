import getPool from './database.js';
import { seedDemoListings } from '../services/demoListings.js';

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
        ALTER TABLE search_snapshots ADD COLUMN IF NOT EXISTS result_prices JSONB;
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

    // Columns added after the table first shipped. Kept after the CREATE so a
    // fresh database (staging, tests, a new tenant) can be built from nothing.
    await client.query(`
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

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_listings_status ON listings(status);
      CREATE INDEX IF NOT EXISTS idx_listings_city ON listings(city);
      CREATE INDEX IF NOT EXISTS idx_listings_price ON listings(list_price);
      CREATE INDEX IF NOT EXISTS idx_listings_status_city ON listings(status, city);
      CREATE INDEX IF NOT EXISTS idx_listings_updated_at ON listings(updated_at);
      CREATE INDEX IF NOT EXISTS idx_listings_slug ON listings(slug);
    `);

    // ── Assumable loan flag (It 32b) ─────────────────────────────────────
    // IRES has no structured loan field. Public remarks text is the signal
    // (description ILIKE '%assum%'). Guarded + additive so Railway deploys
    // never fail on the existing table.
    await client.query('SAVEPOINT assumable_col');
    try {
      await client.query(`
        ALTER TABLE listings ADD COLUMN IF NOT EXISTS assumable BOOLEAN;
      `);
      await client.query(`
        UPDATE listings
           SET assumable = (COALESCE(description, '') ILIKE '%assum%')
         WHERE assumable IS NULL
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_listings_assumable
          ON listings (assumable)
          WHERE assumable IS TRUE
      `);
      await client.query('RELEASE SAVEPOINT assumable_col');
    } catch (assumableErr) {
      await client.query('ROLLBACK TO SAVEPOINT assumable_col');
      console.error('assumable column migration skipped:', assumableErr.message);
    }

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

    // ── Wire website forms (P-3b) — per-agent public capture slug ──────────
    // webform_slug is the public identifier for POST /api/webform/lead.
    // Unique only when set; never expose fub_api_key via this surface.
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS webform_slug TEXT;
    `);
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_webform_slug
        ON users(webform_slug) WHERE webform_slug IS NOT NULL;
    `);

    // ── Market content pack (P-4) — per-agent market_key ───────────────────
    // Sparse enum: 'noco' today; NULL/unknown → getMarketPack falls back to
    // NoCO. No index (low cardinality / sparse admin writes only).
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS market_key VARCHAR(32);
    `);

    // ── Custom domains (P-2b) — per-agent branded hostname ─────────────────
    // custom_domain is a normalized hostname (no scheme/path). Verification
    // is REAL DNS TXT only (saa-verify=<token>); domain_verified_at is set
    // solely by a successful lookup. Unique among verified domains so two
    // agents cannot claim the same host. Unverified rows may collide.
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS custom_domain VARCHAR(255);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS domain_verified_at TIMESTAMPTZ;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS domain_verify_token VARCHAR(64);
    `);
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_custom_domain_verified
        ON users (custom_domain)
        WHERE custom_domain IS NOT NULL AND domain_verified_at IS NOT NULL;
    `);

    // ── Sold / closed listings (It 41) ───────────────────────────────────
    // MLS Grid Closed rows only. Never invent sold_price / closed_date.
    await client.query('SAVEPOINT sold_listings_table');
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS sold_listings (
          listing_id VARCHAR(64) PRIMARY KEY,
          mls_source VARCHAR(32),
          city VARCHAR(100),
          county VARCHAR(100),
          street_number VARCHAR(32),
          street_name VARCHAR(255),
          unit VARCHAR(32),
          address VARCHAR(255),
          postal_code VARCHAR(16),
          lat NUMERIC(10,7),
          lng NUMERIC(10,7),
          property_type VARCHAR(64),
          home_type VARCHAR(16),
          beds NUMERIC(4,1),
          baths NUMERIC(4,1),
          living_area NUMERIC(10,1),
          lot_size NUMERIC(12,1),
          list_price NUMERIC(12,2),
          sold_price NUMERIC(12,2),
          closed_date DATE,
          days_on_market INTEGER,
          parcel_number VARCHAR(64),
          subdivision VARCHAR(255),
          elementary_school VARCHAR(128),
          middle_school VARCHAR(128),
          high_school VARCHAR(128),
          school_district VARCHAR(255),
          photos JSONB NOT NULL DEFAULT '[]'::jsonb,
          photos_count INTEGER,
          modification_timestamp TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_sold_listings_city ON sold_listings(city);
        CREATE INDEX IF NOT EXISTS idx_sold_listings_closed_date ON sold_listings(closed_date DESC);
        CREATE INDEX IF NOT EXISTS idx_sold_listings_city_closed
          ON sold_listings(city, closed_date DESC);
      `);
      await client.query('RELEASE SAVEPOINT sold_listings_table');
    } catch (soldErr) {
      await client.query('ROLLBACK TO SAVEPOINT sold_listings_table');
      console.error('sold_listings migration skipped:', soldErr.message);
    }

    // ── Platform foundation (Phase 1) ─────────────────────────────────────
    // Shared by search, Nadia and the CRM: tenants (SAA is tenant 1), a tenant
    // id on every client table, households, one event stream and a consent
    // log. Savepoint so a problem here can never roll back the migrations
    // above on a production deploy.
    await client.query('SAVEPOINT platform_foundation');
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS tenants (
          id SERIAL PRIMARY KEY,
          slug VARCHAR(64) NOT NULL UNIQUE,
          name VARCHAR(255) NOT NULL,
          primary_domain VARCHAR(255),
          market_key VARCHAR(32) NOT NULL DEFAULT 'noco',
          status VARCHAR(16) NOT NULL DEFAULT 'active',
          settings JSONB NOT NULL DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        INSERT INTO tenants (id, slug, name, primary_domain, market_key)
        VALUES (1, 'saa', 'SAA Homes', 'saahomes.com', 'noco')
        ON CONFLICT (id) DO NOTHING;
        SELECT setval(pg_get_serial_sequence('tenants', 'id'), GREATEST((SELECT MAX(id) FROM tenants), 1));
      `);

      // Constant defaults make these metadata-only changes (no table rewrite).
      for (const table of [
        'users', 'saved_searches', 'saved_homes', 'notifications', 'notification_prefs',
        'home_profiles', 'property_views', 'user_events', 'email_log', 'email_outbox',
        'showing_requests', 'alert_events',
      ]) {
        await client.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS tenant_id INTEGER NOT NULL DEFAULT 1`);
      }

      await client.query(`
        CREATE TABLE IF NOT EXISTS households (
          id SERIAL PRIMARY KEY,
          tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id),
          name VARCHAR(255),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        ALTER TABLE users ADD COLUMN IF NOT EXISTS household_id INTEGER REFERENCES households(id) ON DELETE SET NULL;
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS events (
          id BIGSERIAL PRIMARY KEY,
          tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id),
          user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          visitor_id VARCHAR(32),
          type VARCHAR(48) NOT NULL,
          listing_id VARCHAR(64),
          search_id INTEGER,
          source VARCHAR(32) NOT NULL DEFAULT 'web',
          meta JSONB NOT NULL DEFAULT '{}'::jsonb,
          occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          fub_synced_at TIMESTAMPTZ,
          CHECK (user_id IS NOT NULL OR visitor_id IS NOT NULL)
        );
        CREATE INDEX IF NOT EXISTS idx_events_user_time ON events(user_id, occurred_at DESC) WHERE user_id IS NOT NULL;
        CREATE INDEX IF NOT EXISTS idx_events_visitor_unclaimed ON events(visitor_id) WHERE user_id IS NULL;
        CREATE INDEX IF NOT EXISTS idx_events_tenant_type_time ON events(tenant_id, type, occurred_at DESC);
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS contact_consents (
          id SERIAL PRIMARY KEY,
          tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id),
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          channel VARCHAR(16) NOT NULL CHECK (channel IN ('email', 'sms', 'push', 'call')),
          status VARCHAR(16) NOT NULL CHECK (status IN ('granted', 'revoked')),
          wording TEXT,
          source VARCHAR(128),
          ip VARCHAR(64),
          user_agent TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_contact_consents_user ON contact_consents(user_id, channel, created_at DESC);
      `);
      await client.query('RELEASE SAVEPOINT platform_foundation');
    } catch (foundationErr) {
      await client.query('ROLLBACK TO SAVEPOINT platform_foundation');
      console.error('platform foundation migration skipped:', foundationErr.message);
    }

    // ── Installable app + web push ───────────────────────────────────────
    await client.query('SAVEPOINT web_push');
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS app_settings (
          key VARCHAR(64) PRIMARY KEY,
          value JSONB NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE TABLE IF NOT EXISTS push_subscriptions (
          id SERIAL PRIMARY KEY,
          tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id),
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          endpoint TEXT NOT NULL UNIQUE,
          p256dh TEXT NOT NULL,
          auth TEXT NOT NULL,
          user_agent TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          last_success_at TIMESTAMPTZ,
          last_error TEXT,
          disabled_at TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id) WHERE disabled_at IS NULL;
        CREATE TABLE IF NOT EXISTS push_log (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          notification_ids INTEGER[] NOT NULL DEFAULT '{}',
          title TEXT,
          delivered INTEGER NOT NULL DEFAULT 0,
          sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_push_log_user_time ON push_log(user_id, sent_at DESC);
        ALTER TABLE notifications ADD COLUMN IF NOT EXISTS pushed_at TIMESTAMP;
        ALTER TABLE notifications ADD COLUMN IF NOT EXISTS push_status VARCHAR(16);
        ALTER TABLE saved_searches ADD COLUMN IF NOT EXISTS push_cursor_at TIMESTAMP;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS fub_lead_score_synced INTEGER;
      `);
      await client.query('RELEASE SAVEPOINT web_push');
    } catch (pushErr) {
      await client.query('ROLLBACK TO SAVEPOINT web_push');
      console.error('web push migration skipped:', pushErr.message);
    }

    // ── Reactions and taste profile (Phase 2) ───────────────────────────
    // Love / Maybe / Not for me on any home, with a private note. Love and
    // Maybe also keep the home on the saved list; Not for me hides it.
    await client.query('SAVEPOINT home_reactions');
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS home_reactions (
          id SERIAL PRIMARY KEY,
          tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id),
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          listing_key TEXT NOT NULL,
          reaction VARCHAR(8) CHECK (reaction IN ('love', 'maybe', 'pass')),
          note TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE (user_id, listing_key)
        );
        CREATE INDEX IF NOT EXISTS idx_home_reactions_pass ON home_reactions(user_id) WHERE reaction = 'pass';
      `);
      await client.query('RELEASE SAVEPOINT home_reactions');
    } catch (reactionErr) {
      await client.query('ROLLBACK TO SAVEPOINT home_reactions');
      console.error('home reactions migration skipped:', reactionErr.message);
    }

    // ── Household boards (Phase 2) ───────────────────────────────────────
    // A buyer invites a co-buyer by email; the household shares one board of
    // saved homes with comments. Invite tokens are stored hashed.
    await client.query('SAVEPOINT household_boards');
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS household_invites (
          id SERIAL PRIMARY KEY,
          tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id),
          household_id INTEGER NOT NULL REFERENCES households(id) ON DELETE CASCADE,
          invited_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
          email VARCHAR(255) NOT NULL,
          name VARCHAR(255),
          token_hash CHAR(64) NOT NULL UNIQUE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          expires_at TIMESTAMPTZ NOT NULL,
          accepted_at TIMESTAMPTZ,
          accepted_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
          revoked_at TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS idx_household_invites_household ON household_invites(household_id);
        CREATE TABLE IF NOT EXISTS home_comments (
          id SERIAL PRIMARY KEY,
          tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id),
          household_id INTEGER NOT NULL REFERENCES households(id) ON DELETE CASCADE,
          listing_key TEXT NOT NULL,
          user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
          body TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_home_comments_board ON home_comments(household_id, listing_key, created_at);
      `);
      await client.query('RELEASE SAVEPOINT household_boards');
    } catch (boardErr) {
      await client.query('ROLLBACK TO SAVEPOINT household_boards');
      console.error('household boards migration skipped:', boardErr.message);
    }

    // ── Tour planner (Phase 2) ───────────────────────────────────────────
    await client.query('SAVEPOINT tour_requests');
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS tour_requests (
          id SERIAL PRIMARY KEY,
          tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id),
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          household_id INTEGER REFERENCES households(id) ON DELETE SET NULL,
          listing_keys TEXT[] NOT NULL,
          windows JSONB NOT NULL,
          note TEXT,
          est_minutes INTEGER,
          status VARCHAR(16) NOT NULL DEFAULT 'requested',
          showing_request_id INTEGER,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_tour_requests_user ON tour_requests(user_id, created_at DESC);
      `);
      await client.query('RELEASE SAVEPOINT tour_requests');
    } catch (tourErr) {
      await client.query('ROLLBACK TO SAVEPOINT tour_requests');
      console.error('tour requests migration skipped:', tourErr.message);
    }

    // ── Agent morning brief ──────────────────────────────────────────────
    await client.query('SAVEPOINT morning_briefs');
    try {
      await client.query(`
        ALTER TABLE users ADD COLUMN IF NOT EXISTS morning_brief BOOLEAN NOT NULL DEFAULT TRUE;
        CREATE TABLE IF NOT EXISTS morning_briefs (
          id SERIAL PRIMARY KEY,
          agent_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          brief_date DATE NOT NULL,
          lead_count INTEGER NOT NULL DEFAULT 0,
          sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE (agent_id, brief_date)
        );
      `);
      await client.query('RELEASE SAVEPOINT morning_briefs');
    } catch (briefErr) {
      await client.query('ROLLBACK TO SAVEPOINT morning_briefs');
      console.error('morning brief migration skipped:', briefErr.message);
    }

    // ── Lead submit leg log (GA4 / FUB / notify evidence per submit) ──────
    await client.query('SAVEPOINT lead_submit_log');
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS lead_submit_log (
          id SERIAL PRIMARY KEY,
          lead_type VARCHAR(64) NOT NULL,
          submission_id INTEGER,
          email VARCHAR(255),
          source_page VARCHAR(255),
          ga4_fired BOOLEAN,
          ga4_status INTEGER,
          ga4_error TEXT,
          ga4_at TIMESTAMPTZ,
          fub_result VARCHAR(32),
          fub_person_id INTEGER,
          fub_error TEXT,
          fub_at TIMESTAMPTZ,
          notify_result VARCHAR(32),
          notify_message_id VARCHAR(255),
          notify_error TEXT,
          notify_at TIMESTAMPTZ,
          received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        ALTER TABLE lead_submit_log ADD COLUMN IF NOT EXISTS ga4_event_id VARCHAR(64);
        ALTER TABLE lead_submit_log ADD COLUMN IF NOT EXISTS board_result VARCHAR(32);
        ALTER TABLE lead_submit_log ADD COLUMN IF NOT EXISTS board_status INTEGER;
        ALTER TABLE lead_submit_log ADD COLUMN IF NOT EXISTS board_error TEXT;
        ALTER TABLE lead_submit_log ADD COLUMN IF NOT EXISTS board_at TIMESTAMPTZ;
        ALTER TABLE lead_submit_log ADD COLUMN IF NOT EXISTS human_notified_at TIMESTAMPTZ;
        ALTER TABLE lead_submit_log ADD COLUMN IF NOT EXISTS minutes_to_human NUMERIC(10,2);
        CREATE INDEX IF NOT EXISTS idx_lead_submit_log_submission ON lead_submit_log(lead_type, submission_id);
        CREATE INDEX IF NOT EXISTS idx_lead_submit_log_email ON lead_submit_log(LOWER(email));
      `);
      await client.query('RELEASE SAVEPOINT lead_submit_log');
    } catch (logErr) {
      await client.query('ROLLBACK TO SAVEPOINT lead_submit_log');
      console.error('lead submit log migration skipped:', logErr.message);
    }

    // ── Walls between brokerages ─────────────────────────────────────────
    // Email is unique per brokerage, not across the platform, so the same
    // person can be a lead at two brokerages without either seeing the other.
    // Rows that belong to a person, a saved search or a household take their
    // tenant from that parent in the database itself, so no insert can file a
    // row under the wrong brokerage.
    await client.query('SAVEPOINT tenant_walls');
    try {
      for (const table of [
        'contact_submissions', 'market_report_submissions', 'chfa_lead_submissions',
        'champions_lead_submissions', 'chfa_dpa_lead_submissions', 'ghope_lead_submissions',
        'lead_submit_log', 'search_snapshots', 'push_log', 'blocked_email_log',
      ]) {
        await client.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS tenant_id INTEGER NOT NULL DEFAULT 1`);
      }
      await client.query(`
        ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key;
        CREATE UNIQUE INDEX IF NOT EXISTS users_tenant_email_key ON users(tenant_id, email);
        CREATE INDEX IF NOT EXISTS idx_users_tenant_role ON users(tenant_id, role);
        CREATE INDEX IF NOT EXISTS idx_users_tenant_lower_email ON users(tenant_id, LOWER(email));
        -- SAA's agents keep seeing every lead, as they always have. New
        -- brokerages start with each agent's own leads plus the unassigned pond.
        UPDATE tenants SET settings = settings || '{"lead_visibility":"all"}'
        WHERE id = 1 AND NOT (settings ? 'lead_visibility');

        CREATE OR REPLACE FUNCTION tenant_from_parent() RETURNS trigger AS $fn$
        DECLARE
          parent_id TEXT;
          parent_tenant INTEGER;
        BEGIN
          parent_id := to_jsonb(NEW) ->> TG_ARGV[1];
          IF parent_id IS NOT NULL THEN
            EXECUTE format('SELECT tenant_id FROM %I WHERE id = $1', TG_ARGV[0])
              INTO parent_tenant USING parent_id::integer;
            IF parent_tenant IS NOT NULL THEN
              NEW.tenant_id := parent_tenant;
            END IF;
          END IF;
          RETURN NEW;
        END
        $fn$ LANGUAGE plpgsql;
      `);
      const parents = {
        users: ['saved_searches', 'saved_homes', 'notifications', 'notification_prefs', 'home_profiles',
          'property_views', 'user_events', 'email_log', 'events', 'contact_consents', 'push_subscriptions',
          'home_reactions', 'tour_requests', 'push_log', 'email_outbox'],
        saved_searches: ['alert_events', 'search_snapshots'],
        households: ['household_invites', 'home_comments'],
      };
      const parentKey = { users: 'user_id', saved_searches: 'search_id', households: 'household_id' };
      for (const [parent, tables] of Object.entries(parents)) {
        for (const table of tables) {
          await client.query(`
            DROP TRIGGER IF EXISTS ${table}_tenant ON ${table};
            CREATE TRIGGER ${table}_tenant BEFORE INSERT ON ${table}
              FOR EACH ROW EXECUTE FUNCTION tenant_from_parent('${parent}', '${parentKey[parent]}');
          `);
        }
      }
      await client.query('RELEASE SAVEPOINT tenant_walls');
    } catch (wallErr) {
      await client.query('ROLLBACK TO SAVEPOINT tenant_walls');
      console.error('tenant walls migration skipped:', wallErr.message);
    }

    // Staff accounts: password reset and invite links (only a hash of the
    // token is stored), and two-step sign-in with an authenticator app.
    await client.query('SAVEPOINT staff_auth');
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS password_resets (
          id SERIAL PRIMARY KEY,
          tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id),
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          token_hash CHAR(64) NOT NULL UNIQUE,
          purpose VARCHAR(16) NOT NULL DEFAULT 'reset',
          expires_at TIMESTAMPTZ NOT NULL,
          used_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_password_resets_user ON password_resets(user_id, created_at DESC);
        ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_secret_enc TEXT;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_pending_enc TEXT;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_enabled_at TIMESTAMPTZ;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_last_step BIGINT;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_recovery_hashes TEXT[];
        DROP TRIGGER IF EXISTS password_resets_tenant ON password_resets;
        CREATE TRIGGER password_resets_tenant BEFORE INSERT ON password_resets
          FOR EACH ROW EXECUTE FUNCTION tenant_from_parent('users', 'user_id');
      `);
      await client.query('RELEASE SAVEPOINT staff_auth');
    } catch (staffErr) {
      await client.query('ROLLBACK TO SAVEPOINT staff_auth');
      console.error('staff auth migration skipped:', staffErr.message);
    }

    // Plug and play: self-serve signup (owner email confirmation), the
    // once-per-home "viewed 3 times" Follow Up Boss note, and Follow Up Boss
    // webhook deliveries already handled (FUB retries until it gets a 2xx).
    await client.query('SAVEPOINT plug_and_play');
    try {
      await client.query(`
        ALTER TABLE users ADD COLUMN IF NOT EXISTS email_confirmed_at TIMESTAMPTZ;
        CREATE TABLE IF NOT EXISTS fub_view_notes (
          tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          listing_id VARCHAR(64) NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          PRIMARY KEY (user_id, listing_id)
        );
        CREATE INDEX IF NOT EXISTS idx_fub_view_notes_tenant ON fub_view_notes(tenant_id);
        DROP TRIGGER IF EXISTS fub_view_notes_tenant ON fub_view_notes;
        CREATE TRIGGER fub_view_notes_tenant BEFORE INSERT ON fub_view_notes
          FOR EACH ROW EXECUTE FUNCTION tenant_from_parent('users', 'user_id');
        CREATE TABLE IF NOT EXISTS fub_webhook_events (
          tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
          event_id VARCHAR(64) NOT NULL,
          event VARCHAR(48) NOT NULL,
          received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          PRIMARY KEY (tenant_id, event_id)
        );
        CREATE INDEX IF NOT EXISTS idx_fub_webhook_events_tenant ON fub_webhook_events(tenant_id, received_at DESC);
      `);
      await client.query('RELEASE SAVEPOINT plug_and_play');
    } catch (plugErr) {
      await client.query('ROLLBACK TO SAVEPOINT plug_and_play');
      console.error('plug and play migration skipped:', plugErr.message);
    }

    // Brokerage brand files (logo, app icon, agent photos) and agent profiles.
    await client.query('SAVEPOINT brand_settings');
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS tenant_assets (
          tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
          kind VARCHAR(40) NOT NULL,
          mime VARCHAR(40) NOT NULL,
          data BYTEA NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          PRIMARY KEY (tenant_id, kind)
        );
        ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_url TEXT;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS title VARCHAR(120);
        ALTER TABLE users ADD COLUMN IF NOT EXISTS license_number VARCHAR(60);
        ALTER TABLE users ADD COLUMN IF NOT EXISTS notify_prefs JSONB NOT NULL DEFAULT '{}'::jsonb;
      `);
      await client.query('RELEASE SAVEPOINT brand_settings');
    } catch (brandErr) {
      await client.query('ROLLBACK TO SAVEPOINT brand_settings');
      console.error('brand settings migration skipped:', brandErr.message);
    }

    // MLS feeds: which listing feeds exist, which ones each brokerage is
    // approved to show, and the feed each listing came from. A brokerage
    // with no approved feed sees sample homes only.
    await client.query('SAVEPOINT mls_feeds');
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS mls_feeds (
          key VARCHAR(16) PRIMARY KEY,
          name VARCHAR(80) NOT NULL,
          vendor VARCHAR(120),
          disclaimer TEXT NOT NULL DEFAULT '',
          sold_data_allowed BOOLEAN NOT NULL DEFAULT FALSE,
          courtesy_required BOOLEAN NOT NULL DEFAULT TRUE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        INSERT INTO mls_feeds (key, name, vendor, disclaimer, sold_data_allowed, courtesy_required) VALUES
          ('ires', 'IRES', 'IRES via MLS Grid',
           'Listing data provided by IRES MLS via IDX and displayed by {brokerage}. Information is deemed reliable but not guaranteed. All measurements and square footage are approximate. Buyer should verify all information with independent sources before making decisions. Listing information last updated {updated}.',
           TRUE, TRUE),
          ('demo', 'Sample listings', 'Sample data',
           'These are sample homes so you can try {brokerage}''s home search. They are not real listings and are not for sale. Live MLS listings appear here once the MLS approves this site.',
           TRUE, FALSE)
        ON CONFLICT (key) DO NOTHING;

        CREATE TABLE IF NOT EXISTS tenant_feeds (
          tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
          feed_key VARCHAR(16) NOT NULL REFERENCES mls_feeds(key),
          status VARCHAR(16) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'suspended')),
          office_mls_id VARCHAR(40),
          sold_enabled BOOLEAN NOT NULL DEFAULT FALSE,
          notes TEXT,
          approved_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          PRIMARY KEY (tenant_id, feed_key)
        );
        CREATE INDEX IF NOT EXISTS idx_tenant_feeds_tenant ON tenant_feeds(tenant_id);
        INSERT INTO tenant_feeds (tenant_id, feed_key, status, sold_enabled, approved_at, notes)
          SELECT 1, 'ires', 'approved', TRUE, NOW(), 'Home brokerage'
          WHERE EXISTS (SELECT 1 FROM tenants WHERE id = 1)
        ON CONFLICT (tenant_id, feed_key) DO NOTHING;

        CREATE TABLE IF NOT EXISTS tenant_feed_log (
          id BIGSERIAL PRIMARY KEY,
          tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
          feed_key VARCHAR(16),
          changed_by VARCHAR(255),
          changes JSONB NOT NULL DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_tenant_feed_log_tenant ON tenant_feed_log(tenant_id, created_at DESC);

        ALTER TABLE listings ADD COLUMN IF NOT EXISTS feed VARCHAR(16) NOT NULL DEFAULT 'ires';
        ALTER TABLE listings ADD COLUMN IF NOT EXISTS list_office_name VARCHAR(255);
        ALTER TABLE listings ADD COLUMN IF NOT EXISTS list_office_mls_id VARCHAR(40);
        ALTER TABLE listings ADD COLUMN IF NOT EXISTS list_agent_name VARCHAR(255);
        ALTER TABLE listings ADD COLUMN IF NOT EXISTS list_agent_mls_id VARCHAR(40);
        CREATE INDEX IF NOT EXISTS idx_listings_feed ON listings(feed);

        ALTER TABLE sold_listings ADD COLUMN IF NOT EXISTS feed VARCHAR(16) NOT NULL DEFAULT 'ires';
        ALTER TABLE sold_listings ADD COLUMN IF NOT EXISTS list_office_name VARCHAR(255);
        ALTER TABLE sold_listings ADD COLUMN IF NOT EXISTS list_office_mls_id VARCHAR(40);
        ALTER TABLE sold_listings ADD COLUMN IF NOT EXISTS list_agent_name VARCHAR(255);
        ALTER TABLE sold_listings ADD COLUMN IF NOT EXISTS list_agent_mls_id VARCHAR(40);
        CREATE INDEX IF NOT EXISTS idx_sold_listings_feed ON sold_listings(feed);

        -- One home carried by two feeds shows once: same street address and
        -- unit in the same town.
        CREATE OR REPLACE FUNCTION listing_address_key(num TEXT, street TEXT, unit TEXT, city TEXT)
          RETURNS TEXT LANGUAGE sql IMMUTABLE AS $fn$
            SELECT LOWER(REGEXP_REPLACE(
              COALESCE(num, '') || '|' || COALESCE(street, '') || '|' || COALESCE(unit, '') || '|' || COALESCE(city, ''),
              '[^A-Za-z0-9|]+', '', 'g'))
          $fn$;
        CREATE INDEX IF NOT EXISTS idx_listings_address_key
          ON listings (listing_address_key(street_number, street_name, unit, city));
      `);
      await client.query('RELEASE SAVEPOINT mls_feeds');
    } catch (feedErr) {
      await client.query('ROLLBACK TO SAVEPOINT mls_feeds');
      console.error('mls feeds migration skipped:', feedErr.message);
    }

    // Sample homes for brokerages still waiting on their MLS (feed = 'demo').
    await client.query('SAVEPOINT demo_listings');
    try {
      await seedDemoListings(client);
      await client.query('RELEASE SAVEPOINT demo_listings');
    } catch (demoErr) {
      await client.query('ROLLBACK TO SAVEPOINT demo_listings');
      console.error('sample listings seed skipped:', demoErr.message);
    }

    // Light CRM in the cockpit: notes, tasks, texts and emails per lead,
    // reply drafts the agent approves, hot-lead alerts, and the per-brokerage
    // text opt-out list. Each row takes its tenant from the lead.
    await client.query('SAVEPOINT agent_crm');
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS lead_notes (
          id SERIAL PRIMARY KEY,
          tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id),
          lead_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          author_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
          author_name VARCHAR(255),
          kind VARCHAR(16) NOT NULL DEFAULT 'note',
          body TEXT NOT NULL,
          pinned BOOLEAN NOT NULL DEFAULT FALSE,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ,
          edited_by_name VARCHAR(255),
          deleted_at TIMESTAMPTZ,
          fub_synced_at TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS idx_lead_notes_tenant ON lead_notes(tenant_id);
        CREATE INDEX IF NOT EXISTS idx_lead_notes_lead ON lead_notes(lead_id, created_at DESC);

        CREATE TABLE IF NOT EXISTS lead_tasks (
          id SERIAL PRIMARY KEY,
          tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id),
          lead_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          assignee_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
          created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
          title VARCHAR(255) NOT NULL,
          kind VARCHAR(16) NOT NULL DEFAULT 'follow_up',
          due_at TIMESTAMPTZ,
          remind_at TIMESTAMPTZ,
          reminded_at TIMESTAMPTZ,
          done_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ,
          fub_task_id INTEGER,
          fub_synced_at TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS idx_lead_tasks_tenant ON lead_tasks(tenant_id);
        CREATE INDEX IF NOT EXISTS idx_lead_tasks_lead ON lead_tasks(lead_id, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_lead_tasks_open ON lead_tasks(tenant_id, assignee_id, due_at) WHERE done_at IS NULL;

        CREATE TABLE IF NOT EXISTS lead_messages (
          id BIGSERIAL PRIMARY KEY,
          tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id),
          lead_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          agent_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
          channel VARCHAR(8) NOT NULL CHECK (channel IN ('sms', 'email')),
          direction VARCHAR(4) NOT NULL CHECK (direction IN ('out', 'in')),
          kind VARCHAR(24) NOT NULL DEFAULT 'conversation',
          to_addr VARCHAR(255),
          from_addr VARCHAR(255),
          subject TEXT,
          body TEXT NOT NULL,
          status VARCHAR(16) NOT NULL DEFAULT 'queued',
          error TEXT,
          provider_id VARCHAR(64),
          draft_id INTEGER,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_lead_messages_tenant ON lead_messages(tenant_id, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_lead_messages_lead ON lead_messages(lead_id, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_lead_messages_provider ON lead_messages(provider_id) WHERE provider_id IS NOT NULL;

        CREATE TABLE IF NOT EXISTS sms_opt_outs (
          tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
          phone VARCHAR(20) NOT NULL,
          source VARCHAR(32),
          opted_out_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          PRIMARY KEY (tenant_id, phone)
        );

        CREATE TABLE IF NOT EXISTS reply_drafts (
          id SERIAL PRIMARY KEY,
          tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id),
          lead_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          agent_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
          channel VARCHAR(8) NOT NULL CHECK (channel IN ('sms', 'email')),
          subject TEXT,
          body TEXT NOT NULL,
          source VARCHAR(16) NOT NULL DEFAULT 'nadia',
          status VARCHAR(16) NOT NULL DEFAULT 'draft',
          message_id BIGINT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          sent_at TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS idx_reply_drafts_tenant ON reply_drafts(tenant_id);
        CREATE INDEX IF NOT EXISTS idx_reply_drafts_lead ON reply_drafts(lead_id, created_at DESC);

        CREATE TABLE IF NOT EXISTS hot_lead_alerts (
          id SERIAL PRIMARY KEY,
          tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id),
          lead_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          agent_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
          reason VARCHAR(32) NOT NULL,
          detail TEXT,
          channels TEXT[] NOT NULL DEFAULT '{}',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_hot_lead_alerts_tenant ON hot_lead_alerts(tenant_id, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_hot_lead_alerts_lead ON hot_lead_alerts(lead_id, reason, created_at DESC);

        ALTER TABLE users ADD COLUMN IF NOT EXISTS first_contacted_at TIMESTAMPTZ;
        ALTER TABLE saved_searches ADD COLUMN IF NOT EXISTS sms_cursor_at TIMESTAMP;
        ALTER TABLE tour_requests ADD COLUMN IF NOT EXISTS confirmed_start TIMESTAMPTZ;
        ALTER TABLE tour_requests ADD COLUMN IF NOT EXISTS confirmed_by INTEGER;
        ALTER TABLE tour_requests ADD COLUMN IF NOT EXISTS ack_texted_at TIMESTAMPTZ;
        ALTER TABLE tour_requests ADD COLUMN IF NOT EXISTS reminder_texted_at TIMESTAMPTZ;
      `);
      for (const table of ['lead_notes', 'lead_tasks', 'lead_messages', 'reply_drafts', 'hot_lead_alerts']) {
        await client.query(`
          DROP TRIGGER IF EXISTS ${table}_tenant ON ${table};
          CREATE TRIGGER ${table}_tenant BEFORE INSERT ON ${table}
            FOR EACH ROW EXECUTE FUNCTION tenant_from_parent('users', 'lead_id');
        `);
      }
      await client.query('RELEASE SAVEPOINT agent_crm');
    } catch (crmErr) {
      await client.query('ROLLBACK TO SAVEPOINT agent_crm');
      console.error('agent crm migration skipped:', crmErr.message);
    }

    // Client life after the search (phase 5): closing facts and stay-in-touch
    // emails, seller-intent scores, and the seller dashboard (plan, showing
    // feedback, offers). Every row carries its brokerage.
    await client.query('SAVEPOINT p5_client_life');
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS client_closings (
          id SERIAL PRIMARY KEY,
          tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id),
          user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
          agent_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
          home_profile_id INTEGER REFERENCES home_profiles(id) ON DELETE SET NULL,
          side VARCHAR(8) NOT NULL DEFAULT 'buyer',
          address_line VARCHAR(255) NOT NULL,
          city VARCHAR(100),
          state VARCHAR(2),
          postal_code VARCHAR(16),
          close_date DATE NOT NULL,
          close_price INTEGER,
          loan_amount INTEGER,
          loan_rate NUMERIC(5,3),
          loan_years SMALLINT,
          birthday_month SMALLINT CHECK (birthday_month BETWEEN 1 AND 12),
          birthday_day SMALLINT CHECK (birthday_day BETWEEN 1 AND 31),
          stay_in_touch BOOLEAN NOT NULL DEFAULT FALSE,
          consent_at TIMESTAMPTZ,
          target_rate NUMERIC(5,3),
          agent_note TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_client_closings_tenant ON client_closings(tenant_id, agent_id);
        CREATE TABLE IF NOT EXISTS stay_touch_prefs (
          tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id),
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          kind VARCHAR(16) NOT NULL,
          agent_off BOOLEAN NOT NULL DEFAULT FALSE,
          client_off BOOLEAN NOT NULL DEFAULT FALSE,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          PRIMARY KEY (user_id, kind)
        );
        CREATE INDEX IF NOT EXISTS idx_stay_touch_prefs_tenant ON stay_touch_prefs(tenant_id);
        CREATE TABLE IF NOT EXISTS stay_touch_sends (
          id SERIAL PRIMARY KEY,
          tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id),
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          kind VARCHAR(16) NOT NULL,
          period_key VARCHAR(40) NOT NULL,
          subject TEXT,
          open_token VARCHAR(64),
          sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE (user_id, kind, period_key)
        );
        CREATE INDEX IF NOT EXISTS idx_stay_touch_sends_tenant ON stay_touch_sends(tenant_id, sent_at DESC);
        CREATE TABLE IF NOT EXISTS stay_touch_templates (
          tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id),
          agent_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          kind VARCHAR(16) NOT NULL,
          subject TEXT NOT NULL,
          body TEXT NOT NULL,
          approved_at TIMESTAMPTZ,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          PRIMARY KEY (agent_id, kind)
        );
        CREATE INDEX IF NOT EXISTS idx_stay_touch_templates_tenant ON stay_touch_templates(tenant_id);
        CREATE TABLE IF NOT EXISTS seller_intent (
          tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id),
          user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
          score INTEGER NOT NULL DEFAULT 0,
          reasons JSONB NOT NULL DEFAULT '[]'::jsonb,
          computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          fub_pushed_at TIMESTAMPTZ,
          fub_pushed_score INTEGER
        );
        CREATE INDEX IF NOT EXISTS idx_seller_intent_tenant ON seller_intent(tenant_id, score DESC);
        CREATE TABLE IF NOT EXISTS seller_plans (
          id SERIAL PRIMARY KEY,
          tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id),
          user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
          agent_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
          home_profile_id INTEGER REFERENCES home_profiles(id) ON DELETE SET NULL,
          origin VARCHAR(8) NOT NULL DEFAULT 'client',
          status VARCHAR(16) NOT NULL DEFAULT 'preparing',
          address_line VARCHAR(255),
          city VARCHAR(100),
          postal_code VARCHAR(16),
          listing_key VARCHAR(64),
          list_price INTEGER,
          cma_requested_at TIMESTAMPTZ,
          cma_note TEXT,
          cma_ready_at TIMESTAMPTZ,
          cma_summary TEXT,
          checklist JSONB NOT NULL DEFAULT '[]'::jsonb,
          timeline JSONB NOT NULL DEFAULT '[]'::jsonb,
          closing_checklist JSONB NOT NULL DEFAULT '[]'::jsonb,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_seller_plans_tenant ON seller_plans(tenant_id, agent_id);
        CREATE TABLE IF NOT EXISTS seller_showing_feedback (
          id SERIAL PRIMARY KEY,
          tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id),
          plan_id INTEGER NOT NULL REFERENCES seller_plans(id) ON DELETE CASCADE,
          shown_on DATE,
          interest VARCHAR(8),
          feedback TEXT NOT NULL,
          created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_seller_feedback_plan ON seller_showing_feedback(tenant_id, plan_id);
        CREATE TABLE IF NOT EXISTS seller_offers (
          id SERIAL PRIMARY KEY,
          tenant_id INTEGER NOT NULL DEFAULT 1 REFERENCES tenants(id),
          plan_id INTEGER NOT NULL REFERENCES seller_plans(id) ON DELETE CASCADE,
          label VARCHAR(80),
          price INTEGER NOT NULL,
          financing VARCHAR(40),
          down_payment_pct NUMERIC(5,2),
          earnest_money INTEGER,
          seller_credit INTEGER,
          close_date DATE,
          contingencies TEXT,
          note TEXT,
          expires_at TIMESTAMPTZ,
          status VARCHAR(12) NOT NULL DEFAULT 'active',
          created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_seller_offers_plan ON seller_offers(tenant_id, plan_id);
        ALTER TABLE tour_requests ADD COLUMN IF NOT EXISTS co_buyer JSONB;
      `);
      // Rows hang off a person or a seller plan: they take that tenant.
      for (const table of ['client_closings', 'stay_touch_prefs', 'stay_touch_sends', 'seller_intent', 'seller_plans']) {
        await client.query(`
          DROP TRIGGER IF EXISTS ${table}_tenant ON ${table};
          CREATE TRIGGER ${table}_tenant BEFORE INSERT ON ${table}
            FOR EACH ROW EXECUTE FUNCTION tenant_from_parent('users', 'user_id');
        `);
      }
      await client.query(`
        DROP TRIGGER IF EXISTS stay_touch_templates_tenant ON stay_touch_templates;
        CREATE TRIGGER stay_touch_templates_tenant BEFORE INSERT ON stay_touch_templates
          FOR EACH ROW EXECUTE FUNCTION tenant_from_parent('users', 'agent_id');
      `);
      for (const table of ['seller_showing_feedback', 'seller_offers']) {
        await client.query(`
          DROP TRIGGER IF EXISTS ${table}_tenant ON ${table};
          CREATE TRIGGER ${table}_tenant BEFORE INSERT ON ${table}
            FOR EACH ROW EXECUTE FUNCTION tenant_from_parent('seller_plans', 'plan_id');
        `);
      }
      await client.query('RELEASE SAVEPOINT p5_client_life');
    } catch (lifeErr) {
      await client.query('ROLLBACK TO SAVEPOINT p5_client_life');
      console.error('client life migration skipped:', lifeErr.message);
    }

    // The MLS's office and agent roster, so "Listing courtesy of …" can name
    // the office when the listing feed only gives its MLS id.
    await client.query('SAVEPOINT mls_roster');
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS mls_offices (
          feed VARCHAR(16) NOT NULL,
          office_mls_id VARCHAR(40) NOT NULL,
          name VARCHAR(255),
          modified_at TIMESTAMPTZ,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          PRIMARY KEY (feed, office_mls_id)
        )
      `);
      await client.query(`
        CREATE TABLE IF NOT EXISTS mls_members (
          feed VARCHAR(16) NOT NULL,
          member_mls_id VARCHAR(40) NOT NULL,
          full_name VARCHAR(255),
          modified_at TIMESTAMPTZ,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          PRIMARY KEY (feed, member_mls_id)
        )
      `);
      // A roster is only refreshed incrementally once one full pull finished.
      await client.query(`
        CREATE TABLE IF NOT EXISTS mls_roster_fills (
          feed VARCHAR(16) NOT NULL,
          kind VARCHAR(16) NOT NULL,
          completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          PRIMARY KEY (feed, kind)
        )
      `);
      await client.query('RELEASE SAVEPOINT mls_roster');
    } catch (rosterErr) {
      await client.query('ROLLBACK TO SAVEPOINT mls_roster');
      console.error('mls roster migration skipped:', rosterErr.message);
    }

    // Running without Follow Up Boss (phase 6): tags on leads, action plans
    // (drip sequences) and where each lead is in them, the shared team inbox,
    // and a log of leads that came in from outside lead sources.
    await client.query('SAVEPOINT p6_own_crm');
    try {
      await client.query(`
        ALTER TABLE users ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';
        CREATE INDEX IF NOT EXISTS idx_users_tags ON users USING GIN (tags);

        CREATE TABLE IF NOT EXISTS action_plans (
          id SERIAL PRIMARY KEY,
          tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
          owner_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
          name VARCHAR(120) NOT NULL,
          description TEXT,
          shared BOOLEAN NOT NULL DEFAULT TRUE,
          trigger JSONB NOT NULL DEFAULT '{"type":"manual"}'::jsonb,
          auto_start BOOLEAN NOT NULL DEFAULT FALSE,
          pause_on_reply BOOLEAN NOT NULL DEFAULT TRUE,
          steps JSONB NOT NULL DEFAULT '[]'::jsonb,
          starter_key VARCHAR(40),
          archived_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_action_plans_tenant ON action_plans(tenant_id);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_action_plans_starter ON action_plans(tenant_id, starter_key) WHERE starter_key IS NOT NULL;

        CREATE TABLE IF NOT EXISTS action_plan_runs (
          id SERIAL PRIMARY KEY,
          tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
          plan_id INTEGER NOT NULL REFERENCES action_plans(id) ON DELETE CASCADE,
          lead_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          status VARCHAR(12) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'done', 'stopped')),
          step_index INTEGER NOT NULL DEFAULT 0,
          next_at TIMESTAMPTZ,
          locked_until TIMESTAMPTZ,
          started_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
          start_reason VARCHAR(40),
          started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          paused_at TIMESTAMPTZ,
          pause_reason VARCHAR(40),
          ended_at TIMESTAMPTZ,
          end_reason VARCHAR(40)
        );
        CREATE INDEX IF NOT EXISTS idx_action_plan_runs_tenant ON action_plan_runs(tenant_id);
        CREATE INDEX IF NOT EXISTS idx_action_plan_runs_due ON action_plan_runs(next_at) WHERE status = 'active';
        CREATE INDEX IF NOT EXISTS idx_action_plan_runs_lead ON action_plan_runs(lead_id, started_at DESC);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_action_plan_runs_live ON action_plan_runs(plan_id, lead_id) WHERE status IN ('active', 'paused');

        CREATE TABLE IF NOT EXISTS action_plan_log (
          id BIGSERIAL PRIMARY KEY,
          tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
          run_id INTEGER NOT NULL REFERENCES action_plan_runs(id) ON DELETE CASCADE,
          lead_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          step_index INTEGER,
          step_type VARCHAR(12),
          outcome VARCHAR(16) NOT NULL,
          detail TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_action_plan_log_tenant ON action_plan_log(tenant_id);
        CREATE INDEX IF NOT EXISTS idx_action_plan_log_run ON action_plan_log(run_id, created_at);

        CREATE TABLE IF NOT EXISTS inbox_threads (
          id SERIAL PRIMARY KEY,
          tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
          lead_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
          contact_key VARCHAR(255),
          contact_name VARCHAR(255),
          status VARCHAR(8) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done')),
          assignee_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
          claimed_at TIMESTAMPTZ,
          done_at TIMESTAMPTZ,
          done_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
          last_kind VARCHAR(12),
          last_preview TEXT,
          last_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          last_inbound_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_inbox_threads_tenant ON inbox_threads(tenant_id, status, last_at DESC);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_inbox_threads_lead ON inbox_threads(tenant_id, lead_id) WHERE lead_id IS NOT NULL;
        CREATE UNIQUE INDEX IF NOT EXISTS idx_inbox_threads_contact ON inbox_threads(tenant_id, contact_key) WHERE lead_id IS NULL;

        CREATE TABLE IF NOT EXISTS inbox_items (
          id BIGSERIAL PRIMARY KEY,
          tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
          thread_id INTEGER NOT NULL REFERENCES inbox_threads(id) ON DELETE CASCADE,
          kind VARCHAR(12) NOT NULL,
          direction VARCHAR(4) NOT NULL DEFAULT 'in' CHECK (direction IN ('in', 'out')),
          subject TEXT,
          body TEXT NOT NULL DEFAULT '',
          lead_message_id BIGINT,
          agent_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
          meta JSONB NOT NULL DEFAULT '{}'::jsonb,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_inbox_items_tenant ON inbox_items(tenant_id);
        CREATE INDEX IF NOT EXISTS idx_inbox_items_thread ON inbox_items(thread_id, created_at);

        CREATE TABLE IF NOT EXISTS inbox_reads (
          tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
          thread_id INTEGER NOT NULL REFERENCES inbox_threads(id) ON DELETE CASCADE,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          PRIMARY KEY (thread_id, user_id)
        );
        CREATE INDEX IF NOT EXISTS idx_inbox_reads_tenant ON inbox_reads(tenant_id, user_id);

        CREATE TABLE IF NOT EXISTS lead_intake_log (
          id BIGSERIAL PRIMARY KEY,
          tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
          source VARCHAR(24) NOT NULL,
          lead_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
          outcome VARCHAR(16) NOT NULL,
          assigned_agent_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
          assigned_by VARCHAR(16),
          summary TEXT,
          error TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_lead_intake_log_tenant ON lead_intake_log(tenant_id, created_at DESC);
      `);
      await client.query('RELEASE SAVEPOINT p6_own_crm');
    } catch (ownCrmErr) {
      await client.query('ROLLBACK TO SAVEPOINT p6_own_crm');
      console.error('own crm migration skipped:', ownCrmErr.message);
    }

    // Connecting any MLS: one connection per MLS feed (platform, encrypted
    // credentials, sync health), and each brokerage's progress through
    // "Connect your MLS" (applied → approved → connected → live).
    await client.query('SAVEPOINT mls_connections');
    try {
      await client.query(`
        ALTER TABLE mls_feeds ADD COLUMN IF NOT EXISTS catalog_id VARCHAR(40);
        ALTER TABLE mls_feeds ADD COLUMN IF NOT EXISTS logo_required BOOLEAN NOT NULL DEFAULT FALSE;
        ALTER TABLE mls_feeds ADD COLUMN IF NOT EXISTS states TEXT[] NOT NULL DEFAULT '{}';
        ALTER TABLE mls_feeds ADD COLUMN IF NOT EXISTS display_verified_at TIMESTAMPTZ;
        UPDATE mls_feeds SET catalog_id = 'ires', states = '{CO}' WHERE key = 'ires' AND catalog_id IS NULL;

        CREATE TABLE IF NOT EXISTS mls_connections (
          feed_key VARCHAR(16) PRIMARY KEY REFERENCES mls_feeds(key) ON DELETE CASCADE,
          platform VARCHAR(16) NOT NULL,
          config JSONB NOT NULL DEFAULT '{}'::jsonb,
          credentials_enc TEXT,
          credentials_hint JSONB NOT NULL DEFAULT '{}'::jsonb,
          credentials_tenant_id INTEGER REFERENCES tenants(id) ON DELETE SET NULL,
          credentials_updated_at TIMESTAMPTZ,
          state VARCHAR(16) NOT NULL DEFAULT 'setup' CHECK (state IN ('setup', 'connected', 'live', 'paused')),
          dropped_fields TEXT[] NOT NULL DEFAULT '{}',
          cadence_minutes INTEGER NOT NULL DEFAULT 30,
          watermark TEXT,
          full_import_at TIMESTAMPTZ,
          sold_backfill_at TIMESTAMPTZ,
          reconciled_at TIMESTAMPTZ,
          roster_at TIMESTAMPTZ,
          last_test_at TIMESTAMPTZ,
          last_test_ok BOOLEAN,
          last_test_error TEXT,
          last_run_at TIMESTAMPTZ,
          last_success_at TIMESTAMPTZ,
          last_error TEXT,
          last_error_at TIMESTAMPTZ,
          last_result JSONB,
          listing_count INTEGER NOT NULL DEFAULT 0,
          sold_count INTEGER NOT NULL DEFAULT 0,
          next_run_at TIMESTAMPTZ,
          running_since TIMESTAMPTZ,
          created_by_tenant_id INTEGER REFERENCES tenants(id) ON DELETE SET NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_mls_connections_due ON mls_connections(state, next_run_at);

        ALTER TABLE tenant_feeds ADD COLUMN IF NOT EXISTS stage VARCHAR(16);
        ALTER TABLE tenant_feeds ADD COLUMN IF NOT EXISTS stage_log JSONB NOT NULL DEFAULT '{}'::jsonb;
        ALTER TABLE tenant_feeds ADD COLUMN IF NOT EXISTS display_confirmed_at TIMESTAMPTZ;
        ALTER TABLE tenant_feeds ADD COLUMN IF NOT EXISTS go_live_requested_at TIMESTAMPTZ;
        ALTER TABLE tenant_feeds ADD COLUMN IF NOT EXISTS go_live_auto BOOLEAN NOT NULL DEFAULT FALSE;

        -- Listings from feeds other than IRES and the samples, by the MLS's
        -- own key: photo refreshes and the daily off-market check.
        CREATE INDEX IF NOT EXISTS idx_listings_feed_listing_key
          ON listings (feed, (raw->>'ListingKey')) WHERE feed NOT IN ('ires', 'demo');
      `);
      await client.query('RELEASE SAVEPOINT mls_connections');
    } catch (mlsConnErr) {
      await client.query('ROLLBACK TO SAVEPOINT mls_connections');
      console.error('mls connections migration skipped:', mlsConnErr.message);
    }

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
