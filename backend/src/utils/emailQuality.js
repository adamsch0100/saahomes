/**
 * Email quality / enrich layer (RealScout parity G4).
 *
 * Static disposable-domain gate + prior-submission backfill for FUB payloads.
 * No network calls, no MX lookups, no external packages.
 */
import getPool from '../config/database.js';
import logger from './logger.js';

/**
 * ~130 well-known disposable / throwaway email domains (static heuristic).
 * Match is exact domain OR registrable-domain suffix (foo.mailinator.com blocked).
 * Role accounts (info@, admin@, test@) are NOT blocked — only domains.
 */
export const DISPOSABLE_DOMAINS = [
  // Mailinator family + aliases
  'mailinator.com',
  'mailinator2.com',
  'mailinator.net',
  'mailinator.org',
  'mailinator.us',
  'mailinator.cl',
  'mailinator.co',
  'mailinater.com',
  'mailin8r.com',
  'mailtothis.com',
  'reallymymail.com',
  'safetymail.info',
  'sogetthis.com',
  'spamhereplease.com',
  'thisisnotmyrealemail.com',
  'tradermail.info',
  'veryrealemail.com',
  'zippymail.info',
  'binkmail.com',
  'bobmail.info',
  'chammy.info',
  'devnullmail.com',
  'letthemeatspam.com',
  'mailinater.com',
  'mailinator2.com',
  'notmailinator.com',
  'reconmail.com',
  'spamherelots.com',
  'suremail.info',
  'mailnator.com',
  // Guerrilla / sharklasers
  'guerrillamail.com',
  'guerrillamail.org',
  'guerrillamail.net',
  'guerrillamail.biz',
  'guerrillamail.de',
  'guerrillamail.info',
  'guerrillamailblock.com',
  'sharklasers.com',
  'grr.la',
  'spam4.me',
  'pokemail.net',
  'spam.la',
  // 10-minute / tempmail family
  '10minutemail.com',
  '10minutemail.net',
  '10minutemail.org',
  '10minmail.com',
  '10minutemail.co.uk',
  '10minutemail.de',
  '10minutemail.us',
  '20minutemail.com',
  '20minutemail.it',
  'minutemail.com',
  'tempmail.com',
  'temp-mail.org',
  'temp-mail.io',
  'temp-mail.ru',
  'tempmailo.com',
  'tempmailaddress.com',
  'tempail.com',
  'tempmailer.com',
  'tempmailer.de',
  'tempinbox.com',
  'tempmail.net',
  'tempmail.eu',
  'tempmail.it',
  'tempemail.com',
  'tempemail.net',
  'tempemail.biz',
  'temporaryemail.net',
  'temporaryemail.us',
  'temporaryinbox.com',
  'throwawaymail.com',
  'throwaway.email',
  'throwawayemailaddress.com',
  'throwam.com',
  'trashmail.com',
  'trashmail.net',
  'trashmail.org',
  'trashmail.me',
  'trashmail.io',
  'trash-mail.com',
  'trashmail.de',
  'trashymail.com',
  'trashymail.net',
  'trashemail.de',
  'discard.email',
  'discardmail.com',
  'discardmail.de',
  'mailnull.com',
  'spamspot.com',
  'spamfree24.org',
  'spamfree24.de',
  'spamfree24.eu',
  'spamfree24.info',
  'spamfree24.net',
  'spamfree24.com',
  // Yopmail family
  'yopmail.com',
  'yopmail.fr',
  'yopmail.net',
  'cool.fr.nf',
  'jetable.fr.nf',
  'nospam.ze.tc',
  'nomail.xl.cx',
  'mega.zik.dj',
  'speed.1s.fr',
  'courriel.fr.nf',
  'moncourrier.fr.nf',
  'monemail.fr.nf',
  'monmail.fr.nf',
  // Getnada / modern temp
  'getnada.com',
  'nada.email',
  'nada.ltd',
  'abyssmail.com',
  'boximail.com',
  'dropjar.com',
  'getairmail.com',
  'givmail.com',
  'inboxbear.com',
  'robot-mail.com',
  'tafmail.com',
  'vomoto.com',
  // Popular modern throwaways
  'maildrop.cc',
  'mailnesia.com',
  'mytemp.email',
  'fakeinbox.com',
  'burnermail.io',
  'inboxkitten.com',
  '33mail.com',
  'spamgourmet.com',
  'spamgourmet.net',
  'spamgourmet.org',
  'dispostable.com',
  'mailcatch.com',
  'mail.tm',
  'emailondeck.com',
  'moakt.com',
  'moakt.ws',
  'tmpmail.org',
  'tmpmail.net',
  'tmpeml.com',
  '1secmail.com',
  '1secmail.org',
  '1secmail.net',
  'wwjmp.com',
  'esiix.com',
  'xojxe.com',
  'yoggm.com',
  'mohmal.com',
  'mintemail.com',
  'mailmetrash.com',
  'mailnesia.com',
  'mailexpire.com',
  'mailforspam.com',
  'mailinator.com',
  'mailscrap.com',
  'mailslite.com',
  'mailzilla.com',
  'meltmail.com',
  'mt2009.com',
  'mt2014.com',
  'mytempmail.com',
  'mytrashmail.com',
  'nospamfor.us',
  'nospammail.net',
  'objectmail.com',
  'one-time.email',
  'oneoffemail.com',
  'onewaymail.com',
  'otherinbox.com',
  'pookmail.com',
  'proxymail.eu',
  'putthisinyourspamdatabase.com',
  'quickinbox.com',
  'rcpt.at',
  'recode.me',
  'recyclemail.dk',
  'rejectmail.com',
  'rhyta.com',
  'rklips.com',
  'safe-mail.net',
  'selfdestructingmail.com',
  'sendspamhere.com',
  'sharklasers.com',
  'shiftmail.com',
  'shitmail.me',
  'shortmail.net',
  'sibmail.com',
  'sneakemail.com',
  'sofimail.com',
  'sogetthis.com',
  'soodonims.com',
  'spamail.de',
  'spambob.com',
  'spambob.net',
  'spambob.org',
  'spambog.com',
  'spambog.de',
  'spambox.us',
  'spamcannon.com',
  'spamcannon.net',
  'spamcon.org',
  'spamcorptastic.com',
  'spamcowboy.com',
  'spamcowboy.net',
  'spamcowboy.org',
  'spamday.com',
  'spamex.com',
  'spamfree.eu',
  'spamgoes.com',
  'spamherelots.com',
  'spamhole.com',
  'spamify.com',
  'spaminator.de',
  'spamkill.info',
  'spaml.com',
  'spaml.de',
  'spammotel.com',
  'spamobox.com',
  'spamslicer.com',
  'spamspot.com',
  'spamthis.co.uk',
  'spamthisplease.com',
  'spamtrail.com',
  'speed.1s.fr',
  'supergreatmail.com',
  'supermailer.jp',
  'superrito.com',
  'tempail.com',
  'tempalias.com',
  'tempe-mail.com',
  'tempinbox.co.uk',
  'tempinbox.com',
  'tempmail2.com',
  'tempomail.fr',
  'thankyou2010.com',
  'thisisnotmyrealemail.com',
  'thismail.net',
  'tmail.ws',
  'tmailinator.com',
  'tradermail.info',
  'trash2009.com',
  'trash2010.com',
  'trash2011.com',
  'trashdevil.com',
  'trashmailer.com',
  'trbvm.com',
  'trbvn.com',
  'trbvo.com',
  'twinmail.de',
  'uggsrock.com',
  'upliftnow.com',
  'venompen.com',
  'veryrealemail.com',
  'viditag.com',
  'webemail.me',
  'wh4f.org',
  'whyspam.me',
  'willselfdestruct.com',
  'wuzup.net',
  'wuzupmail.net',
  'xents.com',
  'xmaily.com',
  'xoxy.net',
  'yep.it',
  'yogamaven.com',
  'yopmail.com',
  'yuurok.com',
  'zehnminuten.de',
  'zehnminutenmail.de',
  'zippymail.info',
  'zoemail.com',
  'zoemail.net',
  'zoemail.org',
  'jetable.com',
  'jetable.net',
  'jetable.org',
  'mailblocks.com',
  'mailbidon.com',
  'maileater.com',
  'mailfreeonline.com',
  'mailguard.me',
  'mailimate.com',
  'mailincubator.com',
  'mailismagic.com',
  'mailme.lv',
  'mailme24.com',
  'mailmoat.com',
  'mailnull.com',
  'mailshell.com',
  'mailsiphon.com',
  'mailtemp.info',
  'mailtome.de',
  'e4ward.com',
  'emailias.com',
  'emailtemporanea.com',
  'emailtemporanea.net',
  'emailtemporario.com.br',
  'emailtmp.com',
  'ephemail.net',
  'explodemail.com',
  'fakemailgenerator.com',
  'filzmail.com',
  'get1mail.com',
  'get2mail.fr',
  'getonemail.com',
  'getonemail.net',
  'gishpuppy.com',
  'great-host.in',
  'haltospam.com',
  'hidemail.de',
  'incognitomail.com',
  'incognitomail.net',
  'incognitomail.org',
  'insorg-mail.info',
  'ipoo.org',
  'kasmail.com',
  'kaspop.com',
  'keepmymail.com',
  'killmail.com',
  'killmail.net',
  'klassmaster.com',
  'klzlk.com',
  'kulturbetrieb.info',
  'kurzepost.de',
  'lawlita.com',
  'lhsdv.com',
  'lifebyfood.com',
  'link2mail.net',
  'litedrop.com',
  'lol.ovpn.to',
  'lookugly.com',
  'lopl.co.cc',
  'lortemail.dk',
  'lr78.com',
  'm4ilweb.info',
  'maboard.com',
  'mail-temporaire.fr',
  'mail2rss.org',
  'mailbucket.org',
  'mailchop.com',
  'mailfa.tk',
  'mailms.com',
  'mailorg.org',
  'mailpick.biz',
  'mailrock.biz',
  'mailzi.ru',
  'mbx.cc',
  'meltmail.com',
  'messagebeamer.de',
  'mierdamail.com',
  'monumentmail.com',
  'mycleaninbox.net',
  'mymail-in.net',
  'myphantomemail.com',
  'neomailbox.com',
  'nervmich.net',
  'nervtmich.net',
  'netmails.com',
  'netmails.net',
  'netzidiot.de',
  'neverbox.com',
  'no-spam.ws',
  'nobulk.com',
  'noclickemail.com',
  'nogmailspam.info',
  'nomail2me.com',
  'nomorespamemails.com',
  'nospam4.us',
  'nospamthanks.info',
  'notsharingmy.info',
  'nowmymail.com',
  'nurfuerspam.de',
  'objectmail.com',
  'odnorazovoe.ru',
  'online.ms',
  'oopi.org',
  'ordinaryamerican.net',
  'ourklips.com',
  'outlawspam.com',
  'ovpn.to',
  'owlpic.com',
  'pancakemail.com',
  'pjjkp.com',
  'plexolan.de',
  'politikerclub.de',
  'poofy.org',
  'privacy.net',
  'privatdemail.net',
  'prtnx.com',
  'pwrby.com',
  'quickmail.nl',
  'recursor.net',
  'regbypass.com',
  'reliable-mail.com',
  'rmqkr.net',
  'royal.net',
  'rppkn.com',
  'rtrtr.com',
  's0ny.net',
  'safersignup.de',
  'safetypost.de',
  'sandelf.de',
  'saynotospams.com',
  'schafmail.de',
  'schrott-email.de',
  'secretemail.de',
  'secure-mail.biz',
  'sharedmailbox.org',
  'shieldedmail.com',
  'shitware.nl',
  'shmeriously.com',
  'sinnlos-mail.de',
  'slapsfromlastnight.com',
  'slaskpost.se',
  'smashmail.de',
  'smellfear.com',
  'snakemail.com',
  'snkmail.com',
  'sofort-mail.de',
  'soisz.com',
  'solvemail.info',
  'spam.su',
  'spamarrest.com',
  'spambog.ru',
  'spambox.info',
  'spamcero.com',
  'spamoff.de',
  'spamsalad.in',
  'spamstack.net',
  'spamtroll.net',
  'spoofmail.de',
  'stuffmail.de',
  'super-auswahl.de',
  'superstachel.de',
  'talkinator.com',
  'teewars.org',
  'teleworm.com',
  'teleworm.us',
  'temp.emeraldwebmail.com',
  'temp.headstrong.de',
  'tempemail.co.za',
  'tempmaildemo.com',
  'temporarily.de',
  'temporarioemail.com.br',
  'temporaryforwarding.com',
  'temporarymailaddress.com',
  'tempthe.net',
  'thanksnospam.info',
  'thelimestones.com',
  'tilien.com',
  'tittbit.in',
  'tizi.com',
  'toiea.com',
  'toomail.biz',
  'topranklist.de',
  'trash-amil.com',
  'trash-mail.at',
  'trash-mail.de',
  'trashdevil.de',
  'trashmail.at',
  'trashmail.ws',
  'trialmail.de',
  'trillianpro.com',
  'tryalert.com',
  'turual.com',
  'twoweirdtricks.com',
  'tyldd.com',
  'umail.net',
  'uplipht.com',
  'uroid.com',
  'us.af',
  'viewcastmedia.com',
  'viewcastmedia.net',
  'viewcastmedia.org',
  'viralplays.com',
  'vubby.com',
  'walala.org',
  'walkmail.net',
  'webm4il.info',
  'webuser.in',
  'whatiaas.com',
  'whatpaas.com',
  'wilemail.com',
  'willhackforfood.biz',
  'winemaven.info',
  'wronghead.com',
  'wwwnew.eu',
  'x.ip6.li',
  'xagloo.com',
  'xemaps.com',
  'yapped.net',
  'ypmail.webarnak.fr.eu.org',
  'z1p.biz',
  'zoaxe.com',
  'zomg.info',
  'dodgeit.com',
  'dodgit.com',
  'dodgit.org',
  'donemail.ru',
  'dontreg.com',
  'dontsendmespam.de',
  'dump-email.info',
  'dumpmail.de',
  'dumpyemail.com',
  'emailinfive.com',
  'emailsensei.com',
  'emailtemporar.ro',
  'emailthe.net',
  'emailwarden.com',
  'emailx.at.hm',
  'emailxfer.com',
  'emz.net',
  'enterto.com',
  'express.net.ua',
  'eyepaste.com',
  'fakeinformation.com',
  'fastacura.com',
  'fizmail.com',
  'fleckens.hu',
  'frapmail.com',
  'front14.org',
  'fux0ringduh.com',
  'garliclife.com',
  'ghosttexter.de',
  'giantmail.de',
  'gsrv.co.uk',
  'h.mintemail.com',
  'h8s.org',
  'hatespam.org',
  'hidzz.com',
  'hmamail.com',
  'hochsitze.com',
  'hotpop.com',
  'hulapla.de',
  'ieatspam.eu',
  'ieatspam.info',
  'ihateyoualot.info',
  'iheartspam.org',
  'imails.info',
  'imgof.com',
  'imgv.de',
  'imstations.com',
  'inbax.tk',
  'inbox.si',
  'inboxalias.com',
  'irish2me.com',
  'iwi.net',
  'jnxjn.com',
  'jourrapide.com',
  'jsrsolutions.com',
  'kir.ch.tc',
  'koszmail.pl',
  'lolfreak.net',
  'lovemeleaveme.com',
  'mail.by',
  'mail.mezimages.net',
  'mailed.ro',
  'mailme.ir',
  'mailzilla.org',
  'meinspamschutz.de',
  'mezimages.net',
  'mjukgarden.se',
  'mobi.web.id',
  'mobileninja.co.uk',
  'moburl.com',
  'mswork.ru',
  'mypartyclip.de',
  'mysamp.de',
  'nepwk.com',
  'nice-4u.com',
  'nincsmail.com',
  'nincsmail.hu',
  'nnh.com',
  'nonspam.eu',
  'nonspammer.de',
  'noref.in',
  'nowhere.org',
  'nwldx.com',
  'obobbo.com',
  'opayq.com',
  'spambox.irishspringrealty.com',
  'spamfighter.cf',
  'spamfighter.ga',
  'spamfighter.gq',
  'spamfighter.ml',
  'spamfighter.tk',
  'teleosaurs.xyz',
  'thc.st',
  'vkcode.ru',
  'clrmail.com',
  'purelymail.com',
  'tempmail.cn',
  'linshiyouxiang.net',
  '1secmail.xyz',
];

