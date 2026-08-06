import { Typography, Space, message } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import { GoogleLogin } from '@react-oauth/google';
import { useLogin } from '@refinedev/core';
import { Navigate } from 'react-router-dom';

const { Title, Text } = Typography;

export const LoginPage = () => {
  const { mutate: login } = useLogin();

  // Redirect if user is already authenticated in session
  const isAuthenticated = Boolean(sessionStorage.getItem('access_token'));
  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

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
          backgroundColor: 'rgba(10, 10, 10, 0.40)',
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
          width: '900px',
          maxWidth: '90%',
          minHeight: '500px',
          borderRadius: '24px',
          background: 'rgba(15, 15, 15, 0.55)',
          backdropFilter: 'blur(24px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 30px 60px rgba(0, 0, 0, 0.6)',
          overflow: 'hidden',
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
            background: 'rgba(0, 0, 0, 0.2)',
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

            <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'center' }}>
              <GoogleLogin
                onSuccess={(response) => {
                  if (response.credential) {
                    login({ credential: response.credential });
                  } else {
                    message.error('Google token missing.');
                  }
                }}
                onError={() => {
                  message.error('Google Login failed.');
                }}
                theme="filled_black"
                shape="pill"
                text="signin_with"
                width="280"
              />
            </div>

            <Text style={{ color: '#525252', fontSize: 12, display: 'block', marginTop: '16px' }}>
              Only approved @sakec.ac.in accounts are permitted to access this system.
            </Text>
          </Space>
        </div>
      </div>
    </div>
  );
};