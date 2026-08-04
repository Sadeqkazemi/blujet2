import { useMemo } from 'react';
import type { CabinClass, SeatMapCell } from '../../../types/public-site';

export interface BookSeatMapProps {
  seats: SeatMapCell[];
  selectedSeats: string[];
  businessLocked: boolean;
  labels: {
    business: string;
    available: string;
    reserved: string;
    selectedSeat: string;
    none: string;
  };
  onToggle: (seatCode: string) => void;
}

function seatStyle(status: SeatMapCell['status'], selected: boolean, businessLocked: boolean) {
  if (status === 'TAKEN') {
    return { bg: '#e6eaf0', border: '#e6eaf0', color: '#9aa4b2', cursor: 'not-allowed' as const };
  }
  if (businessLocked) {
    return { bg: '#f8fafc', border: '#eef1f5', color: '#c2cad4', cursor: 'not-allowed' as const };
  }
  if (selected) {
    return { bg: '#1668c4', border: '#1668c4', color: '#fff', cursor: 'pointer' as const };
  }
  if (status === 'FREE') {
    return { bg: '#eaf4ff', border: '#bcd9f5', color: '#0d2640', cursor: 'pointer' as const };
  }
  return { bg: '#fff', border: '#eef1f5', color: '#0d2640', cursor: 'pointer' as const };
}

export default function BookSeatMap({
  seats,
  selectedSeats,
  businessLocked,
  labels,
  onToggle,
}: BookSeatMapProps) {
  const rows = useMemo(() => {
    const byRow = new Map<number, SeatMapCell[]>();
    for (const s of seats) {
      const list = byRow.get(s.row) ?? [];
      list.push(s);
      byRow.set(s.row, list);
    }
    return Array.from(byRow.entries())
      .sort(([a], [b]) => a - b)
      .map(([row, rowSeats]) => ({
        row,
        seats: rowSeats.sort((a, b) => a.seatCode.localeCompare(b.seatCode)),
      }));
  }, [seats]);

  const selectedLabel =
    selectedSeats.length > 0 ? selectedSeats.join(', ') : labels.none;

  return (
    <div data-testid="seat-grid">
      <div
        style={{
          display: 'flex',
          gap: 11,
          fontSize: 10.5,
          color: '#5a6678',
          marginBottom: 11,
          flexWrap: 'wrap',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span
            style={{
              width: 13,
              height: 13,
              borderRadius: 4,
              background: '#fff6e3',
              border: '1.5px solid #e6c368',
            }}
          />
          {labels.business}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span
            style={{
              width: 13,
              height: 13,
              borderRadius: 4,
              background: '#eaf4ff',
              border: '1.5px solid #bcd9f5',
            }}
          />
          {labels.available}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span
            style={{
              width: 13,
              height: 13,
              borderRadius: 4,
              background: '#e6eaf0',
            }}
          />
          {labels.reserved}
        </span>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 5,
          maxHeight: 300,
          overflow: 'auto',
          background: '#f8fafc',
          border: '1px solid #eef1f5',
          borderRadius: 13,
          padding: 13,
        }}
      >
        {rows.map(({ row, seats: rowSeats }) => (
          <div key={row} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span
              className="font-num"
              style={{
                width: 20,
                fontSize: 9.5,
                color: '#9aa4b2',
                textAlign: 'center',
                flex: 'none',
              }}
            >
              {row}
            </span>
            {rowSeats.map((s) => {
              const selected = selectedSeats.includes(s.seatCode);
              const st = seatStyle(s.status, selected, businessLocked);
              return (
                <button
                  key={s.seatCode}
                  type="button"
                  disabled={s.status === 'TAKEN' || businessLocked}
                  onClick={() => onToggle(s.seatCode)}
                  data-testid={`seat-${s.seatCode}`}
                  className="font-num"
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 7,
                    background: st.bg,
                    border: `1.5px solid ${st.border}`,
                    color: st.color,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 9.5,
                    fontWeight: 700,
                    cursor: st.cursor,
                    padding: 0,
                    fontFamily: 'inherit',
                  }}
                >
                  {s.seatCode.replace(String(row), '')}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <div style={{ fontSize: 11, color: '#5a6678', marginTop: 8 }}>
        {labels.selectedSeat}: <b style={{ color: '#1668c4' }}>{selectedLabel}</b>
      </div>
    </div>
  );
}
