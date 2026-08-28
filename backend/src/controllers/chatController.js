import logger from '../utils/logger.js';
import getPool from '../config/database.js';
import {
  extractSearchFromMessages,
  hasSearchIntent,
  nameFromFilters,
  summarizeFilters,
} from '../services/searchIntentParser.js';
import { createAlert } from './alertController.js';
import { rejectIfDisposableEmail } from '../utils/emailQuality.js';

const OPENCODE_API_URL = 'https://opencode.ai/zen/go/v1/chat/completions';
const OPENCODE_API_KEY = process.env.OPENCODE_GO_API_KEY;
const OPENCODE_MODEL = process.env.CHAT_MODEL || 'deepseek-v4-flash';

const NCOCITIES = ['Fort Collins', 'Loveland', 'Windsor', 'Greeley', 'Timnath', 'Wellington', 'Johnstown', 'Eaton', 'Milliken', 'La Salle', 'Mead', 'Longmont', 'Boulder', 'Berthoud', 'Firestone', 'Frederick', 'Evans', 'Severance', 'Niwot'];

/** Pull real listing details from our MLS database when the visitor is
 *  on a listing page or asks about a specific home. Returns a compact,
 *  factual context block (or null). */
async function resolveListingContext(page, messages) {
  try {
    const pool = getPool();
    const last = [...(messages || [])].reverse().find((m) => m?.role === 'user')?.content || '';

    // 1) Visitor is on a listing page → exact slug
    const slugMatch = String(page || '').match(/\/homes-for-sale\/([^\/?#]+)/);
    if (slugMatch) {
      const r = await pool.query(
        `SELECT street_number, street_name, unit, city, state, postal_code, list_price, original_list_price,
                beds, baths, living_area, lot_size_acres, home_type, property_subtype, year_built,
                garage_spaces, elementary_school, middle_school, high_school, school_district,
                subdivision, days_on_market, features, description, slug
         FROM listings WHERE slug = $1 AND is_active LIMIT 1`,
        [slugMatch[1]]
      );
      if (r.rows[0]) return formatListingContext(r.rows[0]);
    }

    // 2) Message mentions a street address + city
    const addrMatch = last.match(/(\d{1,6})\s+([A-Za-z0-9.\- ]{2,50}?)(?:,?\s+|\s+in\s+)(Fort Collins|Loveland|Windsor|Greeley|Timnath|Wellington|Johnstown|Eaton|Milliken|La Salle|Mead|Longmont|Boulder|Berthoud|Firestone|Frederick|Evans|Severance|Niwot)/i);
    if (addrMatch) {
      const r = await pool.query(
        `SELECT street_number, street_name, unit, city, state, postal_code, list_price, original_list_price,
                beds, baths, living_area, lot_size_acres, home_type, property_subtype, year_built,
                garage_spaces, elementary_school, middle_school, high_school, school_district,
                subdivision, days_on_market, features, description, slug
         FROM listings
         WHERE is_active AND LOWER(city) = LOWER($1)
           AND LOWER(street_name) LIKE LOWER($2)
         ORDER BY updated_at DESC LIMIT 1`,
        [addrMatch[3], `%${addrMatch[2].trim()}%`]
      );
      if (r.rows[0]) return formatListingContext(r.rows[0]);
    }

    // 3) Message just mentions a city → surface a couple of current homes
    const cityMention = NCOCITIES.find((c) => last.toLowerCase().includes(c.toLowerCase()));
    if (cityMention) {
      const r = await pool.query(
        `SELECT street_number, street_name, unit, city, state, postal_code, list_price, original_list_price,
                beds, baths, living_area, lot_size_acres, home_type, property_subtype, year_built,
                garage_spaces, elementary_school, middle_school, high_school, school_district,
                subdivision, days_on_market, features, description, slug
         FROM listings WHERE is_active AND LOWER(city) = LOWER($1)
         ORDER BY updated_at DESC LIMIT 2`,
        [cityMention]
      );
      if (r.rows.length) return r.rows.map(formatListingContext).join('\n\n');
    }
  } catch (error) {
    logger.warn('Listing context lookup failed', error);
  }
  return null;
}

function formatListingContext(l) {
  const f = l.features || {};
  const parts = [
    `Address: ${[l.street_number, l.street_name, l.unit && `#${l.unit}`, l.city, l.state].filter(Boolean).join(' ')}`,
    `Price: $${Number(l.list_price || 0).toLocaleString()}${l.original_list_price && Number(l.original_list_price) > Number(l.list_price) ? ` (reduced from $${Number(l.original_list_price).toLocaleString()})` : ''}`,
    `Type: ${l.home_type || 'property'}${l.property_subtype ? ` (${l.property_subtype})` : ''}`,
    l.beds != null ? `Beds: ${l.beds}` : null,
    l.baths != null ? `Baths: ${l.baths}` : null,
    l.living_area ? `SqFt: ${Number(l.living_area).toLocaleString()}` : null,
    l.lot_size_acres ? `Lot: ${l.lot_size_acres} acres` : null,
    l.year_built ? `Year built: ${l.year_built}` : null,
    l.garage_spaces != null ? `Garage: ${l.garage_spaces} spaces` : null,
    l.elementary_school ? `Elementary: ${l.elementary_school}` : null,
    l.middle_school ? `Middle: ${l.middle_school}` : null,
    l.high_school ? `High: ${l.high_school}` : null,
    l.school_district ? `District: ${l.school_district}` : null,
    l.subdivision ? `Subdivision: ${l.subdivision}` : null,
    l.days_on_market != null ? `Days on market: ${l.days_on_market}` : null,
    f.basement ? `Basement: ${f.basement}` : null,
    f.cooling ? `Cooling: ${f.cooling}` : null,
    f.heating ? `Heating: ${f.heating}` : null,
    f.fireplaces ? `Fireplace: ${f.fireplaces}` : null,
    f.pool ? 'Pool: yes' : null,
    f.view ? `View: ${f.view}` : null,
    l.description ? `Description: ${String(l.description).replace(/\s+/g, ' ').slice(0, 260)}` : null,
    `Link: https://saahomes.com/homes-for-sale/${l.slug}/`,
  ].filter(Boolean);
  return `LISTING DETAILS (real data from our MLS feed — use these exact facts, never invent others):\n${parts.join('\n')}`;
}

const SYSTEM_PROMPT = `You are Nadia, a friendly and helpful member of the SAA Homes (Schwartz and Associates) team in Northern Colorado. Your job is to help website visitors with their real estate questions and naturally connect them with Adam or Mandi Schwartz when they're ready.

## YOUR IDENTITY
- You are Nadia, a member of the SAA Homes team. You help visitors with their real estate questions and connect them with Adam or Mandi when they're ready.
- You are NOT a real estate agent. You're a team assistant. If someone asks, say "I'm part of the SAA Homes team — let me get Adam or Mandi to help with that!"
- Warm, helpful, genuine — like a concierge who knows everything about Northern Colorado real estate.
- Never pushy or salesy. You educate, guide, and hand off to the team.
- Keep responses concise (2-4 sentences). Use occasional emojis but don't overdo it.
- Use natural, conversational language. Act human — no need to mention you're AI or a bot.

## WHAT YOU KNOW ABOUT SAA HOMES
- Full name: Schwartz and Associates (SAA Homes)
- Agents: Adam Schwartz and Mandi Schwartz (husband-and-wife co-leads)
- Office: 3665 John F Kennedy Pkwy #210, Fort Collins, CO 80525
- Phone: (970) 999-1407
- Website: https://saahomes.com
- Email: info@saahomes.com
- Service area: All of Northern Colorado — 27 communities including Fort Collins, Loveland, Windsor, Greeley, Timnath, Wellington, Johnstown, Eaton, Milliken, La Salle, Mead, Longmont, Boulder, Berthoud, Firestone, Frederick, Evans, Severance, Niwot, Erie, Brighton, Estes Park, Red Feather Lakes, Fort Lupton, Lyons, Bellvue, and Carbon Valley
- Specialties: First-time homebuyers, CHFA programs, VA loans for veterans, luxury homes, seller representation

## WHAT YOU KNOW ABOUT VETERANS & VA LOANS
- Hub page: https://saahomes.com/veterans/
- Adam's real offer: Schwartz and Associates gives 0.5% of the purchase price back to veterans (also active-duty and Guard/Reserve) who buy with us. Applied as a home warranty, toward closing costs, or as a price reduction. Disclosed in writing at closing (Colorado commission-rebate rule). Not an "up to" offer.
- Example math only: 0.5% of $500,000 = $2,500. Do not invent other savings numbers.
- VA loan facts (from VA.gov — do not invent rates or funding-fee percentages): 0% down (VA does not require a down payment; a lender might), no monthly PMI, one-time funding fee unless exempt (receiving VA compensation for a service-connected disability, or other VA exemption rules), Certificate of Eligibility (COE) required, VA appraisal is not a home inspection, occupancy required (primary residence), VA loans are assumable.
- Colorado disabled-veteran property tax exemption: typically 50% of the first $200,000 of actual value for 100% permanent-and-total service-connected disability (Gold Star spouses may qualify). Confirm current rules with the county assessor / CO Dept. of Revenue / vets.colorado.gov.
- Local resources: Northern Colorado VA Clinic, 4575 Byrd Drive, Loveland, (970) 593-3300. Larimer County VSO, Fort Collins, (970) 498-7390. Weld County VSO, Greeley, (970) 400-3444.
- If they ask about VA loans or the 0.5% benefit, answer from this section and offer to connect them with Adam or Mandi. Point them to /veterans/.

## WHAT YOU KNOW ABOUT CHFA PROGRAMS
- CHFA Down Payment Assistance: Up to $25K in grants/deferred loans. Programs: SmartStep Plus (grant up to 25% of loan), Preferred Plus (deferred second mortgage), FirstStep, FirstGeneration.
- CHFA Schools To Home: For full-time Colorado public school employees — including teachers, **school nurses**, counselors, administrators, and support staff. Up to 25% DPA as second mortgage. Income limit $178,920. Min credit 620.
- **Nurses:** School nurses qualify for Schools To Home (see above). Hospital/clinical nurses (Banner, UCHealth, Poudre Valley, Medical Center of the Rockies, North Colorado Medical Center) qualify for standard CHFA DPA programs. There's no separate "nurse program" but nurses absolutely qualify.
- Colorado Champions Home Loan: First responders — **peace officers (police, corrections, 911 specialists, wildlife officers), firefighters, and EMTs/paramedics**. 110% income limits. Up to $25K DPA. Created by SB26-053.
- **Police & law enforcement:** Covered by Champions (above). Often ask about "police officer home loans" — it's the Champions program plus standard CHFA DPA.
- **Firefighters:** Same as police — Champions program covers them.
- G-HOPE Greeley: Up to $8,000 forgivable loan for Greeley-area employees.
- CHFA income limits vary by county (Weld > Larimer).

## WHAT YOU KNOW ABOUT NORTHERN COLORADO
- Fort Collins: Median ~$612K. 30+ neighborhoods
- Loveland: Median ~$507K. 30 neighborhoods
- Windsor: Median ~$550K. 17 neighborhoods including Water Valley, RainDance
- Greeley: Most affordable ~$429K median. 18 neighborhoods
- Timnath: Fast-growing luxury corridor. New construction.
- Berthoud, Firestone, Frederick: Carbon Valley — growing, affordable
- Longmont: ~$550K median. Boulder County without Boulder prices
- Boulder: Most expensive ~$950K+ median

## SAVED SEARCH ALERTS (your superpower)
When a visitor describes what homes they want — city, price, beds/baths, pool, condo, etc. — you can set up a REAL saved search that emails them when matching listings hit the market.

Rules:
1. NEVER create a search silently. Always ask first.
2. When PROPOSED SEARCH FILTERS are in your context (or the visitor clearly described criteria), offer alerts and start your reply with [[SAVE_SEARCH]] on its own line, then a short friendly message that restates the criteria and asks if they want alerts. Example:
   [[SAVE_SEARCH]]
   I can set up alerts for homes under $400,000 in Windsor with a pool. You'll get an email when new matches hit — want me to turn that on?
3. The website shows Yes / No buttons under your message — keep the ask short so those buttons make sense.
4. If they only asked a general question (CHFA, schools, process) with no home criteria, do NOT use [[SAVE_SEARCH]].
5. Do NOT invent criteria they didn't mention. Only reference filters from PROPOSED SEARCH FILTERS or their exact words.
6. After they confirm (the site handles creation), you may later point them to https://saahomes.com/my-saved-searches/ to manage alerts.

## CONVERSATION FLOW
1. Greet warmly and ask how you can help. **Tailor your greeting to the page they're on** — if they're on a CHFA/DPA page, lead with "Looking into down payment assistance?" or "I can help you figure out which CHFA program fits your situation." If they're on a city/area page, reference the city. If they're on a listing page, reference the home.
2. Answer questions based on what you know
3. If they describe a home search, offer saved-search alerts with [[SAVE_SEARCH]] (see above)
4. If you don't know something specific, be honest and offer to connect them with Adam or Mandi
5. After 2-3 exchanges (or when the visitor shows buying/selling intent), naturally suggest a consultation with Adam or Mandi
6. When they agree, use [[HANDOFF]] at the START of your reply to trigger the contact form
7. When they explicitly ask to speak to someone immediately, use [[TRANSFER]] at the START of your reply to give them the live transfer option
8. NEVER ask for personal info in the chat — the handoff / save-search forms collect it

## HANDOFF RULES
- When the visitor agrees to connect or wants to move forward, say something like: "I'd love to connect you with Adam or Mandi! They'll be able to walk you through everything in detail. Let me grab your info — how would you like them to reach out?"
- IMPORTANT: When the visitor agrees to be connected, start your reply with [[HANDOFF]] on its own line, then your message. This triggers the contact form on the website. Example:
  [[HANDOFF]]
  I'd love to connect you with Adam or Mandi! Let me grab a few details so they can reach out to you.

- When the visitor explicitly asks to talk to a real person right now, start your reply with [[TRANSFER]] on its own line. Example:
  [[TRANSFER]]
  Absolutely! I can have Adam or Mandi reach out to you directly. Would you like me to arrange that?

- When LISTING DETAILS are included in your context, use those exact verified facts (price, beds, baths, schools, features) to answer questions about the home. Never change or invent numbers. If the visitor asks something not covered by the details, say so and offer to have Adam or Mandi get the full picture.
- If no listing details are in your context, do NOT make up specific home listings, prices, or availability. Direct them to saahomes.com/properties/ or offer to connect them with Adam or Mandi.
- Do NOT give legal or tax advice. Recommend they speak with a lender or attorney.
- Be honest about what you know and humble about what you don't.`;

export const handleChatMessage = async (req, res) => {
  const { messages, page } = req.body;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'Messages array is required' });
  }

  if (!OPENCODE_API_KEY) {
    logger.warn('OpenCode API key not configured — chat AI unavailable');
    return res.status(503).json({ error: 'Chat AI not configured. Please call (970) 999-1407.' });
  }

  const listingContext = await resolveListingContext(page, messages);
  const searchParsed = extractSearchFromMessages(messages);
  const lastUser = [...messages].reverse().find((m) => m?.role === 'user')?.content || '';
  const wantSearchOffer = !!(searchParsed && (
    searchParsed.confidence === 'high'
    || searchParsed.confidence === 'medium'
    || hasSearchIntent(lastUser)
  ));

  const searchContext = wantSearchOffer && searchParsed
    ? `PROPOSED SEARCH FILTERS (extracted from the visitor's words — use ONLY these; never invent extra criteria):
${JSON.stringify(searchParsed.filters, null, 2)}
Summary: ${searchParsed.summary}
If this looks like a real home search, offer to set up email alerts and start your reply with [[SAVE_SEARCH]] on its own line. The website will show Yes/No buttons — do not ask them to type yes/no.`
    : null;

  const apiMessages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...(page ? [{ role: 'system', content: `The visitor is currently on this page: ${page}` }] : []),
    ...(listingContext ? [{ role: 'system', content: listingContext }] : []),
    ...(searchContext ? [{ role: 'system', content: searchContext }] : []),
    ...messages.slice(-10), // Keep last 10 messages for context window
  ];

  try {
    const response = await fetch(OPENCODE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENCODE_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENCODE_MODEL,
        messages: apiMessages,
        // Reasoning models (deepseek-v4-flash etc.) spend tokens on
        // internal reasoning_content BEFORE emitting the answer. A small
        // max_tokens makes them run out mid-thought and return empty
        // content → 502 "empty response" (hit in production Aug 2026).
        // 1500 leaves headroom for both thinking and the visible reply.
        max_tokens: 1500,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('OpenCode API error', { status: response.status, error: errorText });
      return res.status(502).json({ error: 'AI service temporarily unavailable. Please call (970) 999-1407.' });
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content;
    // Fallback: some reasoning models put the visible text in
    // reasoning_content when content comes back empty after truncation.
    const reasoning = data.choices?.[0]?.message?.reasoning_content;
    let finalReply = (reply && reply.trim()) ? reply : (reasoning ? reasoning.trim() : '');

    if (!finalReply) {
      logger.error('OpenCode API returned empty response', { data });
      return res.status(502).json({ error: 'AI service returned empty response.' });
    }

    // If we have solid search criteria but the model forgot the tag, attach it
    // so the frontend still shows confirmation buttons (never silent create).
    const modelTagged = finalReply.includes('[[SAVE_SEARCH]]');
    if (wantSearchOffer && searchParsed && searchParsed.confidence === 'high' && !modelTagged
      && !finalReply.includes('[[HANDOFF]]') && !finalReply.includes('[[TRANSFER]]')) {
      finalReply = `[[SAVE_SEARCH]]\n${finalReply}`;
    }

    const offerSaveSearch = finalReply.includes('[[SAVE_SEARCH]]') && searchParsed?.filters
      && Object.keys(searchParsed.filters).length > 0;

    const proposedSearch = offerSaveSearch
      ? {
          filters: searchParsed.filters,
          summary: searchParsed.summary || summarizeFilters(searchParsed.filters),
          name: nameFromFilters(searchParsed.filters),
        }
      : null;

    logger.info('Chat message processed', {
      model: OPENCODE_MODEL,
      hasHandoff: finalReply.includes('[[HANDOFF]]'),
      hasTransfer: finalReply.includes('[[TRANSFER]]'),
      hasSaveSearch: !!proposedSearch,
      searchSummary: proposedSearch?.summary,
      tokensIn: data.usage?.prompt_tokens,
      tokensOut: data.usage?.completion_tokens,
    });

    // Human-feeling reply cadence — brief natural delay so replies don't land
    // instantly like a machine (Adam, Aug 8). The frontend shows a typing
    // indicator during this window.
    await new Promise((r) => setTimeout(r, 1200 + Math.random() * 1600));

    res.json({
      reply: finalReply, // forward as-is — frontend strips control tags
      proposedSearch, // null | { filters, summary, name } — Yes/No UI, never auto-create
      usage: data.usage,
    });
  } catch (error) {
    logger.error('Chat service error', error);
    res.status(500).json({ error: 'Chat service error. Please call (970) 999-1407.' });
  }
};

