/**
 * One way to talk to every MLS data platform.
 *
 * createAdapter({ platform, config, credentials }) returns an object with the
 * same methods whichever platform is behind it:
 *
 *   propertyPages({ since, initial, sold, soldSince })   async iterator of record pages
 *   preview(n)            a handful of active listings, for "Test connection"
 *   activeKeys()          every active ListingKey (daily off-market check), or null
 *   rosterPages(kind, since)  Office ('office') or Member ('member') pages
 *   mediaFor(keys)        Media for listings when the platform can't $expand it
 *
 * Platform differences live in PROFILE below; what each one does was checked
 * against the platform's public docs (see platforms.js for the sources).
 * Requests are paced per platform and per credential, across every adapter in
 * this process, so two feeds on one MLS Grid token never add up past its
 * limit. 429 and 5xx back off (Retry-After when given); a 400 that names one
 * of the fields we asked for drops that field and tries again.
 */
import crypto from 'node:crypto';
import { PLATFORMS } from './platforms.js';

// The fields we map (mls/resoMapping.js), plus sold and replication fields.
export const PROPERTY_FIELDS = [
  'ListingKey', 'ListingId', 'StandardStatus', 'PropertyType', 'PropertySubType',
  'StreetNumber', 'StreetName', 'UnitNumber', 'City', 'StateOrProvince',
  'PostalCode', 'CountyOrParish', 'ListPrice', 'BedroomsTotal',
  'BathroomsTotalInteger', 'BathroomsFull', 'LivingArea', 'LotSizeArea',
  'YearBuilt', 'GarageSpaces', 'AssociationFee', 'PublicRemarks',
  'Latitude', 'Longitude',
  'ElementarySchool', 'MiddleOrJuniorSchool', 'HighSchool', 'HighSchoolDistrict',
  'DaysOnMarket', 'OriginalListPrice', 'PriceChangeTimestamp', 'MlsStatus',
  'OriginatingSystemName', 'PhotosCount',
  'PropertyAttachedYN', 'Levels', 'StructureType', 'BuildingAreaTotal',
  'AboveGradeFinishedArea', 'BathroomsHalf', 'BathroomsThreeQuarter',
  'NumberOfUnitsTotal', 'LotSizeAcres', 'ParcelNumber', 'TaxYear', 'TaxAnnualAmount',
  'ArchitecturalStyle', 'Basement', 'ConstructionMaterials', 'Roof',
  'InteriorFeatures', 'ExteriorFeatures', 'Appliances', 'Flooring',
  'Cooling', 'Heating', 'FireplaceFeatures', 'PoolFeatures', 'SpaFeatures',
  'ParkingFeatures', 'ParkingTotal', 'OtherParking', 'Fencing',
  'PatioAndPorchFeatures', 'WindowFeatures', 'SecurityFeatures',
  'DoorFeatures', 'Electric', 'LaundryFeatures', 'OtherEquipment',
  'OtherStructures', 'PetsAllowed', 'WaterBodyName', 'HorseAmenities',
  'IrrigationSource', 'IrrigationWaterRightsYN', 'View', 'WaterfrontYN',
  'Sewer', 'WaterSource', 'Utilities', 'Zoning', 'LotFeatures', 'SubdivisionName',
  'Directions', 'Disclosures', 'StreetDirPrefix', 'StreetDirSuffix',
  'StreetSuffix', 'UnparsedAddress', 'MLSAreaMajor', 'MLSAreaMinor',
  'ListingTerms', 'SpecialListingConditions', 'NewConstructionYN',
  'BuilderName', 'BuilderModel', 'AssociationYN', 'AssociationName',
  'AssociationFeeIncludes', 'AssociationPhone', 'AssociationFeeFrequency',
  'VirtualTourURLUnbranded', 'AvailabilityDate', 'ListingContractDate',
  'AccessibilityFeatures', 'CommunityFeatures', 'GreenEnergyEfficient',
  'GreenBuildingVerificationType',
  'ClosePrice', 'CloseDate',
  'ModificationTimestamp', 'PhotosChangeTimestamp',
  'ListOfficeName', 'ListOfficeMlsId', 'ListAgentFullName', 'ListAgentMlsId',
];

// Never dropped: without these a record can't be stored or replicated.
const REQUIRED_FIELDS = new Set(['ListingKey', 'StandardStatus', 'ModificationTimestamp']);

export const ACTIVE_STATUSES = ['Active', 'Active Under Contract', 'Pending'];

