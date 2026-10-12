/** Listing rows shaped like the IRES sync writes them, for search and alert tests. */
let seq = 0;
export async function insertListing(pool, overrides = {}) {
  seq += 1;
  const l = {
    listing_id: `IRT${String(seq).padStart(5, '0')}`,
    status: 'Active',
    is_active: true,
    city: 'Fort Collins',
    state: 'CO',
    postal_code: '80521',
    street_number: String(100 + seq),
    street_name: 'Test St',
    list_price: 500000,
    original_list_price: null,
    beds: 3,
    baths: 2,
    living_area: 1800,
    home_type: 'detached',
    property_type: 'Residential',
    latitude: 40.585,
    longitude: -105.084,
    days_on_market: 3,
    ...overrides,
  };
  l.slug = l.slug || `${l.street_number}-test-st-${l.listing_id.toLowerCase()}`;
  const cols = Object.keys(l);
  const { rows } = await pool.query(
    `INSERT INTO listings (${cols.join(', ')}, updated_at)
     VALUES (${cols.map((_, i) => `$${i + 1}`).join(', ')}, NOW()) RETURNING *`,
    cols.map((c) => l[c])
  );
  return rows[0];
}
