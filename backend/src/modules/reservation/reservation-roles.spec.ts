import {
  CAN_LOCK_ROLES,
  CAN_SEAT_LOCK_ROLES,
  RESERVATION_ROLES,
} from './reservation-roles';

describe('reservation role policy', () => {
  it('lets Commercial Manager manage the seat map while IT remains read-only', () => {
    expect(RESERVATION_ROLES).toContain('COMMERCIAL_MANAGER');
    expect(RESERVATION_ROLES).toContain('IT_MANAGER');
    expect(CAN_SEAT_LOCK_ROLES).toContain('COMMERCIAL_MANAGER');
    expect(CAN_SEAT_LOCK_ROLES).not.toContain('IT_MANAGER');
  });

  it('keeps staff PNR operations separate from managerial seat locking', () => {
    expect(CAN_LOCK_ROLES).toContain('IT_MANAGER');
    expect(CAN_LOCK_ROLES).toContain('COMMERCIAL_MANAGER');
  });
});
