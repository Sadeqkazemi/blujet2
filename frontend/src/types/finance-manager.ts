export type FinanceReportScope = 'AGENCIES' | 'CHARTERS' | 'CUSTOMERS';
export type FinanceReportPeriod = 'flight' | 'day' | 'month' | 'q3' | 'q6' | 'year';

export interface PartnerReportRow {
  id: string;
  name: string;
  totalIrr: string;
  paidIrr: string;
  outstandingIrr: string;
  soldSeats: number;
}

export interface FinanceFlightRow {
  flightInstanceId: string;
  flightNo: string;
  departureAt: string;
  originCode: string;
  destCode: string;
  originCityFa: string;
  destCityFa: string;
  capacity: number;
  soldSeats: number;
  unsoldSeats: number;
  totalIrr: string;
  agencyCount: number;
  agencySeats: number;
}

export type FinanceReportResult =
  | {
      kind: 'partners';
      scope: FinanceReportScope;
      period: FinanceReportPeriod;
      rows: PartnerReportRow[];
      summary: { totalIrr: string; paidIrr: string };
    }
  | {
      kind: 'customers';
      scope: 'CUSTOMERS';
      period: FinanceReportPeriod;
      rows: FinanceFlightRow[];
      summary: { totalIrr: string; soldSeats: number };
    };

export interface FinanceFlightDetail {
  summary: FinanceFlightRow;
  agencies: {
    agencyId: string;
    agencyName: string;
    soldSeats: number;
    salesIrr: string;
    paidIrr: string;
    outstandingIrr: string;
  }[];
}

export type FinancialProvider = 'HOLO' | 'SEPIDAR' | 'HESABFA' | 'RAHKARAN' | 'PARMIS';

export interface FinancialIntegration {
  provider: FinancialProvider;
  nameFa: string;
  descriptionFa: string;
  connected: boolean;
  maskedKey: string | null;
  lastSyncedAt: string | null;
  lastSyncOk: boolean | null;
  lastSyncMessage: string | null;
  configured: boolean;
}

export interface FinancialIntegrationsResult {
  providers: FinancialIntegration[];
  connectedCount: number;
}
