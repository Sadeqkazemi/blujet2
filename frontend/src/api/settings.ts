import { apiGet } from './http';
import type { StoredLocale } from '../hooks/useLocale';
import type { PublicAppLinksResult, PublicSupportContact } from '../types/app-links';
import type { PublicSiteContent } from '../types/site-pages';
import type { PublicSocialLinksResult } from '../types/social-links';

export function fetchPublicSocialLinks() {
  return apiGet<PublicSocialLinksResult>('/settings/social-links');
}

export function fetchPublicAppLinks() {
  return apiGet<PublicAppLinksResult>('/settings/app-links');
}

export function fetchPublicSupportContact() {
  return apiGet<PublicSupportContact>('/settings/support-contact');
}

export function fetchPublicSiteContent(locale?: StoredLocale) {
  const q = locale ? `?locale=${locale}` : '';
  return apiGet<PublicSiteContent>(`/settings/site-content${q}`);
}
