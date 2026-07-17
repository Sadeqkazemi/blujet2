export interface ManagerReportRow {
  id: string;
  actorId: string;
  actorRole: string;
  category: string;
  action: string;
  detail: string;
  entityType: string | null;
  entityId: string | null;
  createdAt: string;
}
