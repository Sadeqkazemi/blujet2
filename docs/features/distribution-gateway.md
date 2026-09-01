# Airline distribution gateway — Direct Connect / NDC-aligned

This gateway exposes the central PSS inventory, agency allotments, offers,
orders (PNRs), e-ticket documents and flight coupons to authenticated B2B
partners. It is an airline host/direct-connect contract; certification and
network connectivity with a named GDS (Amadeus, Sabre, Travelport, etc.) still
requires that provider's commercial agreement, test harness and certification.

## Acceptance checklist

- [x] `GET /api/v2/distribution/capabilities` declares the implemented version,
      authentication, currencies and supported workflows without claiming a
      certified third-party GDS connection.
- [x] `POST /api/v2/distribution/air-shopping` returns only the calling agency's
      active, dated allotments and creates signed, five-minute offers bound to
      agency, flight, cabin, passenger count, inventory and price.
- [x] `POST /api/v2/distribution/offer-price` revalidates price and inventory
      from PostgreSQL and returns a refreshed signed offer.
- [x] `POST /api/v2/distribution/orders` validates the signed offer and creates
      the agency booking transactionally using the existing idempotent booking
      engine; no parallel inventory or financial store is introduced.
- [x] `GET /api/v2/distribution/orders/:reference` returns the PNR plus one
      accountable ticket document per passenger and its flight coupon.
- [x] Tampered, expired, cross-agency and stale-price offers fail closed.
