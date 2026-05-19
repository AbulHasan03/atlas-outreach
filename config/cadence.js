// ─────────────────────────────────────────────────────────────────────────────
// ATLAS OUTREACH — CADENCE CONFIG
// Defines the timing and strategic purpose of each message in the sequence.
// ─────────────────────────────────────────────────────────────────────────────

const cadence = [
  {
    message_number: 1,
    send_on_day: 0,
    subject_tone: "problem-aware, specific to their vertical",
    purpose: "Introduce the core pain point they experience, briefly introduce Atlas as the solution, and reference an existing customer in their vertical as proof. End with a low-friction CTA: offer to ship a free demo unit before any commitment or call.",
    length: "short — 4 short paragraphs maximum, no fluff",
    cta_type: "ship demo unit / 20-min call",
    personalization_level: "high — mention their company and vertical specifically",
  },
  {
    message_number: 2,
    send_on_day: 3,
    subject_tone: "follow-up, adds new value",
    purpose: "Brief reference to Message 1. Add a new, specific proof point or customer win that wasn't in Message 1 — ideally quantified (cost saved, revenue recovered, staff hours eliminated). Soft CTA: ask if a 15-minute call makes sense.",
    length: "very short — 2-3 paragraphs",
    cta_type: "15-minute call",
    personalization_level: "medium — reference their specific pain point from Message 1",
  },
  {
    message_number: 3,
    send_on_day: 7,
    subject_tone: "value-add, insight-driven",
    purpose: "Share a relevant industry insight, stat, or use case specific to their vertical. Don't repeat the pitch — add genuinely new information. Reference the ZKBioSecurity demo video (youtube.com/watch?v=oCSdoKdaDKo) as a concrete resource. Escalate CTA to a live product demo.",
    length: "short — 3 paragraphs",
    cta_type: "live product demo",
    personalization_level: "medium",
  },
  {
    message_number: 4,
    send_on_day: 14,
    subject_tone: "low-key, direct, no pressure",
    purpose: "Final touch in the automated cadence. Make a concrete, easy offer — a no-risk pilot or a free hardware demo unit shipped to their location. Keep it short and pressure-free. Do NOT use urgency language, countdown language, or 'last chance' framing. Just make it easy to say yes with a simple reply.",
    length: "very short — 2 paragraphs max",
    cta_type: "pilot program / free hardware demo unit",
    personalization_level: "high — acknowledge the prior outreach naturally, make the offer feel genuine not pressured",
  },
];

module.exports = cadence;