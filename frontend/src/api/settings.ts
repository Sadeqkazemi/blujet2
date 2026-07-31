import { apiGet } from './http';
import type { PublicSocialLinksResult } from '../types/social-links';

export function fetchPublicSocialLinks() {
  return apiGet<PublicSocialLinksResult>('/settings/social-links');
}
