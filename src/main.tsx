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

        {/* Admin Panel — handle specific paths first */}
        <Route path="/login" element={<App />} />
        {/* If the app manages its own internal routing via App.tsx, we keep it as is, 
            but for the dynamic root, we need to be careful. 
            However, based on App.tsx, it renders components based on activeTab. 
        */}

        {/* Multi-tenant restaurant route: /:restaurantId */}
        <Route path="/:restaurantId" element={<RestaurantMenuPage />} />

        {/* Admin Panel Root */}
        <Route path="/" element={<App />} />

        {/* Catch-all 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