const ROSTER = {
  office: { path: 'Office', id: 'OfficeMlsId', name: 'OfficeName' },
  member: { path: 'Member', id: 'MemberMlsId', name: 'MemberFullName' },
};

/**
 * What differs per platform. pageSize: records per page; expandMedia: ask for
 * Media with $expand (Bridge returns it on the record by itself); orderBy:
 * add $orderby=ModificationTimestamp so replication pages come in order.
 */
const PROFILE = {
  // $top ≤ 1000 with $expand; ordered by ModificationTimestamp by default
  // ($orderby isn't needed); one OriginatingSystemName per request.
  mlsgrid: { pageSize: 500, keyPageSize: 5000, expandMedia: true, orderBy: false, systemFilter: true, canViewFilter: true, reconcile: false },
  // $top ≤ 200; Media comes on the Property record.
  bridge: { pageSize: 200, keyPageSize: 200, expandMedia: false, orderBy: true, systemFilter: false, canViewFilter: false, reconcile: true },
  // $top ≤ 1000; $expand=Media; $select=ListingKey to reconcile.
  trestle: { pageSize: 200, keyPageSize: 1000, expandMedia: true, orderBy: true, systemFilter: false, canViewFilter: false, reconcile: true },
  // $top ≤ 1000 on the replication host; the regular host's limit isn't
  // published, so we stay small there.
  spark: { pageSize: 25, keyPageSize: 25, expandMedia: true, orderBy: true, systemFilter: false, canViewFilter: false, reconcile: true },
  reso: { pageSize: 200, keyPageSize: 1000, expandMedia: true, orderBy: true, systemFilter: false, canViewFilter: false, reconcile: true },
};

const sleepReal = (ms) => new Promise((r) => setTimeout(r, ms));

// Pace per platform + credential, shared by every adapter in this process.
const lastCallAt = new Map();

export function resetPacing() {
  lastCallAt.clear();
}

export class MlsApiError extends Error {
  constructor(message, { status = null, body = '', url = null, kind = 'api' } = {}) {
    super(message);
    this.status = status;
    this.body = body;
    this.url = url;
    this.kind = kind;
  }
}

/** Plain-words reason for an MLS API error, for the owner and the console. */
export function explainError(err) {
  const s = err?.status;
  if (err?.kind === 'config') return err.message;
  if (s === 401) return 'The MLS didn’t accept these credentials. Check the token or client ID and secret.';
  if (s === 403) return 'The credentials work, but this feed isn’t approved for them yet. Check with your MLS that the license is approved.';
  if (s === 404) return 'Nothing was found at that API address. Check the address (and the dataset ID or MLS code).';
  if (s === 429) return 'The MLS asked us to slow down. We’ll try again shortly.';
  if (s && s >= 500) return 'The MLS’s server had a problem. We’ll try again shortly.';
  if (err?.name === 'TimeoutError' || err?.name === 'AbortError') return 'The MLS didn’t answer in time. We’ll try again shortly.';
  if (err?.kind === 'network') return 'We couldn’t reach that API address. Check it for typos.';
  return err?.message || 'Something went wrong talking to the MLS.';
}

function quote(v) {
  return `'${String(v).replace(/'/g, "''")}'`;
}

function statusFilter(statuses) {
  return `(${statuses.map((s) => `StandardStatus eq ${quote(s)}`).join(' or ')})`;
}

const trimSlash = (u) => String(u || '').trim().replace(/\/+$/, '');

/** Every field from `fields` that an error body names, matched as a whole word. */
export function fieldsNamedIn(body, fields) {
  const text = String(body || '');
  return fields.filter((f) => new RegExp(`(^|[^A-Za-z0-9_])${f}([^A-Za-z0-9_]|$)`).test(text));
}

/**
 * Build an adapter. config: base_url, dataset_id, originating_system,
 * token_url, scope, expand_media. credentials: access_token or
 * client_id + client_secret. opts: fetchImpl, sleep, minIntervalMs,
 * droppedFields (from an earlier run), retries.
 */