// Deduped lowercase set for O(1) exact + suffix checks
const DISPOSABLE_SET = new Set(
  DISPOSABLE_DOMAINS.map((d) => String(d).toLowerCase().trim()).filter(Boolean)
);

/**
 * Normalize an email: trim + lowercase. Returns null if empty/unusable.
 */
export function normalizeEmail(email) {
  if (email == null) return null;
  const clean = String(email).trim().toLowerCase();
  if (!clean || !clean.includes('@')) return null;
  return clean;
}

/**
 * Extract the domain part of an email (after last @).
 */
export function extractEmailDomain(email) {
  const clean = normalizeEmail(email);
  if (!clean) return null;
  const at = clean.lastIndexOf('@');
  if (at < 0 || at === clean.length - 1) return null;
  return clean.slice(at + 1);
}

/**
 * True if the email's domain (or any registrable-domain suffix) is disposable.
 * e.g. foo.mailinator.com → blocked via mailinator.com suffix.
 */
export function isDisposableEmail(email) {
  const domain = extractEmailDomain(email);
  if (!domain) return false;
  if (DISPOSABLE_SET.has(domain)) return true;
  // Suffix match: sub.mailinator.com matches mailinator.com
  for (const blocked of DISPOSABLE_SET) {
    if (domain.endsWith(`.${blocked}`)) return true;
  }
  return false;
}

