// src/lib/auth/disposableEmails.ts — BRT subsystem 2 §4.3
//
// Block list of known disposable / throwaway email domains. Used at signup
// to reject obvious throwaways. NOT a full-coverage solution — the public
// disposable-email lists have ~3,000-10,000 entries and grow daily; we ship
// the highest-volume domains here to keep bundle size sane and update
// quarterly.
//
// Larger lists exist at github.com/disposable/disposable but pulling that
// 100KB+ JSON into the cold-open bundle is wasteful. If signup volume
// outgrows this curated list, switch to a server-side check via an edge
// function that consults a periodically-refreshed table.
//
// Last refresh: 2026-05-11.

const DISPOSABLE_DOMAINS = new Set<string>([
  // Mailinator family
  '0815.ru',
  '10minutemail.com',
  '10minutemail.net',
  '20minutemail.com',
  'discard.email',
  'discardmail.com',
  'discardmail.de',
  'getairmail.com',
  'getnada.com',
  'mailinator.com',
  'mailinator.net',
  'mailinator.org',
  'mailinator2.com',
  'mailmetrash.com',
  'maildrop.cc',
  'mintemail.com',
  'mt2014.com',
  'mt2015.com',
  'sogetthis.com',
  'spam4.me',
  'thankyou2010.com',
  'trbvm.com',
  'trash-mail.de',
  'trashmail.at',
  'trashmail.com',
  'trashmail.de',
  'trashmail.io',
  'trashmail.me',
  'trashmail.net',
  'wegwerfemail.de',

  // Guerrilla Mail family
  'guerrillamail.biz',
  'guerrillamail.com',
  'guerrillamail.de',
  'guerrillamail.info',
  'guerrillamail.net',
  'guerrillamail.org',
  'guerrillamailblock.com',
  'sharklasers.com',

  // Yopmail / similar
  'yopmail.com',
  'yopmail.fr',
  'yopmail.net',
  'cool.fr.nf',
  'jetable.fr.nf',
  'nospam.ze.tc',
  'nomail.xl.cx',
  'mega.zik.dj',
  'speed.1s.fr',
  'courriel.fr.nf',
  'moncourrier.fr.nf',
  'monemail.fr.nf',
  'monmail.fr.nf',

  // Tempmail family
  'tempmail.com',
  'tempmail.net',
  'tempmail.org',
  'tempmailaddress.com',
  'temp-mail.org',
  'temp-mail.io',
  'temp-mail.de',
  'tempinbox.com',

  // Throwaway / e4ward / others
  'e4ward.com',
  'fakeinbox.com',
  'fakemail.fr',
  'fakemailgenerator.com',
  'gmial.com', // intentional typo squat we've seen abuse from
  'inboxbear.com',
  'mintemail.com',
  'mohmal.com',
  'nowmymail.com',
  'spambox.us',
  'spamfree24.org',
  'tmail.ws',
  'tmpmail.org',
  'tmpmail.net',

  // 33mail / harakirimail
  '33mail.com',
  'harakirimail.com',

  // Crew / vipxm / hotpop
  'cosmorph.com',
  'hotpop.com',
  'vipxm.net',
])

/**
 * Returns true if the email's domain matches a known disposable provider.
 * Case-insensitive on the domain. Subdomains of known providers also match
 * (e.g., `foo.mailinator.com`).
 */
export function isDisposableEmail(email: string): boolean {
  if (typeof email !== 'string' || email.length === 0) return false
  const at = email.lastIndexOf('@')
  if (at < 0 || at === email.length - 1) return false
  const domain = email.slice(at + 1).toLowerCase().trim()
  if (DISPOSABLE_DOMAINS.has(domain)) return true
  // Match subdomains: trim leftmost label and re-check.
  const parts = domain.split('.')
  for (let i = 1; i < parts.length - 1; i++) {
    const candidate = parts.slice(i).join('.')
    if (DISPOSABLE_DOMAINS.has(candidate)) return true
  }
  return false
}

/** Number of currently-blocked domains. Useful for telemetry / health. */
export function disposableDomainCount(): number {
  return DISPOSABLE_DOMAINS.size
}
