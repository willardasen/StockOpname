import { useEffect, useState, useRef, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { initializeDatabase } from '@/repositories';
import { ProtectedRoute } from '@/components/common';
import { Layout } from '@/views/Layout';

// Lazy Loading Components
// Lazy Loading Components
const Login = lazy(() => import('@/views/Login').then(module => ({ default: module.Login })));
const Dashboard = lazy(() => import('@/views/Dashboard').then(module => ({ default: module.Dashboard })));
const ProductList = lazy(() => import('@/views/ProductList').then(module => ({ default: module.ProductList })));
const StockOpname = lazy(() => import('@/views/StockOpname').then(module => ({ default: module.StockOpname })));
const TransactionHistory = lazy(() => import('@/views/TransactionHistory').then(module => ({ default: module.TransactionHistory })));
const BrandManager = lazy(() => import('@/views/BrandManager').then(module => ({ default: module.BrandManager })));
const StockIn = lazy(() => import('@/views/StockIn').then(module => ({ default: module.StockIn })));
const StockOut = lazy(() => import('@/views/StockOut').then(module => ({ default: module.StockOut })));
const SalesReport = lazy(() => import('@/views/SalesReport').then(module => ({ default: module.SalesReport })));
import './App.css';

function App() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  const initCalled = useRef(false);

  useEffect(() => {
    const init = async () => {
      if (initCalled.current) return;
      initCalled.current = true;

      try {
        await initializeDatabase();
        
        // DEBUG: Check Schema
        const { getDb } = await import('@/repositories/db');
        const db = await getDb();
        console.log("DEBUG: brand_types schema:", await db.select("PRAGMA table_info(brand_types)"));
        console.log("DEBUG: type_numbers schema:", await db.select("PRAGMA table_info(type_numbers)"));

        setIsInitialized(true);
      } catch (error) {
        console.error('Database initialization failed:', error);
        let errorMessage = 'Unknown error';
        if (error instanceof Error) {
          errorMessage = error.message;
        } else if (typeof error === 'string') {
          errorMessage = error;
        } else if (error && typeof error === 'object') {
          errorMessage = JSON.stringify(error, null, 2);
        }
        setInitError(errorMessage);
      }
    };
    init();
  }, []);

  if (initError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-red-50 dark:bg-red-900/20 p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Initialization Error</h1>
          <p className="text-red-500">{initError}</p>
        </div>
      </div>
    );
  }

  if (!isInitialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Initializing database...</p>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Suspense fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Loading...</p>
          </div>
        </div>
      }>
        <Routes>
          {/* Public Route */}
          <Route path="/login" element={<Login />} />
          
          {/* Protected Routes */}
          <Route path="/" element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }>
            <Route index element={<Dashboard />} />
            <Route path="products" element={<ProductList />} />
            <Route path="stock-in" element={<StockIn />} />
            <Route path="stock-out" element={<StockOut />} />
            <Route path="stock-opname" element={<StockOpname />} />
            <Route path="transactions" element={<TransactionHistory />} />
            <Route path="sales-report" element={<SalesReport />} />
            <Route path="brand" element={<BrandManager />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
