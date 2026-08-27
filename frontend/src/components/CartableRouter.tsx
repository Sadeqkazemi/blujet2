import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import CartablePage from '../features/cartable/CartablePage';
import EmployeeCartablePage from '../features/cartable/EmployeeCartablePage';
import OperationsCartablePage from '../features/operations/OperationsCartablePage';
import SupportTicketsPage from '../features/support-tickets/SupportTicketsPage';

/** The `cartable` tab key backs two views: exec panels get the full
 * review/transfer/compose UI (CartablePage); EMPLOYEE gets the simpler
 * design-v2 cartable with «انجام شد» + message-to-manager form. */
export default function CartableRouter() {
  const { user } = useAuth();
  const [section, setSection] = useState<'internal' | 'tickets'>('internal');
  const internal = user?.role === 'EMPLOYEE'
    ? <EmployeeCartablePage />
    : user?.role === 'OPERATIONS_MANAGER'
      ? <OperationsCartablePage />
      : <CartablePage />;

  return (
    <div data-testid="cartable-workspace">
      <nav aria-label="بخش‌های کارتابل" className="mx-[21px] mt-[18px] flex w-fit gap-1 rounded-xl border border-[#253149] bg-[#101827] p-1">
        <button
          type="button"
          onClick={() => setSection('internal')}
          className={`rounded-lg px-4 py-2 text-xs font-bold transition ${section === 'internal' ? 'bg-[#3b82f6] text-white' : 'text-[#91a1b8] hover:text-white'}`}
        >
          کارتابل داخلی
        </button>
        <button
          type="button"
          onClick={() => setSection('tickets')}
          className={`rounded-lg px-4 py-2 text-xs font-bold transition ${section === 'tickets' ? 'bg-[#3b82f6] text-white' : 'text-[#91a1b8] hover:text-white'}`}
        >
          تیکت‌های پشتیبانی
        </button>
      </nav>
      {section === 'internal' ? internal : <SupportTicketsPage embedded employeeMode={user?.role === 'EMPLOYEE'} />}
    </div>
  );
}
