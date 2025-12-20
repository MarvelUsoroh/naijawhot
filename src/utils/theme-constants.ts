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

// Card shape colors (for shape picker and card display)
export const SHAPE_COLORS = {
  circle: { text: '#ef4444', border: 'rgba(239, 68, 68, 0.5)', bg: '#ef4444' },    // red-500
  triangle: { text: '#22c55e', border: 'rgba(34, 197, 94, 0.5)', bg: '#22c55e' },  // green-500
  cross: { text: '#a855f7', border: 'rgba(168, 85, 247, 0.5)', bg: '#a855f7' },    // purple-500
  square: { text: '#3b82f6', border: 'rgba(59, 130, 246, 0.5)', bg: '#3b82f6' },   // blue-500
  star: { text: '#eab308', border: 'rgba(234, 179, 8, 0.5)', bg: '#eab308' },      // yellow-500
} as const;

// UI Colors for consistent styling
export const UI_COLORS = {
  // Badge colors
  badgeError: '#ef4444',      // red-500 for unread count badge
  
  // Timer colors
  timerWarning: '#facc15',    // yellow-400
  timerCritical: '#f87171',   // red-400
  
  // Chat colors
  chatOwnBg: 'rgba(234, 179, 8, 0.2)',      // yellow-500/20
  chatOwnBorder: 'rgba(234, 179, 8, 0.3)',  // yellow-500/30
  chatOtherBg: 'rgba(255, 255, 255, 0.1)',  // white/10
  chatOtherBorder: 'rgba(255, 255, 255, 0.1)', // white/10
  
  // Button active states
  buttonActiveYellow: '#facc15', // yellow-400
  buttonActiveGreen: 'rgba(34, 197, 94, 0.2)', // green-500/20
} as const;
