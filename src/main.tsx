import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App.tsx';
import { PublicMenu } from './components/PublicMenu.tsx';
import { RestaurantMenuPage } from './pages/RestaurantMenuPage.tsx';
import { NotFound } from './pages/NotFound.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        {/* Public customer-facing menu — original route (kept for compatibility) */}
        <Route path="/menu" element={<PublicMenu />} />

        {/* Multi-tenant restaurant route: /r/{restaurantId} */}
        <Route path="/r/:restaurantId" element={<RestaurantMenuPage />} />

        {/* Admin Panel — all other routes go to App */}
        <Route path="/*" element={<App />} />

        {/* Catch-all 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