/**
 * POST /api/chat/create-search
 * Explicit confirmation from chat UI → create a real saved search (same as
 * SaveSearchModal / POST /api/alerts). Never silent — frontend only calls after Yes.
 * Body: { filters, email, phone, name?, frequency? }
 * Cookie session can supply email/phone if the visitor is already signed in.
 */
export const createSearchFromChat = async (req, res) => {
  try {
    const body = req.body || {};
    const filters = (body.filters && typeof body.filters === 'object' && !Array.isArray(body.filters))
      ? body.filters
      : {};

    if (Object.keys(filters).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No search criteria to save. Describe a city, price, or beds first.',
      });
    }

    // Session may already have email + phone
    let sessionEmail = '';
    let sessionPhone = '';
    let sessionName = '';
    try {
      const token = req.cookies?.saa_user_token;
      if (token && token.length >= 16) {
        const pool = getPool();
        const r = await pool.query(
          `SELECT email, phone, name FROM users WHERE manage_token = $1 AND status = 'active' LIMIT 1`,
          [String(token)]
        );
        if (r.rows[0]) {
          sessionEmail = r.rows[0].email || '';
          sessionPhone = r.rows[0].phone || '';
          sessionName = r.rows[0].name || '';
        }
      }
    } catch {
      /* non-fatal */
    }

    const email = String(body.email || sessionEmail || '').trim();
    const phone = String(body.phone || sessionPhone || '').trim();
    const name = String(body.name || sessionName || nameFromFilters(filters)).trim().slice(0, 255);

    if (!email || !phone) {
      return res.status(400).json({
        success: false,
        error: 'Email and phone are required to set up alerts.',
        needsContact: true,
      });
    }
    if (rejectIfDisposableEmail(email, res, 'chat')) return;

    // Delegate to the existing alert pipeline (FUB Alert Signup, lead score, cookie).
    req.body = {
      email,
      phone,
      name,
      frequency: body.frequency || 'daily',
      send_time: body.send_time || '06:00',
      send_day: body.send_day || 'Monday',
      intent: body.intent || 'buying',
      ...filters,
    };

    // createAlert writes the response; enrich with chat-friendly fields via wrapper
    const originalJson = res.json.bind(res);
    res.json = (payload) => {
      if (payload && payload.success && payload.data) {
        payload.data.summary = summarizeFilters(filters);
        payload.data.manageUrl = '/my-saved-searches/';
        payload.data.source = 'nadia_chat';
      }
      return originalJson(payload);
    };

    return createAlert(req, res);
  } catch (error) {
    logger.error('createSearchFromChat error', error);
    return res.status(500).json({
      success: false,
      error: 'Could not save your search. Please try again.',
    });
  }
};
