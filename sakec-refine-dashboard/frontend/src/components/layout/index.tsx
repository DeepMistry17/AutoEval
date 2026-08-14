import { useState, useEffect, useRef } from 'react';
import { Layout, Menu, Typography, Avatar, Dropdown, Space, Badge, List } from 'antd';
import {
  DashboardOutlined,
  TeamOutlined,
  LogoutOutlined,
  UserOutlined,
  FileDoneOutlined,
  BellOutlined,
} from '@ant-design/icons';
import { useGetIdentity, useLogout } from '@refinedev/core';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { socket } from '../../utils/socket';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

interface AppNotification {
  id: number;
  title: string;
  description: string;
  time: string;
}

interface DbEvent {
  table: string;
  action: string;
}

export const AppLayout = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const eventBatchRef = useRef<DbEvent[]>([]);

  const { data: identity } = useGetIdentity<{
    name: string;
    email: string;
    ms_id: string;
  }>();
  const { mutate: logout } = useLogout();
  const location = useLocation();

  // ─── GLOBAL NOTIFICATION LISTENER & SMART MESSENGER ───────────────────────
  useEffect(() => {
    socket.connect();

    // ─── NEW: Join Private Room ───
    if (identity?.ms_id) {
      socket.emit('join_room', identity.ms_id);
    }

    const handleDbUpdate = (payload?: { table?: string; action?: string }) => {
      eventBatchRef.current.push({
        table: payload?.table || 'database',
        action: payload?.action || 'UPDATE'
      });

      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      timeoutRef.current = setTimeout(() => {
        const events = eventBatchRef.current;
        let specificDescription = '';

        const subCount = events.filter(e => e.table === 'submissions').length;
        const assignCount = events.filter(e => e.table === 'assignments').length;

        if (subCount > 0) specificDescription += `${subCount} student submission(s) graded by AI. `;
        if (assignCount > 0) specificDescription += `${assignCount} assignment(s) synchronized. `;
        if (!specificDescription) specificDescription = `${events.length} general updates processed.`;

        const newNotif: AppNotification = {
          id: Date.now(),
          title: `System Update (${events.length} items)`,
          description: specificDescription.trim(),
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        };

        setNotifications((prev) => [newNotif, ...prev].slice(0, 15));
        setUnreadCount((prev) => prev + 1);
        eventBatchRef.current = [];
      }, 1500);
    };

    socket.on('refresh_dashboard', handleDbUpdate);

    return () => {
      socket.off('refresh_dashboard', handleDbUpdate);
    };
  }, [identity?.ms_id]);
  // ────────────────────────────────────────────────────────────────────────────

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

  const notificationMenu = (
    <div style={{ width: 360, background: '#1f1f1f', borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.5)', padding: '8px 0', zIndex: 1000 }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #333', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text strong style={{ color: '#fff', fontSize: 14 }}>Dashboard Event Log</Text>
        <Text style={{ color: '#3b82f6', cursor: 'pointer', fontSize: 13 }} onClick={() => setUnreadCount(0)}>Mark all read</Text>
      </div>
      <List
        style={{ maxHeight: 350, overflowY: 'auto' }}
        dataSource={notifications}
        locale={{ emptyText: <Text style={{ color: '#666', padding: '16px' }}>No recent activity</Text> }}
        renderItem={(item) => (
          <List.Item style={{ padding: '16px 20px', borderBottom: '1px solid #333' }}>
            <List.Item.Meta
              title={<Text style={{ color: '#e5e5e5', fontSize: 14, fontWeight: 600 }}>{item.title}</Text>}
              description={
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                  <Text style={{ color: '#a3a3a3', fontSize: 13 }}>{item.description}</Text>
                  <Text style={{ color: '#666', fontSize: 12 }}>{item.time}</Text>
                </div>
              }
            />
          </List.Item>
        )}
      />
    </div>
  );

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        width={240}
        collapsible
        collapsed={collapsed}
        trigger={null}
        style={{
          background: '#0a0a0a',
          borderRight: '1px solid #262626',
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
            <img
              src="/sakec-logo.png"
              alt="Markify Logo"
              style={{
                width: 80,
                height: 80,
                objectFit: 'contain',
                flexShrink: 0
              }}
            />
            {!collapsed && (
              <div>
                <Text strong style={{ color: '#e5e5e5', fontSize: 14 }}>Markify</Text>
                <br />
                <Text style={{ color: '#a3a3a3', fontSize: 11 }}>AI Evaluator & Reminder System</Text>
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
            background: '#141414',
            padding: '0 24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid #262626',
            height: 64,
            lineHeight: 'normal',
          }}
        >
          <Text strong style={{ fontSize: 16, color: '#e5e5e5' }}>
            {location.pathname === '/teams'
              ? 'Manage Teams'
              : location.pathname === '/clearance'
                ? 'Term Clearance'
                : 'Dashboard'}
          </Text>

          <Space size={20} align="center">

            {/* ─── NOTIFICATION TICKER (PROPERLY SIZED) ─── */}
            <Dropdown
              dropdownRender={() => notificationMenu}
              trigger={['click', 'hover']}
              onOpenChange={(open) => { if (open) setUnreadCount(0); }}
              placement="bottomRight"
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  background: '#1a1a1a',

                  // 1. HEIGHT & OVERALL THICKNESS
                  // Change the first number (6px) to make the box taller or shorter.
                  // Change the second number (16px) to add more horizontal space inside the box.
                  padding: '10px 30px',

                  borderRadius: 20,
                  border: '1px solid #333',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                }}
              >
                <Badge count={unreadCount} size="small" offset={[4, -4]}>

                  {/* 2. ICON SIZE */}
                  {/* Increase this number to make the bell larger */}
                  <BellOutlined style={{ fontSize: 18, color: unreadCount > 0 ? '#eaa008' : '#3b82f6' }} />

                </Badge>

                {/* 3. MAXIMUM LENGTH (WIDTH) */}
                {/* Increase this number (e.g., 280 or 300) to allow more text to show before it gets cut off with "..." */}
                <div style={{ maxWidth: 330, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>

                  {/* 4. TEXT SIZE */}
                  {/* Increase this number to make the actual notification text larger */}
                  <Text style={{ color: '#e5e5e5', fontSize: 13, fontWeight: 500 }}>
                    {notifications.length > 0 ? notifications[0].description : 'Monitoring live updates...'}
                  </Text>

                </div>
              </div>
            </Dropdown>

            {/* ─── PROFILE MENU ─── */}
            <Dropdown menu={profileMenu} trigger={['click']}>
              <Space style={{ cursor: 'pointer' }}>
                <Avatar
                  size={32}
                  icon={<UserOutlined />}
                  style={{
                    background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                  }}
                />
                <Text style={{ color: '#e5e5e5', fontWeight: 500, fontSize: 14 }}>
                  {identity?.name || 'Teacher'}
                </Text>
              </Space>
            </Dropdown>

          </Space>
        </Header>

        <Content
          style={{
            margin: 20,
            padding: 0,
            minHeight: 'calc(100vh - 104px)',
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};