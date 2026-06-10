import { useState } from 'react';
import { Layout, Menu, Typography, Avatar, Dropdown, Space } from 'antd';
import {
  DashboardOutlined,
  TeamOutlined,
  LogoutOutlined,
  UserOutlined,
  FileDoneOutlined,
} from '@ant-design/icons';
import { useGetIdentity, useLogout } from '@refinedev/core';
import { Link, Outlet, useLocation } from 'react-router-dom';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

export const AppLayout = () => {
  const [collapsed, setCollapsed] = useState(false);

  const { data: identity } = useGetIdentity<{
    name: string;
    email: string;
  }>();
  const { mutate: logout } = useLogout();
  const location = useLocation();

  const menuItems = [
    {
      key: '/',
      icon: <DashboardOutlined />,
      label: <Link to="/">Dashboard</Link>,
    },
    {
      key: '/teams',
      icon: <TeamOutlined />,
      label: <Link to="/teams">Manage Teams</Link>,
    },
    {
      key: '/clearance',
      icon: <FileDoneOutlined />, 
      label: <Link to="/clearance">Term Clearance</Link>,
    },
  ];

  const profileMenu = {
    items: [
      {
        key: 'email',
        label: (
          <Text style={{ color: '#a3a3a3', fontSize: 12 }}>
            {identity?.email}
          </Text>
        ),
        disabled: true,
      },
      { type: 'divider' as const },
      {
        key: 'logout',
        icon: <LogoutOutlined />,
        label: 'Sign Out',
        danger: true,
        onClick: () => logout(),
      },
    ],
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        width={240}
        collapsible
        collapsed={collapsed}
        trigger={null}
        style={{
          background: '#0a0a0a', // TRUE BLACK
          borderRight: '1px solid #262626', // Neutral dark grey border
        }}
      >
        <div 
          onClick={() => setCollapsed(!collapsed)}
          style={{ 
            padding: '20px 24px', 
            borderBottom: '1px solid #262626',
            cursor: 'pointer',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: collapsed ? 'center' : 'flex-start' }}>
            <div
              style={{
                width: 36, height: 36, borderRadius: 10,
                background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
                flexShrink: 0 
              }}
            >
              📊
            </div>
            {!collapsed && (
              <div>
                <Text strong style={{ color: '#e5e5e5', fontSize: 14 }}>SAKEC Grading</Text>
                <br />
                <Text style={{ color: '#a3a3a3', fontSize: 11 }}>Teacher Dashboard</Text>
              </div>
            )}
          </div>
        </div>

        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          style={{
            background: 'transparent',
            borderRight: 'none',
            marginTop: 8,
          }}
          theme="dark"
        />
      </Sider>

      <Layout>
        <Header
          style={{
            background: '#141414', // DARK GREY
            padding: '0 24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid #262626', 
            height: 56,
          }}
        >
         <Text strong style={{ fontSize: 16, color: '#e5e5e5' }}>
            {location.pathname === '/teams' 
              ? 'Manage Teams' 
              : location.pathname === '/clearance' 
              ? 'Term Clearance' 
              : 'Dashboard'}
          </Text>

          <Dropdown menu={profileMenu} trigger={['click']}>
            <Space style={{ cursor: 'pointer' }}>
              <Avatar
                size={32}
                icon={<UserOutlined />}
                style={{
                  background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                }}
              />
              <Text style={{ color: '#e5e5e5', fontWeight: 500 }}>
                {identity?.name || 'Teacher'}
              </Text>
            </Space>
          </Dropdown>
        </Header>

        <Content
          style={{
            margin: 20,
            padding: 0,
            minHeight: 'calc(100vh - 96px)',
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};