import { Route, Routes } from 'react-router';
import { Footer } from './components/Footer.js';
import { Header } from './components/Header.js';
import { HomePage } from './pages/HomePage.js';
import { ProductPage } from './pages/ProductPage.js';
import { CartPage } from './pages/CartPage.js';
import { LoginPage } from './pages/LoginPage.js';
import { RegisterPage } from './pages/RegisterPage.js';

export function App() {
  return (
    <div className="flex min-h-screen flex-col bg-ink-950 text-fg">
      <Header />
      <div className="flex-1">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/p/:slug" element={<ProductPage />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Routes>
      </div>
      <Footer />
    </div>
  );
}
