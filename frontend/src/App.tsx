import { BrowserRouter, Routes, Route } from 'react-router-dom';

function Placeholder({ title }: { title: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-body font-sans text-ink">
      <p className="text-lg font-semibold">{title}</p>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Placeholder title="blujet" />} />
      </Routes>
    </BrowserRouter>
  );
}