export function createAdapter({ platform, config = {}, credentials = {} } = {}, opts = {}) {
  const info = PLATFORMS[platform];
  if (!info) throw new MlsApiError(`Unknown platform “${platform}”`, { kind: 'config' });
  const profile = { ...PROFILE[platform] };
  const fetchImpl = opts.fetchImpl || fetch;
  const sleep = opts.sleep || sleepReal;
  // MLS_PACE_MS overrides the pause between calls (local tests against a fake
  // MLS); never set it lower than the platform's limit in production.
  const envPace = process.env.MLS_PACE_MS !== undefined && process.env.MLS_PACE_MS !== '' ? Number(process.env.MLS_PACE_MS) : null;
  const minInterval = opts.minIntervalMs ?? envPace ?? info.rate.min_interval_ms;
  const retries = opts.retries ?? 4;
  const dropped = new Set(opts.droppedFields || []);
  let expandMedia = config.expand_media === false ? false : profile.expandMedia;

  // Where the API lives.
  let base = trimSlash(config.base_url || info.defaults.base_url || '');
  if (platform === 'bridge') {
    const dataset = String(config.dataset_id || '').trim();
    if (!dataset) throw new MlsApiError('Enter the Bridge dataset ID.', { kind: 'config' });
    if (!/^[A-Za-z0-9_-]{1,64}$/.test(dataset)) throw new MlsApiError('The dataset ID should be letters, numbers, dashes or underscores.', { kind: 'config' });
    base = `${trimSlash(config.base_url || info.defaults.base_url)}/${dataset}`;
  }
  if (!base) throw new MlsApiError('Enter the API address.', { kind: 'config' });
  let parsedBase;
  try {
    parsedBase = new URL(base);
  } catch {
    throw new MlsApiError('The API address doesn’t look like a web address.', { kind: 'config' });
  }
  if (parsedBase.protocol !== 'https:' && !opts.allowHttp) {
    throw new MlsApiError('The API address must start with https://', { kind: 'config' });
  }
  if (platform === 'spark' && /replication\.sparkapi\.com/i.test(base)) {
    profile.pageSize = 1000;
    profile.keyPageSize = 1000;
  }
  const system = String(config.originating_system || '').trim();
  if (platform === 'mlsgrid' && !system) throw new MlsApiError('Enter the MLS code (OriginatingSystemName).', { kind: 'config' });

  // How we sign in.
  const staticToken = String(credentials.access_token || '').trim()
    || (platform === 'mlsgrid' ? String(process.env.MLSGRID_ACCESS_TOKEN || process.env.IRES_ACCESS_TOKEN || '').trim() : '');
  const clientId = String(credentials.client_id || '').trim();
  const clientSecret = String(credentials.client_secret || '').trim();
  const oauth = !staticToken && (platform === 'trestle' || (platform === 'reso' && clientId && clientSecret));
  if (!staticToken && !oauth) {
    throw new MlsApiError(platform === 'trestle' || platform === 'reso'
      ? 'Enter an access token, or a client ID and secret.'
      : 'Enter the access token.', { kind: 'config' });
  }
  if (oauth && (!clientId || !clientSecret)) throw new MlsApiError('Enter both the client ID and the client secret.', { kind: 'config' });
  const tokenUrl = oauth ? String(config.token_url || info.defaults.token_url || '').trim() : null;
  if (oauth && !tokenUrl) throw new MlsApiError('Enter the token address for the client ID and secret.', { kind: 'config' });

  const paceKey = `${platform}:${crypto.createHash('sha256').update(staticToken || clientId || base).digest('hex').slice(0, 16)}`;
  let bearer = staticToken || null;
  let bearerExpires = staticToken ? Infinity : 0;
  let calls = 0;

  async function pace() {
    if (!minInterval) return;
    const last = lastCallAt.get(paceKey) || 0;
    const wait = last + minInterval - Date.now();
    lastCallAt.set(paceKey, Math.max(Date.now(), last + minInterval));
    if (wait > 0) await sleep(wait);
  }

  async function token(force = false) {
    if (bearer && !force && Date.now() < bearerExpires) return bearer;
    if (!oauth) return bearer;
    // OAuth2 client credentials (Trestle: grant_type=client_credentials,
    // scope=api, credentials in the body).
    await pace();
    calls += 1;
    let res;
    try {
      res = await fetchImpl(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: clientId,
          client_secret: clientSecret,
          ...(config.scope || info.defaults.scope ? { scope: config.scope || info.defaults.scope } : {}),
        }).toString(),
        signal: AbortSignal.timeout(30000),
      });
    } catch (e) {
      throw new MlsApiError(`token request failed: ${e.message}`, { kind: 'network', url: tokenUrl });
    }
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new MlsApiError(`token request failed (${res.status})`, { status: res.status === 400 ? 401 : res.status, body: body.slice(0, 500), url: tokenUrl });
    }
    const data = await res.json();
    if (!data?.access_token) throw new MlsApiError('The token address answered without a token.', { status: 401, url: tokenUrl });
    bearer = data.access_token;
    const ttl = Number(data.expires_in) || 3600;
    bearerExpires = Date.now() + Math.max(60, ttl - 60) * 1000;
    return bearer;
  }

  /** GET a URL as JSON with pacing, backoff and one token refresh on 401. */
  async function getJson(url, { left = retries, refreshed = false } = {}) {
    const auth = await token();
    await pace();
    calls += 1;
    let res;
    try {
      res = await fetchImpl(url, {
        headers: {
          Authorization: `Bearer ${auth}`,
          Accept: 'application/json',
          'Accept-Encoding': 'gzip',
        },
        signal: AbortSignal.timeout(60000),
      });
    } catch (e) {
      if (left > 0 && (e.name === 'TimeoutError' || e.name === 'AbortError')) {
        await sleep(5000);
        return getJson(url, { left: left - 1, refreshed });
      }
      throw new MlsApiError(`request failed: ${e.message}`, { kind: e.name === 'TimeoutError' ? 'timeout' : 'network', url });
    }
    if (res.ok) return res.json();
    const body = await res.text().catch(() => '');
    if (res.status === 401 && oauth && !refreshed) {
      await token(true);
      return getJson(url, { left, refreshed: true });
    }
    if ((res.status === 429 || res.status >= 500) && left > 0) {
      const after = Number(res.headers?.get?.('retry-after'));
      const wait = Number.isFinite(after) && after > 0
        ? Math.min(after, 300) * 1000
        : [5000, 15000, 45000, 90000][retries - left] || 90000;
      await sleep(wait);
      return getJson(url, { left: left - 1, refreshed });
    }
    throw new MlsApiError(`MLS ${res.status}: ${body.slice(0, 300)}`, { status: res.status, body: body.slice(0, 2000), url });
  }

  function selectFields(extra = []) {
    const fields = [...PROPERTY_FIELDS, ...extra].filter((f) => !dropped.has(f));
    return [...new Set(fields)];
  }

  function baseFilter(parts) {
    const all = [];
    if (profile.systemFilter) all.push(`OriginatingSystemName eq ${quote(system)}`);
    else if (system) all.push(`OriginatingSystemName eq ${quote(system)}`);
    return [...all, ...parts.filter(Boolean)].join(' and ');
  }

  function url(resource, params) {
    const u = new URL(`${base}/${resource}`);
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') u.searchParams.set(k, String(v));
    }
    return u.toString();
  }

  /**
   * The first page of a Property query:
   *   initial: the active set (MLS Grid: MlgCanView eq true, first import only)
   *   since:   everything modified after the watermark, any status
   *   sold:    Closed records modified since soldSince
   */
  function propertyUrl({ since = null, initial = false, sold = false, soldSince = null, top = profile.pageSize, keysOnly = false } = {}) {
    const parts = [];
    if (sold) {
      parts.push("StandardStatus eq 'Closed'");
      if (soldSince) parts.push(`ModificationTimestamp gt ${soldSince}`);
    } else if (since) {
      parts.push(`ModificationTimestamp gt ${since}`);
    } else if (initial || keysOnly) {
      parts.push(statusFilter(ACTIVE_STATUSES));
    }
    if (profile.canViewFilter && (initial || keysOnly || sold) && !since) parts.push('MlgCanView eq true');
    const select = keysOnly
      ? ['ListingKey', 'ListingId'].filter((f) => !dropped.has(f) || REQUIRED_FIELDS.has(f))
      : selectFields(platform === 'mlsgrid' ? ['MlgCanView'] : []);
    return url('Property', {
      $filter: baseFilter(parts),
      $select: select.join(','),
      $top: top,
      ...(expandMedia && !keysOnly ? { $expand: 'Media' } : {}),
      ...(profile.orderBy && !keysOnly ? { $orderby: 'ModificationTimestamp asc' } : {}),
    });
  }

  /**
   * Work out what a 400 refused and stop asking for it. Returns true when
   * something was dropped (so the caller retries the first page).
   */
  function learnFrom400(err, asked) {
    if (err?.status !== 400) return false;
    if (expandMedia && /\bmedia\b|\$expand|expand/i.test(err.body) && !fieldsNamedIn(err.body, asked).length) {
      expandMedia = false;
      return true;
    }
    const named = fieldsNamedIn(err.body, asked).filter((f) => !REQUIRED_FIELDS.has(f) && !dropped.has(f));
    if (!named.length) {
      // $orderby refused: page without it (nextLink or $skip carries us).
      if (profile.orderBy && /orderby/i.test(err.body)) {
        profile.orderBy = false;
        return true;
      }
      return false;
    }
    for (const f of named) dropped.add(f);
    return true;
  }

  /**
   * Walk pages from a first URL: @odata.nextLink when the server gives one,
   * else $skip by page size while pages come back full.
   */
  async function* walk(makeFirst, { maxPages = 100000 } = {}) {
    let first = makeFirst();
    let data;
    for (let attempt = 0; ; attempt += 1) {
      try {
        data = await getJson(first);
        break;
      } catch (e) {
        const asked = new URL(first).searchParams.get('$select')?.split(',') || [];
        if (attempt < 40 && learnFrom400(e, asked)) {
          first = makeFirst();
          continue;
        }
        throw e;
      }
    }
    let pages = 0;
    let skip = 0;
    let current = first;
    while (data) {
      const records = Array.isArray(data.value) ? data.value : [];
      pages += 1;
      yield { records, url: current };
      if (pages >= maxPages) return;
      let next = data['@odata.nextLink'] || null;
      if (!next) {
        const top = Number(new URL(current).searchParams.get('$top')) || 0;
        if (!records.length || !top || records.length < top) return;
        skip += records.length;
        const u = new URL(first);
        u.searchParams.set('$skip', String(skip));
        next = u.toString();
      } else if (!/^https?:/i.test(next)) {
        next = new URL(next, `${base}/`).toString();
      }
      current = next;
      data = await getJson(next);
    }
  }

  return {
    platform,
    get calls() { return calls; },
    get droppedFields() { return [...dropped]; },
    get expandsMedia() { return expandMedia; },
    reconciles: profile.reconcile,
    propertyUrl,

    /** Pages of Property records (see propertyUrl for the modes). */
    propertyPages(opts2 = {}) {
      return walk(() => propertyUrl(opts2), { maxPages: opts2.maxPages });
    },

    /** Up to n active listings, for "Test connection". */
    async preview(n = 5) {
      for await (const page of walk(() => propertyUrl({ initial: true, top: n }), { maxPages: 1 })) {
        return page.records.slice(0, n);
      }
      return [];
    },

    /**
     * Every active ListingKey, for removing homes that left the market
     * without a status change reaching us. Null where the platform tells us
     * itself (MLS Grid's MlgCanView) or when the pass doesn't finish.
     */
    async activeKeys({ maxPages = 2000 } = {}) {
      if (!profile.reconcile) return null;
      const keys = new Set();
      let pages = 0;
      for await (const page of walk(() => propertyUrl({ keysOnly: true, top: profile.keyPageSize }), { maxPages })) {
        pages += 1;
        for (const r of page.records) if (r.ListingKey) keys.add(String(r.ListingKey));
      }
      return pages >= maxPages ? null : keys;
    },

    /** Office or Member roster pages, optionally only what changed since. */
    rosterPages(kind, { since = null, maxPages = 500 } = {}) {
      const r = ROSTER[kind];
      const make = () => url(r.path, {
        $filter: baseFilter([since ? `ModificationTimestamp gt ${since}` : null]) || undefined,
        $select: [r.id, r.name, 'ModificationTimestamp', ...(platform === 'mlsgrid' ? ['MlgCanView'] : [])].join(','),
        $top: 1000,
      });
      return walk(make, { maxPages });
    },

    /** One Property record by ListingKey, with its Media (photo refreshes). */
    async byKey(listingKey) {
      const make = () => url('Property', {
        $filter: baseFilter([`ListingKey eq ${quote(listingKey)}`]),
        $select: platform === 'bridge' ? 'ListingKey,Media' : 'ListingKey',
        $top: 1,
        ...(expandMedia ? { $expand: 'Media' } : {}),
      });
      for await (const page of walk(make, { maxPages: 1 })) return page.records[0] || null;
      return null;
    },

    /** Media rows for listings whose Media didn't come with the record. */
    async mediaFor(keys) {
      const out = new Map();
      const list = [...new Set(keys.map(String))];
      for (let i = 0; i < list.length; i += 20) {
        const chunk = list.slice(i, i + 20);
        const filter = chunk.map((k) => `ResourceRecordKey eq ${quote(k)}`).join(' or ');
        for await (const page of walk(() => url('Media', { $filter: filter, $top: 1000 }), { maxPages: 20 })) {
          for (const m of page.records) {
            const k = String(m.ResourceRecordKey || '');
            if (!out.has(k)) out.set(k, []);
            out.get(k).push(m);
          }
        }
      }
      return out;
    },
  };
}
