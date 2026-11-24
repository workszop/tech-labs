import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { getLang } from '@/i18n'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** BCP 47 locale for the current UI language. */
export function currentLocale(): 'pl-PL' | 'en-US' {
  return getLang() === 'pl' ? 'pl-PL' : 'en-US'
}

/** A number with exactly `digits` decimals in the current language (1.50 / 1,50). */
export function formatFixed(n: number, digits: number): string {
  return new Intl.NumberFormat(currentLocale(), { minimumFractionDigits: digits, maximumFractionDigits: digits, useGrouping: false }).format(n)
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat(currentLocale()).format(Math.round(n))
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${formatFixed(bytes / 1024, 1)} KB`
  return `${formatFixed(bytes / 1024 / 1024, 2)} MB`
}

export function formatMs(ms: number): string {
  return ms < 1000 ? `${Math.round(ms)} ms` : `${formatFixed(ms / 1000, 2)} s`
}

/** English: $0.00. Polish: 0,00 USD. */
export function formatUsd(n: number): string {
  const digits = n !== 0 && n < 0.01 ? 5 : 2
  return getLang() === 'pl' ? `${formatFixed(n, digits)} USD` : `$${n.toFixed(digits)}`
}

/** Date and time in the current language. */
export function formatDateTime(value: string | number | Date): string {
  return new Date(value).toLocaleString(currentLocale(), { dateStyle: 'medium', timeStyle: 'short' })
}

export function uid(prefix = 'id'): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`
}
