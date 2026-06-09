import { Routes, Route } from 'react-router-dom';
import HomePage from '@/pages/HomePage';
import LoginPage from '@/pages/LoginPage';
import ResellerLoginPage from '@/pages/ResellerLoginPage';
import DealerLoginPage from '@/pages/DealerLoginPage';
import AdminLoginPage from '@/pages/AdminLoginPage';
import RegisterPage from '@/pages/RegisterPage';
import VerifyOtpPage from '@/pages/VerifyOtpPage';
import ForgotPasswordPage from '@/pages/ForgotPasswordPage';
import ResetPasswordPage from '@/pages/ResetPasswordPage';
import PaymentCallbackPage from '@/pages/PaymentCallbackPage';
import AdminDashboard from '@/pages/admin/AdminDashboard';
import AdminDealersPage from '@/pages/admin/AdminDealersPage';
import AdminPackagesPage from '@/pages/admin/AdminPackagesPage';
import DealerDashboard from '@/pages/dealer/DealerDashboard';
import DealerPurchasePage from '@/pages/dealer/DealerPurchasePage';
import DealerBulkPage from '@/pages/dealer/DealerBulkPage';
import DealerWalletPage from '@/pages/dealer/DealerWalletPage';
import DealerApiPage from '@/pages/dealer/DealerApiPage';
import DealerOrdersPage from '@/pages/dealer/DealerOrdersPage';
import ResellerDashboard from '@/pages/reseller/ResellerDashboard';
import ResellerPricesPage from '@/pages/reseller/ResellerPricesPage';
import ResellerStorePage from '@/pages/reseller/ResellerStorePage';
import ResellerWithdrawalsPage from '@/pages/reseller/ResellerWithdrawalsPage';
import ResellerOrdersPage from '@/pages/reseller/ResellerOrdersPage';
import AdminOrdersPage from '@/pages/admin/AdminOrdersPage';
import AdminComplaintsPage from '@/pages/admin/AdminComplaintsPage';
import AdminResellersPage from '@/pages/admin/AdminResellersPage';
import AdminWithdrawalsPage from '@/pages/admin/AdminWithdrawalsPage';
import AdminSettingsPage from '@/pages/admin/AdminSettingsPage';
import ResellerComplaintsPage from '@/pages/reseller/ResellerComplaintsPage';
import StoreHomePage from '@/pages/store/StoreHomePage';
import StorePurchasePage from '@/pages/store/StorePurchasePage';
import VerifyPage from '@/pages/store/VerifyPage';
import FloatingWidgets from '@/components/ui/FloatingWidgets';

export default function App() {
  return (
    <>
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/login/reseller" element={<ResellerLoginPage />} />
      <Route path="/login/dealer" element={<DealerLoginPage />} />
      <Route path="/login/admin" element={<AdminLoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/verify-otp" element={<VerifyOtpPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/payment/callback" element={<PaymentCallbackPage />} />
      <Route path="/admin" element={<AdminDashboard />} />
      <Route path="/admin/dealers" element={<AdminDealersPage />} />
      <Route path="/admin/packages" element={<AdminPackagesPage />} />
      <Route path="/admin/orders" element={<AdminOrdersPage />} />
      <Route path="/admin/complaints" element={<AdminComplaintsPage />} />
      <Route path="/admin/resellers" element={<AdminResellersPage />} />
      <Route path="/admin/withdrawals" element={<AdminWithdrawalsPage />} />
      <Route path="/admin/settings" element={<AdminSettingsPage />} />
      <Route path="/dealer" element={<DealerDashboard />} />
      <Route path="/dealer/purchase" element={<DealerPurchasePage />} />
      <Route path="/dealer/bulk" element={<DealerBulkPage />} />
      <Route path="/dealer/wallet" element={<DealerWalletPage />} />
      <Route path="/dealer/api" element={<DealerApiPage />} />
      <Route path="/dealer/orders" element={<DealerOrdersPage />} />
      <Route path="/reseller" element={<ResellerDashboard />} />
      <Route path="/reseller/store" element={<ResellerStorePage />} />
      <Route path="/reseller/prices" element={<ResellerPricesPage />} />
      <Route path="/reseller/withdrawals" element={<ResellerWithdrawalsPage />} />
      <Route path="/reseller/orders" element={<ResellerOrdersPage />} />
      <Route path="/reseller/complaints" element={<ResellerComplaintsPage />} />
      <Route path="/store/:slug" element={<StoreHomePage />} />
      <Route path="/store/:slug/buy/:network" element={<StorePurchasePage />} />
      <Route path="/store/:slug/verify" element={<VerifyPage />} />
    </Routes>
    <FloatingWidgets />
    </>
  );
}
