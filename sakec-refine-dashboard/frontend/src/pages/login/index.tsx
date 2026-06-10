import { Button, Card, Typography, Space } from 'antd';
import { WindowsOutlined } from '@ant-design/icons';
import { useLogin } from '@refinedev/core';
import { useState } from 'react';

const { Title, Text } = Typography;

export const LoginPage = () => {
  const { mutate: login } = useLogin();
  const [isRedirecting, setIsRedirecting] = useState(false);

  const handleLoginClick = () => {
    setIsRedirecting(true); 
    login({}); 
  };

  return (
    <div
      style={{
        position: 'relative',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        backgroundColor: '#0a0a0a', // True black fallback before video loads
      }}
    >
      {/* GLOW CSS ANIMATION FOR THE BUTTON */}
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

      {/* 1. THE BACKGROUND VIDEO */}
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
        <source src="/bg-video.mp4" type="video/mp4" />
      </video>

      {/* 2. THE DARK GLASS OVERLAY */}
      <div 
        style={{ 
          position: 'absolute', 
          top: 0, 
          left: 0, 
          width: '100%', 
          height: '100%', 
          background: 'rgba(10, 10, 10, 0.65)', // Darkens video by 65%
          backdropFilter: 'blur(4px)', // Blurs video slightly for readability
          zIndex: 1 
        }} 
      />

      {/* 3. THE TRUE BLACK LOGIN CARD */}
      <div style={{ position: 'relative', zIndex: 2 }}>
        <Card
          style={{
            width: 420,
            borderRadius: 16,
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8)', 
            border: '1px solid rgba(255, 255, 255, 0.08)', 
            background: 'rgba(10, 10, 10, 0.85)', // TRUE BLACK, slightly transparent
            backdropFilter: 'blur(16px)', 
          }}
          bodyStyle={{ padding: '48px 40px' }}
        >
          <Space direction="vertical" size="large" style={{ width: '100%', textAlign: 'center' }}>
            <div>
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 16,
                  background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', 
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px',
                  fontSize: 28,
                  boxShadow: '0 10px 25px -5px rgba(59, 130, 246, 0.4)',
                }}
              >
                📊
              </div>
              <Title level={3} style={{ color: '#e5e5e5', margin: 0 }}>
                SAKEC Grading Dashboard
              </Title>
              <Text style={{ color: '#a3a3a3', fontSize: 14 }}>
                Sign in with your college Microsoft account
              </Text>
            </div>

            <Button
              className="glow-button"
              type="primary"
              size="large"
              icon={<WindowsOutlined />}
              onClick={handleLoginClick}
              loading={isRedirecting}
              style={{
                width: '100%',
                height: 48,
                borderRadius: 10,
                background: '#3b82f6', 
                border: 'none',
                fontWeight: 600,
                fontSize: 15,
              }}
            >
              {isRedirecting ? 'Connecting...' : 'Sign in with Microsoft'}
            </Button>

            <Text style={{ color: '#737373', fontSize: 12 }}>
              Only @sakec.onmicrosoft.com teacher accounts are allowed
            </Text>
          </Space>
        </Card>
      </div>
    </div>
  );
};