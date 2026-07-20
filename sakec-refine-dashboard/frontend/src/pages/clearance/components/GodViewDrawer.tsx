import { useEffect, useState } from 'react';
import { Drawer, Table, Tag, Spin } from 'antd';

interface GodViewDrawerProps {
  visible: boolean;
  onClose: () => void;
  student: any;
  teamId: string | null;
}

import { API_URL } from '../../../config/constants';

export default function GodViewDrawer({ visible, onClose, student, teamId }: GodViewDrawerProps) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (visible && student && teamId) {
      fetchStudentData();
    }
  }, [visible, student, teamId]);

  const fetchStudentData = async () => {
    setLoading(true);
    try {
      const token = sessionStorage.getItem('access_token');

      const res = await fetch(`${API_URL}/dashboard/student-clearance?prn=${student.prn}&teamId=${teamId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      const json = await res.json();
      setData(json);
    } catch (error) {
      console.error("Failed to fetch clearance data:", error);
    }
    setLoading(false);
  };

  const columns = [
    { title: 'Assignment', dataIndex: 'assignment_title', key: 'assignment_title' },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        let color = status === 'Graded' ? 'green' : status === 'Missing' ? 'volcano' : 'blue';
        return <Tag color={color}>{status}</Tag>;
      }
    },
    { title: 'AI Marks', dataIndex: 'ai_suggested_marks', key: 'ai_suggested_marks' },
    { title: 'Final Marks', dataIndex: 'final_marks', key: 'final_marks' },
  ];

  return (
    <Drawer
      title={student ? `${student.name}'s Full Semester Record` : 'Student Record'}
      placement="right"
      width={700}
      onClose={onClose}
      open={visible}
      drawerStyle={{ backgroundColor: '#1f1f1f', color: '#fff' }}
      headerStyle={{ borderBottom: '1px solid #333' }}
    >
      {loading ? (
        <div style={{ textAlign: 'center', marginTop: '50px' }}><Spin size="large" /></div>
      ) : (
        <Table
          dataSource={data}
          columns={columns}
          rowKey="assignment_id"
          pagination={false}
        />
      )}
    </Drawer>
  );
}