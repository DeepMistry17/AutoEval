import { useState, useEffect } from 'react';
import { Typography, Select, Space, Divider, Card, Button, message } from 'antd';
import { SyncOutlined, CloudDownloadOutlined } from '@ant-design/icons';
import { useCustom } from '@refinedev/core';
import { KpiCards } from './components/KpiCards';
import { PendingGradesTable } from './components/PendingGradesTable';
import { AlignmentChart } from './components/AlignmentChart';
import { StudentSummaryTable } from './components/StudentSummaryTable';
import { ReviewModal } from './components/ReviewModal';
import { socket } from '../../utils/socket'; // <-- NEW: Imported the shared socket utility

const { Title } = Typography;
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

interface Assignment {
  title: string;
  assignment_id: string;
  team_id?: string;
}

interface TeamDropdown {
  label: string;
  value: string;
}

export const DashboardPage = () => {
  const [selectedTeam, setSelectedTeam] = useState<string | undefined>();
  const [selectedAssignment, setSelectedAssignment] = useState<string | undefined>();
  
  const [isSyncing, setIsSyncing] = useState(false); 
  const [isSyncingSubmissions, setIsSyncingSubmissions] = useState(false); 
  
  const [reviewRecord, setReviewRecord] = useState<any>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const { query: assignmentsQuery, result: assignmentsResult } = useCustom<Assignment[]>({
    url: selectedTeam ? `/assignments?teamId=${selectedTeam}` : '/assignments',
    method: 'get',
    queryOptions: { enabled: !!selectedTeam }
  });

  const { result: teamsResult } = useCustom<TeamDropdown[]>({
    url: '/teams/dropdown',
    method: 'get',
  });

  const rawAssignments = assignmentsResult?.data as unknown;
  const assignments: Assignment[] = Array.isArray(rawAssignments) ? rawAssignments : [];

  const rawTeams = teamsResult?.data as unknown;
  const teams: TeamDropdown[] = Array.isArray(rawTeams) ? rawTeams : [];

  const handleRefresh = () => setRefreshKey((k) => k + 1);

  // ─── REAL-TIME WEBSOCKET LISTENER ──────────────────────────────
  useEffect(() => {
    // 1. Open the connection
    socket.connect();

    socket.on('connect', () => {
      console.log('🟢 Connected to real-time grading stream. ID:', socket.id);
    });

    // 2. Listen for the exact signal name the backend is broadcasting
    socket.on('refresh_dashboard', () => {
      console.log('⚡ Live refresh signal received from n8n!');
      
      // Show a toast notification to the teacher
      message.success('AI Evaluation Complete! Dashboard updated.');
      
      // Instantly trigger your existing refresh function
      handleRefresh(); 
    });

    // 3. Cleanup on unmount
    return () => {
      socket.off('connect');
      socket.off('refresh_dashboard'); // Make sure to update the cleanup too!
      socket.disconnect();
    };
  }, []);
  // ──────────────────────────────────────────────────────────────────
  const handleSyncAssignments = async () => {
    setIsSyncing(true);
    try {
      const token = sessionStorage.getItem('access_token');
      const payload = selectedTeam ? { teamId: selectedTeam } : {};

      const resp = await fetch(`${API_URL}/assignments/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload) 
      });
      
      if (!resp.ok) throw new Error('Failed to sync assignments');
      const data = await resp.json();
      message.success(`Successfully fetched ${data.count} assignments and ${data.studentsCount} students!`);
      assignmentsQuery.refetch(); 
    } catch {
      message.error('Failed to sync assignments from Microsoft.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSyncSubmissions = async () => {
    if (!selectedAssignment) return;
    setIsSyncingSubmissions(true);
    try {
      const token = sessionStorage.getItem('access_token');
      const resp = await fetch(`${API_URL}/assignments/${selectedAssignment}/sync-submissions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      if (!resp.ok) throw new Error('Failed to sync submissions');
      const data = await resp.json();
      message.success(`Successfully pulled ${data.count} submissions ready for AI evaluation!`);
      handleRefresh(); 
    } catch {
      message.error('Failed to fetch submissions.');
    } finally {
      setIsSyncingSubmissions(false);
    }
  };

  return (
    <div style={{ padding: '0 4px' }}>
      <Card style={{ borderRadius: 12, marginBottom: 20 }} bodyStyle={{ padding: '16px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', flexWrap: 'wrap', gap: '16px' }}>
          <Space size={64} wrap>
            <div>
              <div style={{ fontSize: 13, color: '#64748b', marginBottom: 4, fontWeight: 600 }}>Select Subject / Team</div>
              <Select
                showSearch
                placeholder="Search Teams..."
                allowClear
                style={{ width: 260 }}
                value={selectedTeam}
                onChange={(val) => {
                  setSelectedTeam(val);
                  setSelectedAssignment(undefined);
                }}
                filterOption={(input, option) => (option?.label as string ?? '').toLowerCase().includes(input.toLowerCase())}
                options={teams.map((t: TeamDropdown) => ({ label: t.label, value: t.value }))}
              />
            </div>
            <div>
              <div style={{ fontSize: 13, color: '#64748b', marginBottom: 4, fontWeight: 600 }}>Assignment</div>
              <Select
                showSearch
                placeholder={selectedTeam ? "Search Assignments..." : "Select a Team first"}
                disabled={!selectedTeam}
                allowClear
                style={{ width: 280 }}
                value={selectedAssignment}
                onChange={(val) => setSelectedAssignment(val)}
                filterOption={(input, option) => (option?.label as string ?? '').toLowerCase().includes(input.toLowerCase())}
                options={assignments.map((a: Assignment) => ({ label: a.title, value: a.assignment_id }))}
              />
            </div>
          </Space>

          <Space>
            <Button
              type="primary"
              icon={<SyncOutlined spin={isSyncing} />}
              onClick={handleSyncAssignments}
              loading={isSyncing}
              style={{ borderRadius: 8, background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none', height: '40px' }}
            >
              Update Assignments
            </Button>
            
            <Button
              type="primary"
              icon={<CloudDownloadOutlined />}
              onClick={handleSyncSubmissions}
              loading={isSyncingSubmissions}
              disabled={!selectedAssignment}
              style={{ borderRadius: 8, background: 'linear-gradient(135deg, #f59e0b, #d97706)', border: 'none', height: '40px' }}
            >
              Fetch Submissions
            </Button>
          </Space>
        </div>
      </Card>

      <div key={`kpi-${refreshKey}`}><KpiCards assignmentId={selectedAssignment} /></div>
      <Divider />
      
      <Card title={<Title level={5} style={{ margin: 0 }}>Submissions Needing Review</Title>} style={{ borderRadius: 12, marginBottom: 20 }} bodyStyle={{ padding: '0 0 8px' }}>
        <div key={`grades-${refreshKey}`}>
          <PendingGradesTable assignmentId={selectedAssignment} onReview={setReviewRecord} onRefresh={handleRefresh} />
        </div>
      </Card>

      <div style={{ marginBottom: 20 }} key={`chart-${refreshKey}`}><AlignmentChart assignmentId={selectedAssignment} /></div>
      
      <Card title={<Title level={5} style={{ margin: 0 }}>Student Summary</Title>} style={{ borderRadius: 12, marginBottom: 20 }} bodyStyle={{ padding: '0 0 8px' }}>
        <div key={`summary-${refreshKey}`}>
          <StudentSummaryTable assignmentId={selectedAssignment} />
        </div>
      </Card>

      <ReviewModal open={!!reviewRecord} record={reviewRecord} onClose={() => setReviewRecord(null)} />
    </div>
  );
};