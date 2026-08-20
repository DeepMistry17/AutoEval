import { Refine, Authenticated } from '@refinedev/core';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import routerBindings from '@refinedev/react-router';
import { ConfigProvider, App as AntApp, theme } from 'antd';
import { GoogleOAuthProvider } from '@react-oauth/google';

import { authProvider } from './authProvider';
import { dataProvider } from './dataProvider';

import { LoginPage } from './pages/login';
import { DashboardPage } from './pages/dashboard';
import { TeamsPage } from './pages/teams';
import StudentClearancePage from './pages/clearance';
import { LandingPage } from './pages/landing';
import { AppLayout } from './components/layout';

import '@refinedev/antd/dist/reset.css';

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

function App() {
  return (
    <GoogleOAuthProvider clientId={googleClientId}>
      <BrowserRouter>
        <ConfigProvider
          theme={{
            algorithm: theme.darkAlgorithm,
            token: {
              colorPrimary: '#3b82f6', // Keep the blue accent for primary buttons
              colorBgBase: '#0a0a0a', // TRUE BLACK: Main background
              colorBgContainer: '#141414', // DARK GREY: Cards, tables, and inputs
              colorBgElevated: '#1f1f1f', // SLIGHTLY LIGHTER GREY: Modals and dropdowns
              colorBorderSecondary: '#262626', // Neutral grey borders
              borderRadius: 8,
              fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            },
            components: {
              Layout: {
                headerBg: '#141414', // Matches dark cards
                siderBg: '#0a0a0a',  // Matches black background
              },
              Table: {
                headerBg: '#1a1a1a', // Distinct dark grey for table headers
              }
            }
          }}
        >
          <AntApp>
            <Refine
              routerProvider={routerBindings}
              authProvider={authProvider}
              dataProvider={dataProvider}
              resources={[
                {
                  name: 'dashboard',
                  list: '/',
                  meta: { label: 'Dashboard', icon: '📊' },
                },
                {
                  name: 'teams',
                  list: '/teams',
                  meta: { label: 'Manage Teams', icon: '👥' },
                },
                {
                  name: 'clearance',
                  list: '/clearance',
                  meta: { label: 'Term Clearance', icon: '📁' },
                },
              ]}
              options={{
                syncWithLocation: true,
                warnWhenUnsavedChanges: true,
              }}
            >
              <Routes>
                {/* Public Routes */}
                <Route path="/landing" element={<LandingPage />} />
                <Route path="/login" element={<LoginPage />} />

                {/* Protected Dashboard Routes */}
                <Route
                  element={
                    <Authenticated
                      key="authenticated-routes"
                      fallback={<Navigate to="/login" replace />}
                      loading={<div style={{ padding: '50px', fontSize: '20px' }}>Checking Authentication...</div>}
                    >
                      <AppLayout />
                    </Authenticated>
                  }
                >
                  <Route index element={<DashboardPage />} />
                  <Route path="/teams" element={<TeamsPage />} />
                  <Route path="/clearance" element={<StudentClearancePage />} />
                </Route>

                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Refine>
          </AntApp>
        </ConfigProvider>
      </BrowserRouter>
    </GoogleOAuthProvider>
  );
}

export default App;