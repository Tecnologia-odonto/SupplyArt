import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Layout from './components/Layout/Layout';
import Login from './pages/Auth/Login';
import ResetPassword from './pages/Auth/ResetPassword';
import Dashboard from './pages/Dashboard/Dashboard';
import Profile from './pages/Profile/Profile';
import Items from './pages/Items/Items';
import Units from './pages/Units/Units';
import Locations from './pages/Locations/Locations';
import Suppliers from './pages/Suppliers/Suppliers';
import Stock from './pages/Stock/Stock';
import CDStock from './pages/CDStock/CDStock';
import EmRota from './pages/EmRota/EmRota';
import Inventory from './pages/Inventory/Inventory';
import Requests from './pages/Requests/Requests';
import Purchases from './pages/Purchases/Purchases';
import Financial from './pages/Financial/Financial';
import Movements from './pages/Movements/Movements';
import Logs from './pages/Logs/Logs';
import Users from './pages/Users/Users';
import Quotations from './pages/Quotations/Quotations';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return user ? <>{children}</> : <Navigate to="/login" replace />;
};

const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return user ? <Navigate to="/" replace /> : <>{children}</>;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <Routes>
            <Route
              path="/login"
              element={
                <PublicRoute>
                  <Login />
                </PublicRoute>
              }
            />
            <Route
              path="/*"
              element={
                <ProtectedRoute>
                  <Layout>
                    <Routes>
                      <Route path="/" element={<Dashboard />} />
                      <Route path="/profile" element={<Profile />} />
                      <Route path="/items" element={<Items />} />
                      <Route path="/units" element={<Units />} />
                      <Route path="/locations" element={<Locations />} />
                      <Route path="/suppliers" element={<Suppliers />} />
                      <Route path="/stock" element={<Stock />} />
                      <Route path="/cd-stock" element={<CDStock />} />
                      <Route path="/em-rota" element={<EmRota />} />
                      <Route path="/inventory" element={<Inventory />} />
                      <Route path="/requests" element={<Requests />} />
                      <Route path="/purchases" element={<Purchases />} />
                      <Route path="/financial" element={<Financial />} />
                      <Route path="/movements" element={<Movements />} />
                      <Route path="/logs" element={<Logs />} />
                      <Route path="/users" element={<Users />} />
                      <Route path="/quotations" element={<Quotations />} />
                      <Route path="/reset-password" element={<ResetPassword />} />
                      <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                  </Layout>
                </ProtectedRoute>
              }
            />
          </Routes>
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#363636',
                color: '#fff',
              },
            }}
          />
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;