export interface PanelNavItem {
  key: string;
  labelFa: string;
  implemented: boolean;
}

export interface PanelAccessFlag {
  panelKey: string;
  enabled: boolean;
  updatedAt: string | null;
}
