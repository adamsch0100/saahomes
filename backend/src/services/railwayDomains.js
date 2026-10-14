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

const API = 'https://backboard.railway.com/graphql/v2';

export function railwayDomainsAvailable() {
  return !!(process.env.RAILWAY_API_TOKEN && process.env.RAILWAY_PROJECT_ID
    && process.env.RAILWAY_ENVIRONMENT_ID && process.env.RAILWAY_SERVICE_ID);
}

/** Where a brokerage's DNS should point when we can't ask Railway. */
export function cnameTarget() {
  return process.env.PLATFORM_CNAME_TARGET || process.env.RAILWAY_PUBLIC_DOMAIN || 'saahomes-production.up.railway.app';
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

/** Railway's answer, as the records a brokerage adds at its DNS provider. */
export function recordsFor(domain, status) {
  const out = [];
  for (const r of status?.dnsRecords || []) {
    out.push({
      type: 'CNAME',
      name: r.hostlabel && r.hostlabel !== '@' ? r.hostlabel : '@',
      value: r.requiredValue,
      status: String(r.status || 'PENDING').toLowerCase(),
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
