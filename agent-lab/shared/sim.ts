/**
 * The fixed "today" of the simulation. Warranty periods, delivery estimates and
 * every other business rule use this date, never the real clock, so answers do
 * not drift as time passes. Only durations of tool calls use the real clock.
 */
export const SIM_TODAY = '2026-11-24'
