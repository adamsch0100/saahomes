/**
 * Tour planner: put a handful of homes in a sensible driving order, estimate
 * how long the tour takes, and describe it for the agent and a calendar.
 *
 * Distances are straight-line miles stretched by a road factor, at an average
 * suburban speed; every number shown to a buyer is labelled an estimate.
 */
export const MAX_TOUR_HOMES = 8;
export const MINUTES_PER_SHOWING = 25;
const ROAD_FACTOR = 1.3;
const AVG_MPH = 32;
export const DAY_PARTS = {
  morning: { label: 'Morning (9am–12pm)', start: '09:00', end: '12:00' },
  afternoon: { label: 'Afternoon (12–4pm)', start: '12:00', end: '16:00' },
  evening: { label: 'Evening (4–7pm)', start: '16:00', end: '19:00' },
};

const toRad = (d) => (d * Math.PI) / 180;

export function milesBetween(a, b) {
  const R = 3958.8;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export const driveMinutes = (miles) => Math.max(3, Math.round(((miles * ROAD_FACTOR) / AVG_MPH) * 60));

function* permutations(items) {
  if (items.length <= 1) {
    yield items;
    return;
  }
  for (let i = 0; i < items.length; i += 1) {
    const rest = [...items.slice(0, i), ...items.slice(i + 1)];
    for (const p of permutations(rest)) yield [items[i], ...p];
  }
}

/**
 * Shortest open path through the stops (exact for ≤ 8 homes). Stops without
 * coordinates keep their order at the end. Returns stops with the leg into
 * each one, plus totals.
 */
export function planRoute(stops) {
  const located = stops.filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng));
  const unlocated = stops.filter((s) => !(Number.isFinite(s.lat) && Number.isFinite(s.lng)));
  let best = located;
  let bestMiles = Infinity;
  if (located.length > 1) {
    for (const order of permutations(located)) {
      let miles = 0;
      for (let i = 1; i < order.length && miles < bestMiles; i += 1) miles += milesBetween(order[i - 1], order[i]);
      if (miles < bestMiles) {
        bestMiles = miles;
        best = order;
      }
    }
  } else {
    bestMiles = 0;
  }
  const ordered = [...best, ...unlocated];
  let driving = 0;
  const out = ordered.map((s, i) => {
    const prev = ordered[i - 1];
    let leg = null;
    if (prev && Number.isFinite(prev.lat) && Number.isFinite(s.lat)) {
      const miles = milesBetween(prev, s);
      leg = { miles: Math.round(miles * ROAD_FACTOR * 10) / 10, minutes: driveMinutes(miles) };
      driving += leg.minutes;
    }
    return { ...s, stop: i + 1, leg };
  });
  return {
    stops: out,
    drive_minutes: driving,
    total_minutes: driving + out.length * MINUTES_PER_SHOWING,
  };
}

/** One line per stop, for the agent's Follow Up Boss note and the calendar. */
export function describeRoute(plan) {
  return plan.stops.map((s) => {
    const leg = s.leg ? ` (about ${s.leg.minutes} min drive)` : '';
    const price = s.list_price ? ` · $${Number(s.list_price).toLocaleString('en-US')}` : '';
    return `${s.stop}. ${s.address}${price}${leg}`;
  }).join('\n');
}

const icsEscape = (s) => String(s ?? '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/**
 * A tentative calendar hold for the first requested window, in Mountain time.
 * The tour is a request until the agent confirms, and the event says so.
 */
export function tourCalendar({ id, plan, window, site = 'https://saahomes.com', brandName = 'SAA Homes', uidHost = 'saahomes.com', now = new Date() }) {
  const part = DAY_PARTS[window.part];
  const day = window.date.replace(/-/g, '');
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:-//${brandName}//Tour Planner//EN`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:tour-${id}@${uidHost}`,
    `DTSTAMP:${stamp}`,
    `DTSTART;TZID=America/Denver:${day}T${part.start.replace(':', '')}00`,
    `DTEND;TZID=America/Denver:${day}T${part.end.replace(':', '')}00`,
    'STATUS:TENTATIVE',
    `SUMMARY:${icsEscape(`Home tour, ${plan.stops.length} homes (requested)`)}`,
    `DESCRIPTION:${icsEscape(`Requested, not confirmed yet. Your agent will confirm the exact time.\n\n${describeRoute(plan)}\n\nEstimated ${plan.total_minutes} minutes including driving.\n${site}/board/`)}`,
    plan.stops[0]?.address ? `LOCATION:${icsEscape(plan.stops[0].address)}` : null,
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean);
  return `${lines.join('\r\n')}\r\n`;
}
