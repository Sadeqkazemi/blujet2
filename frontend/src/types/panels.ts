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

export interface PanelSelfStatus {
  panelKey: string | null;
  enabled: boolean;
}

export interface EmployeeContext {
  dept: string | null;
  deptLabelFa: string;
  rank: string | null;
  permissionLabelsFa: string[];
}