/**
 * Basic lead-email shape check + not disposable.
 * Role accounts (info@, admin@, test@) are allowed.
 */
export function isValidLeadEmail(email) {
  const clean = normalizeEmail(email);
  if (!clean) return false;
  if (!clean.includes('@')) return false;
  const domain = extractEmailDomain(clean);
  if (!domain || !domain.includes('.')) return false;
  // Require a TLD of at least 2 chars after the last dot
  const tld = domain.slice(domain.lastIndexOf('.') + 1);
  if (!tld || tld.length < 2) return false;
  if (isDisposableEmail(clean)) return false;
  return true;
}

const isPresent = (v) => {
  if (v == null) return false;
  const s = String(v).trim();
  return s.length > 0;
};

/**
 * Fire-and-forget log of a blocked disposable email.
 * Never throws; never fails the request.
 */
export async function logBlockedEmail(email, path = 'unknown', pool = getPool()) {
  try {
    const clean = normalizeEmail(email) || String(email || '').trim().toLowerCase() || 'unknown';
    const domain = extractEmailDomain(clean) || clean.split('@')[1] || null;
    await pool.query(
      `INSERT INTO blocked_email_log (email, domain, path, created_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT DO NOTHING`,
      [clean.slice(0, 255), domain ? String(domain).slice(0, 255) : null, path ? String(path).slice(0, 255) : null]
    );
  } catch (err) {
    // Table may not exist mid-deploy — never block the 400 response
    logger.warn('logBlockedEmail failed (non-blocking)', { message: err.message });
  }
}

