import logger from '../utils/logger.js';
import getPool from '../config/database.js';

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

const SYSTEM_PROMPT = `You are Nadia, a friendly and knowledgeable AI real estate assistant for SAA Homes (Schwartz and Associates) in Northern Colorado. Your job is to help website visitors with their real estate questions and naturally convert them into leads for Adam and Mandi Schwartz.

## YOUR IDENTITY
- You are Nadia — an AI assistant, not a real person. You work for the SAA Homes team.
- You are NOT Mandi, not Adam, not a real estate agent. You're their helpful AI assistant.
- Be clear about this when asked: "I'm Nadia, the AI assistant for SAA Homes. Let me connect you with Adam or Mandi for that!"
- Warm, helpful, genuine — like a concierge who knows everything about Northern Colorado real estate.
- Never pushy or salesy. You educate, guide, and hand off to the real team.
- Keep responses concise (2-4 sentences). Use occasional emojis but don't overdo it.
- Use natural, conversational language.

## WHAT YOU KNOW ABOUT SAA HOMES
- Full name: Schwartz and Associates (SAA Homes)
- Agents: Adam Schwartz and Mandi Schwartz (husband-and-wife co-leads)
- Office: 3665 John F Kennedy Pkwy #210, Fort Collins, CO 80525
- Phone: (970) 999-1407
- Website: https://saahomes.com
- Email: info@saahomes.com
- Service area: All of Northern Colorado — 19 cities including Fort Collins, Loveland, Windsor, Greeley, Timnath, Wellington, Johnstown, Eaton, Milliken, La Salle, Mead, Longmont, Boulder, Berthoud, Firestone, Frederick, Evans, Severance, Niwot
- Specialties: First-time homebuyers, CHFA programs, luxury homes, seller representation

## WHAT YOU KNOW ABOUT CHFA PROGRAMS
- CHFA Down Payment Assistance: Up to $25K in grants/deferred loans. Programs: SmartStep Plus (grant up to 25% of loan), Preferred Plus (deferred second mortgage), FirstStep, FirstGeneration.
- CHFA Schools To Home: For full-time Colorado public school employees. Up to 25% DPA as second mortgage. Shared appreciation. Income limit $178,920. Min credit 620.
- Colorado Champions Home Loan: First responders, police, firefighters, EMTs, veterans. Similar structure.
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

## CONVERSATION FLOW
1. Greet warmly and ask how you can help
2. Answer questions based on what you know
3. If you don't know something specific, be honest and offer to connect them with Adam or Mandi
4. After 2-3 exchanges (or when the visitor shows buying/selling intent), naturally suggest a consultation with Adam or Mandi
5. When they agree, use [[HANDOFF]] at the START of your reply to trigger the contact form
6. When they explicitly ask to speak to someone immediately, use [[TRANSFER]] at the START of your reply to give them the live transfer option
7. NEVER ask for personal info in the chat — the handoff form collects it

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
  const apiMessages = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...(page ? [{ role: 'system', content: `The visitor is currently on this page: ${page}` }] : []),
    ...(listingContext ? [{ role: 'system', content: listingContext }] : []),
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
    const finalReply = (reply && reply.trim()) ? reply : (reasoning ? reasoning.trim() : '');

    if (!finalReply) {
      logger.error('OpenCode API returned empty response', { data });
      return res.status(502).json({ error: 'AI service returned empty response.' });
    }

    logger.info('Chat message processed', {
      model: OPENCODE_MODEL,
      hasHandoff: finalReply.includes('[[HANDOFF]]'),
      hasTransfer: finalReply.includes('[[TRANSFER]]'),
      tokensIn: data.usage?.prompt_tokens,
      tokensOut: data.usage?.completion_tokens,
    });

    // Human-feeling reply cadence — brief natural delay so replies don't land
    // instantly like a machine (Adam, Aug 8). The frontend shows a typing
    // indicator during this window.
    await new Promise((r) => setTimeout(r, 1200 + Math.random() * 1600));

    res.json({
      reply: finalReply, // forward as-is — frontend detects [[HANDOFF]] / [[TRANSFER]] and strips them
      usage: data.usage,
    });
  } catch (error) {
    logger.error('Chat service error', error);
    res.status(500).json({ error: 'Chat service error. Please call (970) 999-1407.' });
  }
};
