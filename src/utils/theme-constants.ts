/**
 * Theme Constants
 * Centralized color definitions matching index.css variables.
 * Use these constants in JS/TS where CSS variables cannot be used (e.g., canvas-confetti).
 */

// Confetti celebration colors (matches --whot-confetti-* in index.css)
export const CONFETTI_COLORS = [
  '#FFD700', // --whot-confetti-gold
  '#FFA500', // --whot-confetti-orange
  '#FF6347', // --whot-confetti-red
  '#00FF00', // --whot-confetti-green
  '#1E90FF', // --whot-confetti-blue
] as const;

// Status colors (matches --whot-status-* in index.css)
export const STATUS_COLORS = {
  success: '#4CAF50', // --whot-status-success
  warning: '#FF9800', // --whot-status-warning
  error: '#F44336',   // --whot-status-error
} as const;

// Accent colors (matches --whot-accent-* in index.css)
export const ACCENT_COLORS = {
  gold: '#FFD700', // --whot-accent-gold
} as const;
