import { useState, useEffect, useRef } from 'react';
import { Typography, Select, Space, Divider, Card, Button, message, Row, Col } from 'antd';
import { SyncOutlined, FileExcelOutlined } from '@ant-design/icons';
import { useCustom } from '@refinedev/core';
import { KpiCards } from './components/KpiCards';
import { PendingGradesTable } from './components/PendingGradesTable';
import { AlignmentChart } from './components/AlignmentChart';
import { ScoreDistributionChart } from './components/ScoreDistributionChart';
import { StudentSummaryTable } from './components/StudentSummaryTable';
import { ReviewModal } from './components/ReviewModal';
import { socket } from '../../utils/socket';
import { API_URL } from '../../config/constants';

const { Title } = Typography;

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

  const [isForceSyncing, setIsForceSyncing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  const [reviewRecord, setReviewRecord] = useState<any>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refreshTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  // ─── SILENT REFRESH LISTENER ──────────────────────────────────────────────
  useEffect(() => {
    const handleSilentRefresh = (payload?: { table?: string; action?: string }) => {
      if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);

      refreshTimeoutRef.current = setTimeout(() => {
        if (payload?.table === 'assignments') {
          assignmentsQuery.refetch();
        }
        handleRefresh();
      }, 1500);
    };

    socket.on('refresh_dashboard', handleSilentRefresh);

    return () => {
      socket.off('refresh_dashboard', handleSilentRefresh);
      if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
    };
  }, []);
  // ──────────────────────────────────────────────────────────────────────────

  const formatLastSynced = (date: Date | null): string => {
    if (!date) return 'Never synced';
    const diffMs = Date.now() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 10) return 'Last synced: just now';
    if (diffSec < 60) return `Last synced: ${diffSec}s ago`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `Last synced: ${diffMin} min${diffMin > 1 ? 's' : ''} ago`;
    const diffHr = Math.floor(diffMin / 60);
    return `Last synced: ${diffHr} hr${diffHr > 1 ? 's' : ''} ago`;
  };

  const handleForceSync = async () => {
    setIsForceSyncing(true);
    try {
      const token = sessionStorage.getItem('access_token');
      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      };

      const payload = selectedTeam ? { teamId: selectedTeam } : {};
      const assignResp = await fetch(`${API_URL}/assignments/sync`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });
      if (!assignResp.ok) throw new Error('Failed to sync assignments');
      await assignResp.json();
      assignmentsQuery.refetch();

      if (selectedAssignment) {
        const subResp = await fetch(
          `${API_URL}/assignments/${selectedAssignment}/sync-submissions`,
          { method: 'POST', headers },
        );
        if (!subResp.ok) throw new Error('Failed to sync submissions');
      }

      setLastSyncedAt(new Date());
      handleRefresh();
    } catch {
      message.error('Force sync failed. Please try again.');
    } finally {
      setIsForceSyncing(false);
    }
  };

  const handleExportGrades = async () => {
    if (!selectedAssignment) return;
    setIsExporting(true);
    try {
      const token = sessionStorage.getItem('access_token');
      const response = await fetch(`${API_URL}/assignments/${selectedAssignment}/export`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to export data');
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;

      const disposition = response.headers.get('Content-Disposition');
      let filename = 'Grades_Export.xlsx';
      if (disposition && disposition.indexOf('filename=') !== -1) {
        const matches = /filename="([^"]+)"/.exec(disposition);
        if (matches != null && matches[1]) filename = matches[1];
      }

      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);

      message.success('Excel file downloaded successfully!');
    } catch (error: any) {
      message.error(error.message || 'Failed to export grades.');
    } finally {
      setIsExporting(false);
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

          <Space size={12} align="center">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Button
                type="default"
                icon={<SyncOutlined spin={isForceSyncing} />}
                onClick={handleForceSync}
                loading={isForceSyncing}
                disabled={!selectedTeam}
                style={{
                  borderRadius: 8,
                  height: '40px',
                  background: '#eaa008',
                  border: '1.5px solid #eaa008',
                  color: '#000000',
                  fontWeight: 500,
                }}
              >
                Manual Sync
              </Button>
              <span
                style={{
                  fontSize: 11,
                  color: '#94a3b8',
                  whiteSpace: 'nowrap',
                  lineHeight: 1.2,
                }}
              >
                {formatLastSynced(lastSyncedAt)}
              </span>
            </div>

            <Button
              type="primary"
              icon={<FileExcelOutlined />}
              onClick={handleExportGrades}
              loading={isExporting}
              disabled={!selectedAssignment}
              style={{ borderRadius: 8, background: 'linear-gradient(135deg, #1d4ed8, #1e40af)', border: 'none', height: '40px' }}
            >
              Export Excel
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

      <Row gutter={16} style={{ marginBottom: 20 }}>
        <Col xs={24} lg={12} key={`chart-${refreshKey}`}>
          <AlignmentChart assignmentId={selectedAssignment} />
        </Col>
        <Col xs={24} lg={12} key={`dist-${refreshKey}`}>
          <ScoreDistributionChart assignmentId={selectedAssignment} />
        </Col>
      </Row>

      <Card title={<Title level={5} style={{ margin: 0 }}>Student Summary</Title>} style={{ borderRadius: 12, marginBottom: 20 }} bodyStyle={{ padding: '0 0 8px' }}>
        <div key={`summary-${refreshKey}`}>
          <StudentSummaryTable assignmentId={selectedAssignment} />
        </div>
      </Card>

      <ReviewModal open={!!reviewRecord} record={reviewRecord} onClose={() => setReviewRecord(null)} onRefresh={handleRefresh} />
    </div>
  );
};