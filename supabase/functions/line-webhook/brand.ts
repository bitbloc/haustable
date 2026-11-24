// Brand v2 colours for LINE Flex messages.
// Flex only takes hex, so these mirror the hex column of .agents/AGENTS.md §2
// (the OKLCH values in src/index.css are the same colours). Change AGENTS.md first.
//
// Rules carried over from AGENTS.md:
// - plum is the signature (headers, highlights); charcoal is ink and the one primary action
// - red only for errors and destructive states (void, cancelled, failed)
// - no green, orange or neon accents; no pure white or black
export const BRAND = {
  plum: '#41032A',
  plum2: '#571C3E',
  plum3: '#6E3855',
  onPlum2: '#D0B5C1', // secondary text on plum
  charcoal: '#1A1A1A', // ink on light surfaces, primary action fill
  charcoal2: '#292527',
  cream: '#F6F2EA', // light surface, text on plum / charcoal
  paper2: '#ECE4E7', // raised light surface
  paper3: '#E3D9DE',
  rule: '#D4CBCF', // 1px dividers on light surfaces
  neutral: '#635B5F', // labels, helper text (5.89:1 on cream)
  muted: '#524A4E', // secondary text (7.68:1 on cream)
  darkMuted: '#BEB4B9',
  errorRed: '#B42318', // errors and destructive only
} as const
