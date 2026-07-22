import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { Toaster } from '@/components/ui/sonner';
import { Tramites } from '@/pages/Tramites';
import { PDFs } from '@/pages/PDFs';
import { Remitos } from '@/pages/Remitos';
import { LogsExcel } from '@/pages/LogsExcel';

export default function App() {
  return (
    <BrowserRouter>
      <Toaster />
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<Navigate to="/tramites" replace />} />
          <Route path="/tramites" element={<Tramites />} />
          <Route path="/pdfs" element={<PDFs />} />
          <Route path="/remitos" element={<Remitos />} />
          <Route path="/logs-excel" element={<LogsExcel />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
