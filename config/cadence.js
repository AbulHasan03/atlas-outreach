// ─────────────────────────────────────────────────────────────────────────────
// ATLAS OUTREACH — CADENCE CONFIG
// Defines the timing and strategic purpose of each message in the sequence.
// ─────────────────────────────────────────────────────────────────────────────

const cadence = [
  {
    message_number: 1,
    send_on_day: 0,
    subject_tone: "conversational, problem-aware",
    purpose: "Introduce one core pain point they likely deal with — credential sharing or staffing costs. Briefly introduce the Armatura Omni as the fix. Keep it simple and relatable. End with an easy ask: a free 20-minute call to see if it makes sense for their gym.",
    length: "short — 2 tight paragraphs, get to the point fast",
    cta_type: "free 20-minute call",
    personalization_level: "high — mention their gym by name, make it feel personal",
  },
  {
    message_number: 2,
    send_on_day: 3,
    subject_tone: "friendly follow-up, one new angle",
    purpose: "Casually reference the first email. Bring in one new angle that wasn't in message 1 — either the 24/7 access revenue opportunity or the labor savings angle, whichever wasn't the focus of message 1. Keep the tone warm and direct. CTA: offer a free consultation, no obligation.",
    length: "medium — 3 paragraphs, slightly more detail and warmth than message 1",
    cta_type: "free consultation",
    personalization_level: "medium — reference their gym's situation naturally",
  },
  {
    message_number: 3,
    send_on_day: 7,
    subject_tone: "educational, builds trust",
    purpose: "Share something genuinely useful — a real example of how a gym like theirs benefited, or a stat about what credential sharing actually costs over a year. Don't just pitch. Reference the ZKBioSecurity demo video (youtube.com/watch?v=oCSdoKdaDKo) so they can see it with their own eyes. Invite them to a live demo at their convenience.",
    length: "medium-long — 3-4 paragraphs with fuller sentences, builds on the relationship established in messages 1 and 2",
    cta_type: "live demo — see it in action",
    personalization_level: "medium — reference their specific gym type or location where relevant",
  },
  {
    message_number: 4,
    send_on_day: 14,
    subject_tone: "genuine, wrap-up, no pressure",
    purpose: "Final email. Be honest — say you've sent a few emails and don't want to keep showing up in their inbox. Paint a clear picture of what their gym could look like with Omni — members checking in on their own, no staff at the door, late-night sessions running smoothly. Invite them to come see it at the ZKTeco showroom if they're ever curious. End warmly.",
    length: "longest — 4 paragraphs with fuller, more personal sentences. Feels like a genuine note, not a sales pitch. Paint a picture rather than listing features.",
    cta_type: "for NYC-area gyms: showroom visit at ZKTeco's Midtown Manhattan showroom on 39th Street. For out-of-area gyms: invite them to reach out directly to arrange a virtual demo or local rep visit",
    personalization_level: "high — most personal email of the sequence, should feel handwritten",
  },
];

module.exports = cadence;