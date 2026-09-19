// Visual identity for the Live Discovery experience.
//
// Deliberately NOT a TikTok Live clone: instead of flat black + single red
// accent, Discovery uses a layered "Aurora" treatment — a deep violet/teal
// gradient backdrop, glassy translucent cards, and a soft glow around live
// badges — while still pulling from the app's existing accent colors
// (#25f4ee teal, #ff2b54 coral, amber for coins) so it reads as part of
// Pulse rather than a different app bolted on.

export const LIVE_THEME = {
  // Backdrop: deep violet -> near-black, gives Discovery its own mood
  // distinct from the pure-black video feed.
  backdropGradient: 'linear-gradient(180deg, #150c24 0%, #0b0a12 45%, #08070d 100%)',
  auroraGlow: 'radial-gradient(circle at 20% 0%, rgba(160,108,255,0.25), transparent 55%), radial-gradient(circle at 85% 15%, rgba(37,244,238,0.18), transparent 50%)',

  // Card surfaces
  cardBg: 'rgba(255,255,255,0.045)',
  cardBorder: 'rgba(255,255,255,0.09)',
  cardBgActive: 'rgba(160,108,255,0.14)',
  cardBorderActive: 'rgba(160,108,255,0.55)',

  // Accents (reused from the rest of the app for consistency)
  teal: '#25f4ee',
  coral: '#ff2b54',
  magenta: '#ff007a',
  violet: '#a06cff',
  amber: '#ffbe0b',

  liveBadgeGradient: 'linear-gradient(90deg, #ff2b54, #ff007a)',
  liveBadgeGlow: '0 0 14px rgba(255,43,84,0.55)',

  trendingGradient: 'linear-gradient(135deg, #a06cff, #ff007a)',

  chipInactiveBg: 'rgba(255,255,255,0.06)',
  chipActiveBg: 'linear-gradient(90deg, #a06cff, #25f4ee)',
} as const;

export type LiveThemeKey = keyof typeof LIVE_THEME;
