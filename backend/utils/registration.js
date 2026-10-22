// Light format checks for the business/publishing identifiers a publisher can
// give as evidence. These only catch typos and obviously fake values - they do
// NOT prove the number belongs to the company. The admin must still look the
// number up on the official register (see the checklist in the admin UI).

const GST_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

// GSTIN: 15 chars; the last is a check character (mod-36 weighted sum).
function isValidGstin(value) {
  const v = String(value).toUpperCase();
  if (!/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(v)) return false;
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const product = GST_CHARS.indexOf(v[i]) * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(product / 36) + (product % 36);
  }
  return GST_CHARS[(36 - (sum % 36)) % 36] === v[14];
}

// ISBN-13 check digit.
function isValidIsbn13(value) {
  const digits = String(value).replace(/[-\s]/g, "");
  if (!/^97[89]\d{10}$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(digits[i]) * (i % 2 === 0 ? 1 : 3);
  return (10 - (sum % 10)) % 10 === Number(digits[12]);
}

const CHECKS = {
  CIN: (v) => /^[LU]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6}$/.test(v), // company (MCA)
  LLPIN: (v) => /^[A-Z]{3}-\d{4}$/.test(v), // LLP (MCA)
  GSTIN: isValidGstin, // tax registration
  UDYAM: (v) => /^UDYAM-[A-Z]{2}-\d{2}-\d{7}$/.test(v), // MSME registration
  ISBN_PREFIX: isValidIsbn13, // a real ISBN of one of their books
  OTHER: (v) => v.length >= 4 && v.length <= 60,
};

const REGISTRATION_TYPES = Object.keys(CHECKS);

const HINTS = {
  CIN: "21 characters, e.g. U22110MH2010PTC123456",
  LLPIN: "e.g. AAB-1234",
  GSTIN: "15 characters, e.g. 27AAPFU0939F1ZV",
  UDYAM: "e.g. UDYAM-MH-12-1234567",
  ISBN_PREFIX: "the full ISBN-13 of one of your published books",
  OTHER: "4-60 characters",
};

// Returns the cleaned value, or null when the format is wrong.
function normaliseRegistration(type, raw) {
  if (!CHECKS[type] || typeof raw !== "string") return null;
  const value = type === "ISBN_PREFIX" ? raw.replace(/[-\s]/g, "") : raw.trim().toUpperCase();
  return CHECKS[type](value) ? value : null;
}

const isHttpUrl = (value) => {
  try {
    const u = new URL(value);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
};

module.exports = { REGISTRATION_TYPES, HINTS, normaliseRegistration, isValidGstin, isValidIsbn13, isHttpUrl };
