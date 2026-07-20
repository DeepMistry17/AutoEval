
import { useState, useEffect } from 'react';
import { Typography, Select, Button, Table, Space, Layout } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import { useCustom } from '@refinedev/core';
import GodViewDrawer from './components/GodViewDrawer';
import ExportModal from './components/ExportModal';

const { Content } = Layout;
const { Title } = Typography;

import { API_URL } from '../../config/constants';

interface TeamDropdown {
  label: string;
  value: string;
}

export default function StudentClearancePage() {
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);

  const [rosterData, setRosterData] = useState([]);
  const [loading, setLoading] = useState(false);

  const { result: teamsResult } = useCustom<TeamDropdown[]>({
    url: '/teams/dropdown',
    method: 'get',
  });

  const rawTeams = teamsResult?.data as unknown;
  const teams: TeamDropdown[] = Array.isArray(rawTeams) ? rawTeams : [];

  useEffect(() => {
    if (selectedTeam) {
      fetchRoster(selectedTeam);
    } else {
      setRosterData([]);
    }
  }, [selectedTeam]);

  const fetchRoster = async (teamId: string) => {
    setLoading(true);
    try {
      const token = sessionStorage.getItem('access_token'); // Grab the security token

      const res = await fetch(`${API_URL}/dashboard/team-roster?teamId=${teamId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`, // Pass the security token
        },
      });

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      const data = await res.json();

      const formattedData = data.map((student: any) => ({
        ...student,
        key: student.prn
      }));

      setRosterData(formattedData);
    } catch (error) {
      console.error("Failed to fetch roster:", error);
    }
    setLoading(false);
  };
  const columns = [
    { title: 'Roll No', dataIndex: 'roll_no', key: 'roll_no', width: 100 },
    {
      title: 'Student Name',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: any) => (
        <a onClick={() => openGodView(record)} style={{ fontWeight: 600, color: '#1677ff' }}>
          {text}
        </a>
      )
    },
    { title: 'PRN', dataIndex: 'prn', key: 'prn' },
    { title: 'Completion', dataIndex: 'completion', key: 'completion' },
  ];

  const openGodView = (student: any) => {
    setSelectedStudent(student);
    setDrawerVisible(true);
  };

  return (
    <Content style={{ padding: '24px', minHeight: '100vh', backgroundColor: '#141414' }}>
      <Space direction="vertical" size="large" style={{ width: '100%' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Title level={4} style={{ color: '#fff', margin: 0 }}>Student Clearance & Export</Title>
            <p style={{ color: '#8c8c8c', margin: 0 }}>Review term work and generate reports.</p>
          </div>
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            style={{ backgroundColor: '#52c41a' }}
            onClick={() => setExportModalVisible(true)}
            disabled={!selectedTeam}
          >
            Export Selected
          </Button>
        </div>

        <div style={{ backgroundColor: '#1f1f1f', padding: '16px', borderRadius: '8px' }}>
          <Select
            showSearch
            allowClear
            placeholder="Search Teams..."
            style={{ width: 300 }}
            value={selectedTeam}
            onChange={(val) => setSelectedTeam(val)}
            filterOption={(input, option) => (option?.label as string ?? '').toLowerCase().includes(input.toLowerCase())}
            options={teams.map((t: TeamDropdown) => ({ label: t.label, value: t.value }))}
          />
        </div>

        <Table
          dataSource={rosterData}
          columns={columns}
          loading={loading}
          pagination={false}
          style={{ backgroundColor: '#1f1f1f', borderRadius: '8px' }}
        />
      </Space>

      <GodViewDrawer
        visible={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        student={selectedStudent}
        teamId={selectedTeam}
      />

      <ExportModal
        visible={exportModalVisible}
        onClose={() => setExportModalVisible(false)}
        teamId={selectedTeam}
      />
    </Content>
  );
}