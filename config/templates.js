// ─────────────────────────────────────────────────────────────────────────────
// ATLAS OUTREACH — VERTICAL TEMPLATES
// Defines the strategic angle, pain points, and proof points for each vertical.
// The AI generator reads these to personalize each email.
// ─────────────────────────────────────────────────────────────────────────────

const templates = {

  pacs: {
    vertical_name: "Physical Access Control (PACS) Developer",
    product_context: `
      Atlas is a professional-grade door access controller by ZKTeco USA.
      It integrates with any access control platform via a clean cloud OEM API.
      It supports more credential types than any competitor: mobile (Bluetooth/NFC),
      RFID, PIN, QR code, fingerprint, face recognition, and palm vein.
    `,
    new_prospect: {
      hook: "Mercury Security dependency risk",
      pain_points: [
        "Mercury Security (Assa Abloy) requires minimum purchase volumes to stay in their reseller program — volumes dip and the hardware supply can be cut off entirely.",
        "Mercury controllers are expensive, compressing margins on every door deployed.",
        "Cloud-native PACS platforms need a clean OEM API — Mercury's integration story is dated.",
      ],
      value_props: [
        "No minimum purchase volume requirements — any developer qualifies.",
        "Significantly lower cost per door than Mercury — protects margins.",
        "Cloud OEM API designed for modern SaaS platforms.",
        "Supports all credential types: mobile, RFID, biometric, QR, PIN.",
      ],
      proof_points: [
        "DSX Inc integrated Atlas into their PACS platform as a cost-effective Mercury alternative.",
        "Imron Corporation uses Atlas controllers across their access control deployments.",
      ],
      cta_message1: "offer to ship a no-charge demo unit before any commitment",
    },
    existing_customer: {
      hook: "deeper integration and expansion opportunities",
      pain_points: [
        "As their platform grows, they need hardware that scales without supply chain risk.",
        "New credential types (face, palm, mobile wallet) are customer expectations now.",
      ],
      value_props: [
        "Atlas's newest biometric reader lineup adds face and palm vein to existing deployments.",
        "New OEM API features: webhook events, real-time door status, remote unlock.",
        "Volume pricing tiers unlock as deployment counts grow.",
      ],
      proof_points: [],
      cta_message1: "schedule a call to review new hardware and API capabilities",
    },
  },

  intercom: {
    vertical_name: "Intercom Vendor",
    product_context: `
      Atlas door access controllers integrate directly with intercom systems,
      providing the physical door-unlock capability after visitor authentication.
      Atlas supports the widest credential range for multi-tenant properties:
      mobile, RFID, biometric, QR code, and PIN.
    `,
    new_prospect: {
      hook: "outsource controller hardware, focus on software and UX",
      pain_points: [
        "Intercom vendors need a door controller to physically unlock the door after visitor authentication — it's a required hardware component.",
        "Legacy controller options are expensive and limit intercom vendor margins.",
        "Multi-tenant properties increasingly require biometric and mobile credentials alongside traditional RFID.",
      ],
      value_props: [
        "Atlas handles all hardware complexity — intercom vendor focuses on software differentiation.",
        "Broadest credential support of any controller: mobile, biometric, RFID, QR, PIN.",
        "Lower cost than legacy alternatives improves intercom vendor margins per door.",
        "OEM API designed for seamless integration with any intercom software stack.",
      ],
      proof_points: [
        "ButterflyMX integrated Atlas as their door controller for multi-tenant properties.",
        "Swiftlane uses Atlas for their face recognition-based intercom deployments.",
        "Entegrity/VIZpin and Whoo.ai are live Atlas intercom integrations.",
      ],
      cta_message1: "offer to ship a demo unit and walk through the OEM API",
    },
    existing_customer: {
      hook: "expand Atlas deployment to new property types",
      pain_points: [
        "Expanding into commercial or mixed-use properties requires new credential types.",
        "Customers are asking for biometric options alongside mobile access.",
      ],
      value_props: [
        "New Atlas biometric readers (face, palm) available for existing integrations.",
        "Volume pricing improves as deployment count grows.",
      ],
      proof_points: [],
      cta_message1: "schedule a review of new reader options for expanded deployments",
    },
  },

  key_management: {
    vertical_name: "Key Management Software Developer",
    product_context: `
      Atlas door access controllers secure smart key locker cabinet doors.
      The critical advantage: Atlas supports more credential types than any competing
      controller, meaning customers can use their EXISTING employee credentials —
      eliminating the costly and disruptive re-enrollment process.
    `,
    new_prospect: {
      hook: "eliminate re-enrollment costs for your customers",
      pain_points: [
        "Re-enrolling employees with new credentials is the biggest barrier to key locker adoption — it's expensive and disruptive for customers.",
        "Key management vendors need a controller that accepts whatever credentials the customer already uses.",
        "Hardware vendors who build their own controllers distract from their core software differentiation.",
      ],
      value_props: [
        "Atlas accepts RFID, biometric, mobile, QR, and PIN — customers use what they already have.",
        "No re-enrollment = lower barrier to customer purchase = more deals closed.",
        "OEM API handles all hardware complexity so you focus on software.",
        "Lower hardware cost improves your solution's total price competitiveness.",
      ],
      proof_points: [
        "KeyTracer integrated Atlas to accept existing employee RFID credentials in their key lockers.",
        "Torus (Australia) and HandyTrac (US) both use Atlas for key cabinet access control.",
      ],
      cta_message1: "offer a demo unit to test with their existing credential types",
    },
    existing_customer: {
      hook: "new credential types available for existing deployments",
      pain_points: [
        "Customers are requesting mobile and biometric access for key lockers.",
      ],
      value_props: [
        "New Atlas readers support mobile wallet and face recognition — drop-in compatible.",
        "Expanded credential support can be a new upsell tier in your software pricing.",
      ],
      proof_points: [],
      cta_message1: "review new reader options that can expand existing deployments",
    },
  },

  daycare: {
    vertical_name: "Daycare / Childcare Management Software Developer",
    product_context: `
      Atlas door access controllers replace insecure PIN codes with biometric
      and mobile-based entry for childcare facilities. Face recognition and mobile
      app access eliminate credential sharing, unauthorized entry, and the safety
      and liability risks that come with shared PIN codes.
    `,
    new_prospect: {
      hook: "replace insecure shared PINs with biometric access",
      pain_points: [
        "Shared PIN codes are passed between parents, forgotten, and used by unauthorized individuals — creating safety risks and liability exposure for childcare facilities.",
        "Staffing costs increase when facilities need a person at the door to verify identity.",
        "Parents and staff expect a seamless, app-based check-in experience.",
      ],
      value_props: [
        "Biometric access (face recognition) eliminates PIN sharing — only authorized individuals can enter.",
        "Mobile app access lets parents enter with their phone — no forgotten codes.",
        "Unattended secure entry reduces staffing costs at entry points.",
        "Audit trail of every entry provides liability protection for facility operators.",
      ],
      proof_points: [
        "Playground Software integrated Atlas to replace PIN codes with mobile and biometric entry.",
        "ChildcareCRM uses Atlas for secure parent and staff access at their partner facilities.",
        "Lightbridge Academy deployed Atlas for biometric staff entry across multiple locations.",
      ],
      cta_message1: "offer a demo unit and a 15-minute call to discuss the integration",
    },
    existing_customer: {
      hook: "expand biometric access across more facility types",
      pain_points: [
        "Facilities are requesting multi-door coverage beyond just the main entrance.",
      ],
      value_props: [
        "Atlas scales to multi-door deployments with the same OEM API integration.",
        "New palm vein reader option adds a non-contact biometric for hygiene-conscious environments.",
      ],
      proof_points: [],
      cta_message1: "discuss expanding coverage to interior doors and secondary entrances",
    },
  },

  gym: {
    vertical_name: "Gym & Fitness Management Software Developer",
    product_context: `
      Atlas biometric door controllers eliminate membership credential sharing
      (badge lending) and enable after-hours self-service access without staff.
      Face and palm recognition mean a member cannot lend their access credential
      to a non-paying guest — directly recovering lost revenue for gym operators.
    `,
    new_prospect: {
      hook: "stop revenue leakage from membership credential sharing",
      pain_points: [
        "Paying members share RFID badges and key fobs with non-paying guests — direct revenue leakage that gym operators cannot detect or prevent.",
        "After-hours access requires a staff member whose only job is to scan badges — a cost that biometric self-service eliminates entirely.",
        "Gym software vendors are looking for hardware bundling opportunities to increase SaaS subscription value and differentiate from competitors.",
      ],
      value_props: [
        "Biometric access (face or palm) cannot be borrowed — only the paying member can enter.",
        "After-hours self-service entry eliminates the need for a badge-scanning staff member.",
        "Hardware bundling adds a new revenue stream and increases your SaaS subscription value.",
        "Immediate, quantifiable ROI story for gym operators makes your sales cycle shorter.",
      ],
      proof_points: [
        "FirmPOS integrated Atlas biometric controllers to eliminate credential sharing at partner gym locations.",
      ],
      cta_message1: "offer a demo unit and share the ROI calculation for a typical gym",
    },
    existing_customer: {
      hook: "expand biometric coverage and add new revenue streams",
      pain_points: [
        "Gyms are asking for biometric access at secondary doors (locker rooms, equipment rooms).",
      ],
      value_props: [
        "Multi-door Atlas deployments use the same OEM API — no additional integration work.",
        "New palm vein reader is a premium upgrade option for existing gym customers.",
      ],
      proof_points: [],
      cta_message1: "review expansion options for interior door coverage",
    },
  },

  vms: {
    vertical_name: "Visitor Management System (VMS) Developer",
    product_context: `
      Atlas provides the complete hardware stack for VMS deployments: door access
      controllers, biometric kiosks, and turnstile/gate integration. After a visitor
      checks in digitally, Atlas hardware grants physical access via QR code sent
      to their phone or face verification at a kiosk — fully unattended.
    `,
    new_prospect: {
      hook: "VMS software needs hardware to physically grant visitor access",
      pain_points: [
        "VMS software platforms handle check-in digitally, but cannot physically open a door without access control hardware — it is a required component of any unattended access workflow.",
        "Security staffing costs are high when visitors need a human escort after check-in.",
        "Modern visitors expect QR code or face-based entry after digital check-in — not a badge from reception.",
      ],
      value_props: [
        "Atlas provides controllers, biometric kiosks, and turnstile integration in one hardware stack.",
        "QR code credentials sent to visitor's phone enable fully unattended access post-check-in.",
        "Face verification at Atlas kiosks eliminates the need for staff escort.",
        "OEM API integrates with any VMS software platform.",
      ],
      proof_points: [
        "ZKTeco's complete hardware stack (controllers, kiosks, turnstiles) is live in enterprise building deployments.",
        "ZKBioSecurity platform demonstrates the full visitor management + access control workflow: youtube.com/watch?v=oCSdoKdaDKo",
      ],
      cta_message1: "offer to walk through the full hardware stack demo and OEM API",
    },
    existing_customer: {
      hook: "expand hardware coverage for enterprise deployments",
      pain_points: [
        "Enterprise customers are requesting turnstile and lobby kiosk integration.",
      ],
      value_props: [
        "Atlas turnstile and kiosk options extend existing integrations to lobby environments.",
        "Same OEM API — no re-integration required.",
      ],
      proof_points: [],
      cta_message1: "review turnstile and kiosk options for enterprise customer deployments",
    },
  },

  gym_enduser: {
    vertical_name: "Independent Gym / Fitness Studio Owner",
    product_context: `
      The Armatura Omni is a single device that replaces front-desk staff entirely.
      It combines a smart door controller, video intercom, and visitor check-in kiosk
      in one unit — face, palm, keycard, mobile phone, QR code, and PIN all supported.

      For independent gym owners, Omni solves three problems at once:
      1. CREDENTIAL SHARING — biometric face/palm auth means only the enrolled,
         paying member can open the door. A 300-member gym losing 20 credential-share
         users at $40/month = $9,600/year in lost dues recovered immediately.
      2. STAFFING COSTS — a part-time front-desk employee at $15/hr × 20hrs/week
         costs $15,600/year. Omni replaces that entirely. $0 staff required at the door.
      3. LIMITED HOURS — gyms that close at 9-10pm because they can't afford overnight
         staff are turning away paying members who want to train late. Omni enables
         24/7 unattended access with a premium tier ($5-10/month more per member).

      Omni runs on Cielo365 cloud software — access auto-revokes the moment a
      membership lapses. No manual deactivation needed.
      Estimated annual revenue loss for a 300-member gym using traditional access: $32K.
      Omni pays for itself. Price: $5/door/month on Cielo365.

      Key specs: 50K user capacity, IP66 weatherproof, 100ms face auth, AES-128 encrypted,
      PoE single cable, -4° to 140°F operating range.
    `,
    new_prospect: {
      hook: "stop credential sharing and eliminate door staffing costs",
      pain_points: [
        "Key fobs and access cards get shared — a 300-member gym likely has 20+ non-paying 'guests' using shared credentials at any given time. At $40/month average dues, that's $9,600/year walking out the door.",
        "A part-time front-desk employee working 20 hours per week at $15/hr costs $15,600/year in labor alone — before payroll taxes and benefits. They still can't prevent credential sharing or catch every tailgater.",
        "Closing at 9 or 10pm because there's no overnight staff means turning away paying members who want to train late. Those members cancel in favor of 24-hour gyms. You also can't offer a premium 24-hour tier.",
        "Traditional key fobs can't differentiate one person from two — tailgating through the front door happens dozens of times a day with no record and no consequence.",
      ],
      value_props: [
        "Omni's biometric face and palm auth means only the enrolled, paying member can open the door — credential sharing becomes physically impossible.",
        "Replace front-desk labor entirely — $0 staff required at the door when Omni is installed. The hardware pays for itself in under a year from labor savings alone.",
        "24/7 unattended access unlocks a premium membership tier at $5–10/month more per member — new recurring revenue that didn't exist before.",
        "Cielo365 cloud software auto-revokes access the moment a membership lapses. No manual deactivation, no forgotten fobs still opening the door.",
        "One device: door controller + video intercom + visitor kiosk. Single cable (PoE), weatherproof, 50K user capacity.",
      ],
      proof_points: [
        "A 300-member gym using Omni recovers an estimated $9,600/year in lost dues from credential sharing and saves $15,600/year in front-desk labor — $25,200+ annual impact.",
        "FirmPOS integrated Armatura biometric controllers at partner gym locations to eliminate credential sharing.",
      ],
      cta_message1: "offer a free Omni demo unit and site assessment — we'll show exactly how it pays for itself",
    },
    existing_customer: {
      hook: "expand biometric coverage to additional doors or locations",
      pain_points: [
        "Members are requesting access to secondary spaces — locker rooms, equipment rooms, or a second location.",
      ],
      value_props: [
        "Additional Omni units use the same Cielo365 platform — no new software, no re-enrollment.",
        "Palm vein reader available as a premium touchless upgrade for hygiene-conscious environments.",
      ],
      proof_points: [],
      cta_message1: "discuss expanding coverage to additional doors or a second location",
    },
  },

};
module.exports = templates;