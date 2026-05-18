// ─────────────────────────────────────────────────────────────────────────────
// ATLAS OUTREACH — PROSPECT CONFIG
// Add, remove, or edit prospects here. Everything else reads from this file.
//
// prospect_type:
//   "existing_customer" → they already use Atlas; email angle is expansion/upsell
//   "new_prospect"      → cold outreach; email angle is intro + pain point
//
// status (managed automatically, but you can override):
//   "active"    → in cadence, will receive emails
//   "replied"   → paused, needs manual follow-up
//   "opted_out" → never email again
//   "won"       → converted, remove from cadence
// ─────────────────────────────────────────────────────────────────────────────

const prospects = [

  // ── PACS DEVELOPERS ─────────────────────────────────────────────────────────
  {
    id: "acre-001",
    company: "ACRE Security",
    first_name: "Sales",
    last_name: "Team",
    email: "sales@acresecurity.com",       // replace with real contact
    title: "VP of Product",
    vertical: "pacs",
    prospect_type: "new_prospect",
    status: "active",
    notes: "Large PACS platform, known Mercury dependency. High priority.",
  },
  {
    id: "amag-001",
    company: "AMAG Technology",
    first_name: "Sales",
    last_name: "Team",
    email: "info@amag.com",
    title: "Product Manager",
    vertical: "pacs",
    prospect_type: "new_prospect",
    status: "active",
    notes: "Symmetry platform. Mercury reseller, volume risk.",
  },
  {
    id: "keri-001",
    company: "Keri Systems",
    first_name: "Sales",
    last_name: "Team",
    email: "sales@kerisystems.com",
    title: "CEO",
    vertical: "pacs",
    prospect_type: "new_prospect",
    status: "active",
    notes: "Smaller PACS developer, likely disqualified from Mercury.",
  },
  {
    id: "gallagher-001",
    company: "Gallagher Security",
    first_name: "Sales",
    last_name: "Team",
    email: "info@gallagher.com",
    title: "VP Engineering",
    vertical: "pacs",
    prospect_type: "new_prospect",
    status: "active",
    notes: "Large install base. OEM API integration story is key.",
  },
  {
    id: "dsx-001",
    company: "DSX Inc",
    first_name: "Sales",
    last_name: "Team",
    email: "info@dsxinc.com",
    title: "CEO",
    vertical: "pacs",
    prospect_type: "existing_customer",   // ← EXISTING CUSTOMER
    status: "active",
    notes: "Existing Atlas customer. Expansion / deeper integration angle.",
  },

  // ── INTERCOM VENDORS ─────────────────────────────────────────────────────────
  {
    id: "aiphone-001",
    company: "Aiphone",
    first_name: "Sales",
    last_name: "Team",
    email: "info@aiphone.com",
    title: "VP of Product",
    vertical: "intercom",
    prospect_type: "new_prospect",
    status: "active",
    notes: "Major intercom brand. Large install base, hardware outsourcing motivation.",
  },
  {
    id: "2n-001",
    company: "2N Telecommunications",
    first_name: "Sales",
    last_name: "Team",
    email: "info@2n.com",
    title: "Business Development Manager",
    vertical: "intercom",
    prospect_type: "new_prospect",
    status: "active",
    notes: "EU-based, strong multi-tenant presence.",
  },
  {
    id: "comelit-001",
    company: "Comelit",
    first_name: "Sales",
    last_name: "Team",
    email: "info@comelit.us",
    title: "VP of Product",
    vertical: "intercom",
    prospect_type: "new_prospect",
    status: "active",
    notes: "Established intercom brand, margin improvement angle.",
  },
  {
    id: "butterflymx-001",
    company: "ButterflyMX",
    first_name: "Sales",
    last_name: "Team",
    email: "partnerships@butterflymx.com",
    title: "Head of Partnerships",
    vertical: "intercom",
    prospect_type: "existing_customer",   // ← EXISTING CUSTOMER
    status: "active",
    notes: "Key existing win. Expansion to new property types.",
  },
  {
    id: "swiftlane-001",
    company: "Swiftlane",
    first_name: "Sales",
    last_name: "Team",
    email: "hello@swiftlane.com",
    title: "CEO",
    vertical: "intercom",
    prospect_type: "existing_customer",   // ← EXISTING CUSTOMER
    status: "active",
    notes: "Existing customer. Face recognition use case is proof point.",
  },

  // ── KEY MANAGEMENT ────────────────────────────────────────────────────────
  {
    id: "ecos-001",
    company: "ecos systems",
    first_name: "Sales",
    last_name: "Team",
    email: "info@ecos-systems.com",
    title: "Product Manager",
    vertical: "key_management",
    prospect_type: "new_prospect",
    status: "active",
    notes: "Smart key cabinet vendor. Re-enrollment cost angle.",
  },
  {
    id: "morse-001",
    company: "Morse Watchmans",
    first_name: "Sales",
    last_name: "Team",
    email: "info@morsewatchmans.com",
    title: "VP of Sales",
    vertical: "key_management",
    prospect_type: "new_prospect",
    status: "active",
    notes: "Key management software + hardware. Credential breadth is key.",
  },
  {
    id: "keycafe-001",
    company: "Keycafe",
    first_name: "Sales",
    last_name: "Team",
    email: "hello@keycafe.com",
    title: "CEO",
    vertical: "key_management",
    prospect_type: "new_prospect",
    status: "active",
    notes: "Smart key exchange for hospitality. High credential diversity need.",
  },
  {
    id: "keytracer-001",
    company: "KeyTracer",
    first_name: "Sales",
    last_name: "Team",
    email: "info@keytracer.com",
    title: "CEO",
    vertical: "key_management",
    prospect_type: "existing_customer",   // ← EXISTING CUSTOMER
    status: "active",
    notes: "Existing customer. Reference for other key management prospects.",
  },

  // ── DAYCARE / CHILDCARE ───────────────────────────────────────────────────
  {
    id: "procare-001",
    company: "Procare Software",
    first_name: "Sales",
    last_name: "Team",
    email: "info@procaresoftware.com",
    title: "VP of Product",
    vertical: "daycare",
    prospect_type: "new_prospect",
    status: "active",
    notes: "Largest childcare SaaS. Top priority for daycare vertical.",
  },
  {
    id: "playground-001",
    company: "Playground Software",
    first_name: "Sales",
    last_name: "Team",
    email: "hello@tryplayground.com",
    title: "CEO",
    vertical: "daycare",
    prospect_type: "existing_customer",   // ← EXISTING CUSTOMER
    status: "active",
    notes: "Existing customer. Use as proof point for Procare outreach.",
  },

  // ── GYM / FITNESS ─────────────────────────────────────────────────────────
  {
    id: "abcfitness-001",
    company: "ABC Fitness",
    first_name: "Sales",
    last_name: "Team",
    email: "info@abcfitness.com",
    title: "VP of Product",
    vertical: "gym",
    prospect_type: "new_prospect",
    status: "active",
    notes: "Large gym software platform. Credential sharing revenue leak angle.",
  },
  {
    id: "torvic-001",
    company: "TORViC Technologies",
    first_name: "Sales",
    last_name: "Team",
    email: "info@torvic.com",
    title: "CEO",
    vertical: "gym",
    prospect_type: "new_prospect",
    status: "active",
    notes: "Visual ClubMate product. After-hours staffing cost angle.",
  },
  {
    id: "rhinofit-001",
    company: "RhinoFit",
    first_name: "Sales",
    last_name: "Team",
    email: "support@rhinofit.ca",
    title: "CEO",
    vertical: "gym",
    prospect_type: "new_prospect",
    status: "active",
    notes: "Smaller gym software. Good for biometric upsell story.",
  },
  {
    id: "firmpos-001",
    company: "FirmPOS",
    first_name: "Sales",
    last_name: "Team",
    email: "info@firmpos.com",
    title: "CEO",
    vertical: "gym",
    prospect_type: "existing_customer",   // ← EXISTING CUSTOMER
    status: "active",
    notes: "Existing gym software customer. Reference account.",
  },

  // ── VISITOR MANAGEMENT (VMS) — GREENFIELD ────────────────────────────────
  {
    id: "envoy-001",
    company: "Envoy",
    first_name: "Sales",
    last_name: "Team",
    email: "hello@envoy.com",
    title: "VP of Product",
    vertical: "vms",
    prospect_type: "new_prospect",
    status: "active",
    notes: "High name recognition. Full hardware stack angle (kiosk + controller).",
  },
  {
    id: "facilityos-001",
    company: "FacilityOS (DGA Security)",
    first_name: "Sales",
    last_name: "Team",
    email: "info@facilityos.com",
    title: "CEO",
    vertical: "vms",
    prospect_type: "new_prospect",
    status: "active",
    notes: "Security-focused VMS. Unattended access workflow angle.",
  },
  {
    id: "proxyclick-001",
    company: "Proxyclick",
    first_name: "Sales",
    last_name: "Team",
    email: "hello@proxyclick.com",
    title: "Business Development",
    vertical: "vms",
    prospect_type: "new_prospect",
    status: "active",
    notes: "Enterprise VMS. QR + face credential angle.",
  },
];

module.exports = prospects;
