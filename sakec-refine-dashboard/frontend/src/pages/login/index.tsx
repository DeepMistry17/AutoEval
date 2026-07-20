import { Button, Typography, Space } from 'antd';
import { WindowsOutlined, LockOutlined } from '@ant-design/icons';
import { useLogin } from '@refinedev/core';
import { useState } from 'react';
import { useIsAuthenticated } from '@azure/msal-react';
import { Navigate } from 'react-router-dom';

const { Title, Text } = Typography;

export const LoginPage = () => {
  const { mutate: login } = useLogin();
  const [isRedirecting, setIsRedirecting] = useState(false);
  const isAuthenticated = useIsAuthenticated();

  // Fix: Stop the login loop by pushing authenticated users to the dashboard
  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const handleLoginClick = () => {
    setIsRedirecting(true); 
    login({}); 
  };

  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        minHeight: '100vh',
        width: '100vw',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        backgroundColor: '#0a0a0a',
      }}
    >
      {/* CSS ANIMATIONS */}
      <style>
        {`
          .glow-button {
            transition: all 0.3s ease;
          }
          .glow-button:hover {
            box-shadow: 0 0 20px rgba(59, 130, 246, 0.7);
            transform: translateY(-2px);
          }
          .glow-button:active {
            box-shadow: 0 0 30px rgba(59, 130, 246, 1);
            transform: translateY(0px);
          }
        `}
      </style>

      {/* 1. FULL SCREEN CINEMATIC VIDEO BACKGROUND */}
      <video
        autoPlay
        loop
        muted
        playsInline
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          zIndex: 0,
        }}
      >
        <source src="/login-video.mp4" type="video/mp4" />
      </video>

      {/* 2. SUBTLE DARK OVERLAY OVER THE ENTIRE VIDEO */}
      <div 
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(10, 10, 10, 0.40)', // 65% dark tint for readability
          zIndex: 1,
        }}
      />

      {/* 3. CENTERED GLASS RECTANGLE (SPLIT LAYOUT) */}
      <div
        style={{
          position: 'relative',
          zIndex: 2,
          display: 'flex',
          flexDirection: 'row',
          width: '900px', // Fixed width for the rectangle
          maxWidth: '90%', // Ensures it shrinks on smaller screens
          minHeight: '500px',
          borderRadius: '24px',
          background: 'rgba(15, 15, 15, 0.55)', // Dark glass effect
          backdropFilter: 'blur(24px)', // Heavy blur so the video looks frosted behind it
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 30px 60px rgba(0, 0, 0, 0.6)',
          overflow: 'hidden', // Keeps the inner divs inside the rounded corners
        }}
      >
        {/* LEFT SIDE - BRANDING & PUBLICITY */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px',
            background: 'rgba(0, 0, 0, 0.2)', // Slightly darker to separate from the right side
            borderRight: '1px solid rgba(255, 255, 255, 0.05)',
            textAlign: 'center',
          }}
        >
          <img 
            src="/sakec-logo.png" 
            alt="Markify Logo" 
            style={{ width: 140, height: 140, objectFit: 'contain', marginBottom: '24px' }} 
          />
          <Title level={2} style={{ color: '#ffffff', margin: 0, fontSize: 36, letterSpacing: '0.5px' }}>
            Markify
          </Title>
          <Text style={{ color: '#a3a3a3', fontSize: 16, marginTop: '8px', maxWidth: '280px' }}>
            The premier AI Evaluator & Reminder System for modern institutions.
          </Text>
        </div>

        {/* RIGHT SIDE - FACULTY LOGIN */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '50px 40px',
            textAlign: 'center',
          }}
        >
          <Space direction="vertical" size="large" style={{ width: '100%', maxWidth: '320px' }}>
            <div>
              <LockOutlined style={{ fontSize: '32px', color: '#3b82f6', marginBottom: '16px' }} />
              <Title level={3} style={{ color: '#e5e5e5', margin: 0, fontSize: 24 }}>
                Faculty Portal
              </Title>
              <Text style={{ color: '#737373', fontSize: 14, display: 'block', marginTop: '8px' }}>
                Sign in to access your dashboard, manage teams, and evaluate submissions.
              </Text>
            </div>

            <div style={{ marginTop: '24px' }}>
              <Button
                className="glow-button"
                type="primary"
                size="large"
                icon={<WindowsOutlined />}
                onClick={handleLoginClick}
                loading={isRedirecting}
                style={{
                  width: '100%',
                  height: 52,
                  borderRadius: 12,
                  background: '#3b82f6', 
                  border: 'none',
                  fontWeight: 600,
                  fontSize: 16,
                }}
              >
                {isRedirecting ? 'Connecting...' : 'Sign in with Microsoft'}
              </Button>
            </div>

            <Text style={{ color: '#525252', fontSize: 12, display: 'block', marginTop: '16px' }}>
              Only approved @sakec.onmicrosoft.com accounts are permitted to access this system.
            </Text>
          </Space>
        </div>
      </div>
    </div>
  );
};