import { apiGet, apiPatch } from './http';
import type { PanelAccessFlag, PanelNavItem } from '../types/panels';

export function fetchNav() {
  return apiGet<PanelNavItem[]>('/panels/nav');
}

export function fetchAccessFlags() {
  return apiGet<PanelAccessFlag[]>('/panels/access');
}

export function setAccessFlag(panelKey: string, enabled: boolean) {
  return apiPatch<PanelAccessFlag>(`/panels/access/${panelKey}`, { enabled });
}
