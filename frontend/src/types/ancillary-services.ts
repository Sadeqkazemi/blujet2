/**
 * TEMP MOCK-BACKED DOMAIN — wholly new feature, no backend module exists
 * for ancillary/seat-type service pricing yet (only B2B agency webservice
 * plan pricing exists today, a different domain — see api/webservice-pricing.ts).
 * Shapes mirror the documented future contract in docs/API.md
 * ("Phase — Ancillary services pricing"). See api/ancillary-services-mock.ts.
 */

export interface SeatServiceRow {
  key: string;
  titleFa: string;
  descriptionFa: string;
  priceIrr: string;
  enabled: boolean;
}

export interface AncillaryServiceRow {
  key: string;
  titleFa: string;
  descriptionFa: string;
  priceIrr: string;
  enabled: boolean;
  /** Custom (manager-added) services can be deleted; built-in ones cannot. */
  isCustom: boolean;
}
