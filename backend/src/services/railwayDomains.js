/**
 * Connect a brokerage's own domain to this service on Railway, which issues
 * the HTTPS certificate automatically once DNS points here.
 *
 * Needs RAILWAY_API_TOKEN (an account or team token). Railway injects
 * RAILWAY_PROJECT_ID, RAILWAY_ENVIRONMENT_ID and RAILWAY_SERVICE_ID into the
 * running service itself. Without a token, settings show the DNS record to
 * add and the platform owner connects the domain by hand.
 */
import logger from '../utils/logger.js';
import { platformIdentity } from './platform.js';

const API = 'https://backboard.railway.com/graphql/v2';

export function railwayDomainsAvailable() {
  return !!(process.env.RAILWAY_API_TOKEN && process.env.RAILWAY_PROJECT_ID
    && process.env.RAILWAY_ENVIRONMENT_ID && process.env.RAILWAY_SERVICE_ID);
}

/**
 * Where a brokerage's DNS should point when we can't ask Railway: the
 * platform's own target (PLATFORM_CNAME_TARGET or the console), else
 * cname.<app domain>, else null (settings then say to ask support). Never the
 * Railway service's own hostname, which is named after the home brokerage.
 */
export function cnameTarget() {
  return platformIdentity().cname_target;
}

async function gql(query, variables) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);
  try {
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.RAILWAY_API_TOKEN}` },
      body: JSON.stringify({ query, variables }),
      signal: ctrl.signal,
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok || body.errors?.length) {
      throw new Error(body.errors?.[0]?.message || `Railway API ${res.status}`);
    }
    return body.data;
  } finally {
    clearTimeout(timer);
  }
}

const STATUS_FIELDS = `id domain status { verificationToken certificateStatus dnsRecords { hostlabel requiredValue currentValue status } }`;

/**
 * Railway's answer, as the records a brokerage adds at its DNS provider.
 * When the platform owner set a CNAME target of their own (which points at
 * this service), brokerages are shown that instead of Railway's hostname.
 */
export function recordsFor(domain, status) {
  const out = [];
  const own = platformIdentity();
  const issued = /ISSUED|VALID/i.test(String(status?.certificateStatus || ''));
  for (const r of status?.dnsRecords || []) {
    const masked = own.cname_target_set && /\.railway\.app\.?$/i.test(String(r.requiredValue || ''));
    const value = masked ? own.cname_target : r.requiredValue;
    const current = String(r.currentValue || '').toLowerCase().replace(/\.$/, '');
    out.push({
      type: 'CNAME',
      name: r.hostlabel && r.hostlabel !== '@' ? r.hostlabel : '@',
      value,
      status: masked
        ? (issued || current === value ? 'valid' : 'pending')
        : String(r.status || 'PENDING').toLowerCase(),
    });
  }
  if (status?.verificationToken) {
    const label = (status.dnsRecords || [])[0]?.hostlabel;
    out.push({
      type: 'TXT',
      name: label && label !== '@' ? `_railway-verify.${label}` : '_railway-verify',
      value: `railway-verify=${status.verificationToken}`,
      status: out.every((r) => r.status === 'valid') ? 'valid' : 'pending',
    });
  }
  return out;
}

export async function addCustomDomain(domain) {
  const data = await gql(
    `mutation($input: CustomDomainCreateInput!) { customDomainCreate(input: $input) { ${STATUS_FIELDS} } }`,
    {
      input: {
        projectId: process.env.RAILWAY_PROJECT_ID,
        environmentId: process.env.RAILWAY_ENVIRONMENT_ID,
        serviceId: process.env.RAILWAY_SERVICE_ID,
        domain,
      },
    }
  );
  const d = data.customDomainCreate;
  logger.info('custom domain added on Railway', { domain });
  return { id: d.id, domain: d.domain, certificate: d.status?.certificateStatus || 'PENDING', records: recordsFor(d.domain, d.status) };
}

export async function getCustomDomain(id) {
  const data = await gql(
    `query($id: String!, $projectId: String!) { customDomain(id: $id, projectId: $projectId) { ${STATUS_FIELDS} } }`,
    { id, projectId: process.env.RAILWAY_PROJECT_ID }
  );
  const d = data.customDomain;
  return { id: d.id, domain: d.domain, certificate: d.status?.certificateStatus || 'PENDING', records: recordsFor(d.domain, d.status) };
}

/**
 * The records a brokerage's settings show for its site domain. Our own
 * guidance (no Railway domain id) always shows today's target, so a record
 * saved before the platform had one of its own updates itself. A record with
 * no target yet is left out (settings then say to ask support).
 */
export function displayDnsRecords(site = {}, { fallbackName = '@ or www' } = {}) {
  const own = platformIdentity();
  const issued = /ISSUED|VALID/i.test(String(site.certificate || ''));
  const records = site.records || [{ type: 'CNAME', name: fallbackName, value: null, status: 'unknown' }];
  return records
    .map((r) => {
      if (r.type !== 'CNAME') return r;
      if (!site.railway_id) return { ...r, value: own.cname_target };
      if (own.cname_target_set && /\.railway\.app\.?$/i.test(String(r.value || ''))) {
        return { ...r, value: own.cname_target, status: issued ? 'valid' : r.status };
      }
      return r;
    })
    .filter((r) => r.value);
}
