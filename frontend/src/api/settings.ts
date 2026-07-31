import { apiGet } from './http';
import type { PublicAppLinksResult, PublicSupportContact } from '../types/app-links';
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