/**
 * Reject disposable emails with a consistent 400. Returns true if request
 * should abort (already sent response). Logs blocked attempts.
 */
export function rejectIfDisposableEmail(email, res, path = 'unknown') {
  const clean = normalizeEmail(email);
  if (clean && isDisposableEmail(clean)) {
    logBlockedEmail(clean, path).catch(() => {});
    res.status(400).json({ success: false, error: 'Please use a real email address' });
    return true;
  }
  return false;
}

/**
 * Backfill missing name/phone/interest/area from prior submissions by the same email.
 * Never overwrites fields the user just provided. Never fabricates.
 */
export async function enrichSubmissionFromHistory(pool, submission) {
  if (!submission || typeof submission !== 'object') return submission;
  const email = normalizeEmail(submission.email);
  if (!email) return submission;

  const out = { ...submission };
  try {
    const contact = await pool.query(
      `SELECT name, phone, interest, area
       FROM contact_submissions
       WHERE LOWER(email) = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [email]
    );
    const prior = contact.rows[0];

    if (prior) {
      if (!isPresent(out.phone) && isPresent(prior.phone)) out.phone = prior.phone;
      if (!isPresent(out.name) && isPresent(prior.name)) out.name = prior.name;
      if (!isPresent(out.interest) && isPresent(prior.interest)) out.interest = prior.interest;
      if (!isPresent(out.area) && isPresent(prior.area)) out.area = prior.area;
    }

    // Market report phone fill when contact has none
    if (!isPresent(out.phone)) {
      const market = await pool.query(
        `SELECT phone, first_name, last_name, area
         FROM market_report_submissions
         WHERE LOWER(email) = $1
           AND phone IS NOT NULL AND TRIM(phone) <> ''
         ORDER BY created_at DESC
         LIMIT 1`,
        [email]
      );
      const m = market.rows[0];
      if (m) {
        if (!isPresent(out.phone) && isPresent(m.phone)) out.phone = m.phone;
        if (!isPresent(out.area) && isPresent(m.area)) out.area = m.area;
        if (!isPresent(out.name) && (isPresent(m.first_name) || isPresent(m.last_name))) {
          out.name = [m.first_name, m.last_name].filter(isPresent).join(' ').trim();
        }
        if (!isPresent(out.first_name) && !isPresent(out.firstName) && isPresent(m.first_name)) {
          out.first_name = m.first_name;
          out.firstName = m.first_name;
        }
        if (!isPresent(out.last_name) && !isPresent(out.lastName) && isPresent(m.last_name)) {
          out.last_name = m.last_name;
          out.lastName = m.last_name;
        }
      }
    }

    return out;
  } catch (err) {
    logger.warn('enrichSubmissionFromHistory failed (non-blocking)', { message: err.message });
    return submission;
  }
}

/**
 * Observability only: if same email submitted any lead form within 5 minutes
 * (excluding the newest row), log a duplicate-submission note. Never blocks.
 */
export async function noteIfDuplicateSubmission(pool, email, path = 'unknown') {
  const clean = normalizeEmail(email);
  if (!clean) return;
  try {
    const r = await pool.query(
      `SELECT minutes_ago FROM (
         SELECT EXTRACT(EPOCH FROM (NOW() - created_at)) / 60.0 AS minutes_ago, created_at
         FROM (
           SELECT created_at FROM contact_submissions WHERE LOWER(email) = $1
           UNION ALL
           SELECT created_at FROM market_report_submissions WHERE LOWER(email) = $1
           UNION ALL
           SELECT created_at FROM chfa_lead_submissions WHERE LOWER(email) = $1
           UNION ALL
           SELECT created_at FROM champions_lead_submissions WHERE LOWER(email) = $1
           UNION ALL
           SELECT created_at FROM chfa_dpa_lead_submissions WHERE LOWER(email) = $1
           UNION ALL
           SELECT created_at FROM ghope_lead_submissions WHERE LOWER(email) = $1
           UNION ALL
           SELECT created_at FROM showing_requests WHERE LOWER(email) = $1
         ) all_subs
         WHERE created_at > NOW() - INTERVAL '5 minutes'
         ORDER BY created_at DESC
         OFFSET 1
         LIMIT 1
       ) prior`,
      [clean]
    );
    if (r.rows[0]) {
      const minutesAgo = Math.round(Number(r.rows[0].minutes_ago) * 10) / 10;
      logger.info('duplicate submission', { email: clean, path, minutesAgo });
    }
  } catch (err) {
    logger.warn('noteIfDuplicateSubmission failed (non-blocking)', { message: err.message });
  }
}
