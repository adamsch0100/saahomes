/**
 * The data platforms MLSs use to hand listings to websites, in plain words:
 * how a brokerage gets approved on each, what the platform issues, where the
 * API lives and how fast we may call it.
 *
 * Everything here was checked against the platform's public documentation
 * (October 2026). Sources are on each entry; what the docs don't say is
 * marked unverified and handled conservatively in code.
 */

export const PLATFORM_IDS = ['mlsgrid', 'bridge', 'trestle', 'spark', 'reso'];

export const PLATFORMS = {
  mlsgrid: {
    id: 'mlsgrid',
    name: 'MLS Grid',
    summary: 'A data hub many MLSs use. We hold one MLS Grid account for the platform; each brokerage approves a data license by email.',
    docs: [
      'https://docs.mlsgrid.com/api-documentation/api-version-2.0',
      'https://docs.mlsgrid.com/data-consumer-guides/how-to-add-broker-agent-data-license-requests',
    ],
    vendor_contact: { name: 'MLS Grid support', email: 'support@mlsgrid.com', url: 'https://app.mlsgrid.com/register' },
    // Verified: base https://api.mlsgrid.com/v2/, "Authorization: Bearer
    // <token>", one OriginatingSystemName per request, ordered by
    // ModificationTimestamp, @odata.nextLink paging, $top ≤ 5000 (≤ 1000 with
    // $expand), MlgCanView eq true on the first import only, Media only via
    // $expand. Rate limits (docs.mlsgrid.com master page): 2 requests/second,
    // 7,200/hour, 4 GB/hour, 40,000 per 24 hours; over that the token is
    // suspended (HTTP 429).
    defaults: { base_url: 'https://api.mlsgrid.com/v2' },
    rate: { min_interval_ms: 700, per_hour: 7200, note: '2 requests a second, 7,200 an hour, 40,000 a day' },
    min_cadence_minutes: 60,
    credential_fields: [
      { key: 'access_token', label: 'MLS Grid access token', secret: true, optional: true, help: 'Leave empty to use the platform’s MLS Grid account (MLSGRID_ACCESS_TOKEN).' },
    ],
    config_fields: [
      { key: 'originating_system', label: 'MLS code (OriginatingSystemName)', required: true, help: 'The MLS’s code in MLS Grid, like “actris” or “mred”. Filled in for MLSs we know.' },
    ],
    who_holds_credentials: 'platform',
    apply_steps: [
      { title: 'Tell us you want {mls}', body: 'Press “I’ve applied” below once you’ve read these steps. We send MLS Grid a data license request for {brokerage}, naming {product} as your website provider.' },
      { title: 'Approve the license email', body: 'MLS Grid emails {owner_email} a link to review and approve the MLS Grid Data License Agreement. Your managing broker approves it. That lets MLS Grid ask {mls} for access on your behalf.' },
      { title: '{mls} reviews it', body: 'The MLS checks that you’re a member in good standing. This usually takes a few days to two weeks. Mark “The MLS approved us” when you hear back.' },
      { title: 'Go live', body: 'We check the license shows as approved in MLS Grid, then your site switches from sample homes to live listings.' },
    ],
  },
  bridge: {
    id: 'bridge',
    name: 'Bridge Interactive',
    summary: 'Zillow Group’s MLS data platform. The MLS approves a data access request in Bridge and Bridge issues an API token.',
    docs: [
      'https://bridgedataoutput.com/docs/platform/API/bridge',
      'https://www.bridgeinteractive.com/updated-bridge-reso-web-api-changes-coming/',
      'https://recolorado.com/data/',
    ],
    vendor_contact: { name: 'Bridge Interactive', url: 'https://bridgedataoutput.com/register' },
    // Verified: RESO Web API at https://api.bridgedataoutput.com/api/v2/OData/
    // {dataset}/{resource}, "Authorization: Bearer {token}" (or
    // access_token=), $top up to 200, Media returned on the Property record,
    // default 5,000 requests an hour with a per-minute burst of 1/15 of that,
    // v3 coming with @odata.nextLink-style paging. The live docs site is a
    // script-rendered app; the rate limits come from a published copy of it.
    defaults: { base_url: 'https://api.bridgedataoutput.com/api/v2/OData' },
    rate: { min_interval_ms: 800, per_hour: 5000, note: '5,000 requests an hour (default), bursts of 1/15 of that a minute' },
    min_cadence_minutes: 15,
    credential_fields: [
      { key: 'access_token', label: 'Server token', secret: true, help: 'In Bridge: your application → API access → server token. Not the browser token.' },
    ],
    config_fields: [
      { key: 'dataset_id', label: 'Dataset ID', required: true, help: 'The MLS’s dataset in Bridge, shown next to the feed in your Bridge dashboard (for example “test”).' },
    ],
    who_holds_credentials: 'either',
    apply_steps: [
      { title: 'Create a Bridge account', body: 'Sign up at bridgedataoutput.com/register (or sign in). Use your brokerage’s name and your managing broker’s email.' },
      { title: 'Request {mls} data', body: 'In Bridge, find {mls} and request IDX data access. Name {product} as your technology provider and use the vendor sheet below for the questions.' },
      { title: 'Sign the license', body: 'Your managing broker signs the {mls} data license in Bridge. {mls} reviews and approves it, usually within a few days to two weeks.' },
      { title: 'Copy the server token', body: 'Once approved, Bridge shows a dataset ID and a server token for your application. Paste both in step 3 below.' },
    ],
  },
  trestle: {
    id: 'trestle',
    name: 'Trestle (Cotality, formerly CoreLogic)',
    summary: 'Cotality’s MLS data platform. The technology provider subscribes, your broker approves by email, then the MLS approves.',
    docs: [
      'https://trestle-documentation.corelogic.com/webapi.html',
      'https://trestle-documentation.corelogic.com/webapi-at-scale.html',
      'https://support.mlsnow.com/hc/en-us/articles/6974297500699-IDX-Setup-How-to-Display-MLS-Listings-on-Your-Website-Matrix-IDX-or-WebAPI-Trestle',
    ],
    vendor_contact: { name: 'Trestle', url: 'https://trestle.corelogic.com/SubscriptionWizard' },
    // Verified: OAuth2 client credentials at
    // https://api.cotality.com/trestle/oidc/connect/token, scope "api",
    // OData at https://api.cotality.com/trestle/odata (the docs warn the host
    // will change, so both are editable), $top ≤ 1000, @odata.nextLink
    // paging, $expand=Media, ModificationTimestamp replication, reconcile
    // deletes with $select=ListingKey. Quotas are per minute and per hour via
    // Minute-Quota-Limit / Hour-Quota-Limit headers; the numbers depend on the
    // feed and aren't published, so we pace at one request a second.
    defaults: {
      base_url: 'https://api.cotality.com/trestle/odata',
      token_url: 'https://api.cotality.com/trestle/oidc/connect/token',
      scope: 'api',
    },
    rate: { min_interval_ms: 1000, per_hour: null, note: 'Quota set per feed (Minute-Quota-Limit / Hour-Quota-Limit headers); we stay at one request a second' },
    min_cadence_minutes: 15,
    credential_fields: [
      { key: 'client_id', label: 'Client ID (username)', secret: false },
      { key: 'client_secret', label: 'Client secret (password)', secret: true },
    ],
    config_fields: [
      { key: 'base_url', label: 'API address', required: false, help: 'Leave as is unless Trestle tells you its address changed.' },
      { key: 'token_url', label: 'Token address', required: false },
    ],
    who_holds_credentials: 'either',
    apply_steps: [
      { title: 'We subscribe for you', body: 'Press “I’ve applied” below. We open a Trestle subscription for {mls} IDX data for {brokerage}, naming {product} as the technology provider. (MLSs say this step is started by the provider, not the broker.)' },
      { title: 'Approve the Authentisign email', body: 'Trestle emails your managing broker an approval request through Authentisign (secure@authentisign.com). Approve it.' },
      { title: '{mls} gives final approval', body: 'The MLS reviews the request, usually within a few days to two weeks. Mark “The MLS approved us” when you hear back.' },
      { title: 'Credentials', body: 'Trestle issues a client ID and secret for the feed. If they were sent to you, paste them in step 3; if they came to us, we connect it for you.' },
    ],
  },
  spark: {
    id: 'spark',
    name: 'Spark Platform (FBS / Flexmls)',
    summary: 'FBS’s API for Flexmls MLSs. You request a data plan in the Spark Datamart and Spark emails an access token once approved.',
    docs: [
      'https://www.sparkplatform.com/docs/reso/overview',
      'https://www.sparkplatform.com/docs/reso/replication',
      'https://sparkplatform.com/docs/api_services/read_first',
      'http://alpha.sparkplatform.com/docs/authentication/access_token',
      'https://berkshirerealtors.net/mls-technology/rets-data-use-website-options/',
    ],
    vendor_contact: { name: 'Spark API support', email: 'api-support@fbsdata.com', url: 'https://sparkplatform.com/appstore/datamart' },
    // Verified: RESO Web API at https://sparkapi.com/Reso/OData (replication
    // keys must use https://replication.sparkapi.com/Reso/OData, $top ≤ 1000),
    // "Authorization: Bearer <token>" with a non-expiring access token,
    // @odata.nextLink paging, $expand=Media, poll no more than every 10
    // minutes and at least hourly, purge with a daily $select=ListingKey
    // pass. Rate limit: 1,500 requests per 5 minutes for an IDX key (HTTP 429
    // beyond that).
    defaults: { base_url: 'https://sparkapi.com/Reso/OData' },
    rate: { min_interval_ms: 500, per_hour: 18000, note: '1,500 requests per 5 minutes for an IDX key' },
    min_cadence_minutes: 10,
    credential_fields: [
      { key: 'access_token', label: 'Access token', secret: true, help: 'The token Spark emails once the data plan is approved.' },
    ],
    config_fields: [
      { key: 'base_url', label: 'API address', required: false, help: 'Use https://replication.sparkapi.com/Reso/OData if Spark gave you a replication key.' },
    ],
    who_holds_credentials: 'either',
    apply_steps: [
      { title: 'Register with Spark', body: 'Create a developer account at sparkplatform.com/register/developers, or let us use the platform’s account.' },
      { title: 'Pick the {mls} data plan', body: 'In the Spark Datamart, choose {mls}’s IDX data plan and “Purchase With Approval”. Some MLSs also ask for your Flexmls login name or Tech ID.' },
      { title: 'Sign the MLS license', body: 'Some MLSs ask the broker to sign their own data license too. The agent, office or MLS approves the request in Spark.' },
      { title: 'Copy the access token', body: 'Spark emails access instructions once approved. Paste the access token in step 3.' },
    ],
  },
  reso: {
    id: 'reso',
    name: 'Another RESO Web API',
    summary: 'Any MLS that offers the standard RESO Web API (OData), with a token or a client ID and secret.',
    docs: [],
    vendor_contact: null,
    // Generic RESO Web API: Property / Member / Office / Media over OData with
    // $filter, $select, $top, $expand and @odata.nextLink. No published rate
    // limit, so we pace at one request a second and back off on 429.
    defaults: {},
    rate: { min_interval_ms: 1000, per_hour: null, note: 'One request a second; slows down when the server says so' },
    min_cadence_minutes: 15,
    credential_fields: [
      { key: 'access_token', label: 'Access token', secret: true, optional: true, help: 'If the MLS gave you a token, paste it here and leave the client fields empty.' },
      { key: 'client_id', label: 'Client ID', secret: false, optional: true },
      { key: 'client_secret', label: 'Client secret', secret: true, optional: true },
    ],
    config_fields: [
      { key: 'base_url', label: 'API address', required: true, help: 'The address that ends just before /Property, like https://api.example.com/odata.' },
      { key: 'token_url', label: 'Token address', required: false, help: 'Only when you have a client ID and secret.' },
      { key: 'scope', label: 'Scope', required: false },
      { key: 'originating_system', label: 'OriginatingSystemName filter', required: false, help: 'Only if one account carries several MLSs.' },
    ],
    who_holds_credentials: 'either',
    apply_steps: [
      { title: 'Ask {mls} for an IDX data feed', body: 'Ask the MLS how to get a RESO Web API feed for IDX display on your website. Name {product} as your technology provider and use the vendor sheet below.' },
      { title: 'Sign the license', body: 'Your managing broker signs the MLS’s IDX or data license agreement.' },
      { title: 'Get the connection details', body: 'The MLS or its vendor sends an API address and either an access token or a client ID and secret. Paste them in step 3.' },
    ],
  },
};

/** A platform's public description (no secrets ever live here). */
export function platformInfo(id) {
  return PLATFORMS[id] || null;
}

/** All platforms for the "My MLS isn't listed" picker. */
export function platformList() {
  return PLATFORM_IDS.map((id) => {
    const p = PLATFORMS[id];
    return {
      id, name: p.name, summary: p.summary, docs: p.docs, vendor_contact: p.vendor_contact,
      credential_fields: p.credential_fields, config_fields: p.config_fields, rate_note: p.rate.note,
      min_cadence_minutes: p.min_cadence_minutes,
    };
  });
}
