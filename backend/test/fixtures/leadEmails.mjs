/**
 * Lead notification emails as they arrive at a brokerage's lead address,
 * modeled on the plain-text layout of each portal's notifications. Names,
 * emails and phone numbers are made up (555 numbers, example domains).
 */

export const ZILLOW = {
  from: 'Zillow <premieragent-noreply@zillow.com>',
  subject: 'New Contact: Jamie Rivera is interested in 1234 Maple Ave',
  text: `New Contact

Jamie Rivera is interested in 1234 Maple Ave, Fort Collins, CO 80525

Jamie Rivera
jamie.rivera@example.net
(970) 555-0142

"Hi, I'd like to schedule a tour of this home this weekend. Is it still available?"

1234 Maple Ave, Fort Collins, CO 80525
$549,000 | 3 bd | 2 ba | 1,850 sqft
https://www.zillow.com/homedetails/1234-Maple-Ave-Fort-Collins-CO-80525/12345678_zpid/

Reply to Jamie
Zillow Group, 1301 Second Avenue, Floor 31, Seattle, WA 98101
Unsubscribe | Privacy
`,
};

export const REALTOR = {
  from: 'realtor.com <leads@notifications.realtor.com>',
  subject: 'New realtor.com lead: Morgan Lee',
  text: `You have a new lead from realtor.com!

Lead Information
First Name: Morgan
Last Name: Lee
Email: morgan.lee@example.org
Phone: 720-555-0199
Comments: I'm interested in 88 Pine Ct. Please send me more information.

Property Information
Address: 88 Pine Ct, Loveland, CO 80538
List Price: $475,000
MLS ID: IR1012345
https://www.realtor.com/realestateandhomes-detail/88-Pine-Ct_Loveland_CO_80538_M12345-67890

Need help? Call customer support at 800-555-0100
`,
};

export const HOMES = {
  from: 'Homes.com <leads@homes.com>',
  subject: 'You have a new lead from Homes.com',
  text: `Homes.com Lead Notification

Name: Taylor Brooks
Email: taylor.brooks@example.com
Phone: (303) 555-0177
Message: Is the seller flexible on price? We'd love to see it Sunday.

Property: 455 Aspen Dr, Windsor, CO 80550
Price: $1,250,000
View listing: https://www.homes.com/property/455-aspen-dr-windsor-co/abc123/
`,
};

/** An agent forwarding a lead from some other website (no portal involved). */
export const FORWARDED = {
  from: 'Andy Agent <andy@peak.test>',
  subject: 'Fwd: New inquiry',
  text: `FYI, new one for us.

---------- Forwarded message ---------
From: Lakeside Builders <forms@lakeside-builders.example>
Date: Tue, Oct 13, 2026 at 4:12 PM
Subject: New inquiry
To: <andy@peak.test>

Name: Riley Chen
Email: riley.chen@example.com
Phone: 970.555.0123
Message: Looking for a lot near Horsetooth.
`,
};

/** An agent forwarding a Zillow lead from their own inbox. */
export const FORWARDED_ZILLOW = {
  from: 'Bea Broker <bea@peak.test>',
  subject: 'Fwd: New Contact: Sky Patel is interested in 9 Elm St',
  text: `---------- Forwarded message ---------
From: Zillow <premieragent-noreply@zillow.com>
Date: Mon, Oct 12, 2026
Subject: New Contact: Sky Patel is interested in 9 Elm St

Sky Patel is interested in 9 Elm St, Berthoud, CO 80513

Sky Patel
sky.patel@example.net
970-555-0166

"Does this one have a basement?"

https://www.zillow.com/homedetails/9-Elm-St-Berthoud-CO-80513/87654321_zpid/
`,
};
