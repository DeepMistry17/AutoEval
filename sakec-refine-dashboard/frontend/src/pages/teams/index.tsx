import React, { useState } from 'react';
import {
  Table,
  Button,
  Card,
  Modal,
  Typography,
  message,
  Space,
  Tag,
} from 'antd';
import {
  SyncOutlined,
  ExclamationCircleOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { useCustom } from '@refinedev/core';

const { Title, Text } = Typography;
import { API_URL } from '../../config/constants';

interface TeamRow {
  Subject: string;
  Semester: string;
  'Academic Year': string;
  'MS Team ID': string;
}

export const TeamsPage = () => {
  const [archiveTarget, setArchiveTarget] = useState<TeamRow | null>(null);

  // States for our new Selective Sync feature
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [previewTeams, setPreviewTeams] = useState<any[]>([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);

  const { query, result } = useCustom<TeamRow[]>({
    url: '/teams',
    method: 'get',
  });

  const rawData = result?.data as unknown;
  const teams: TeamRow[] = Array.isArray(rawData) ? rawData : [];

  // Step 1: Open Modal & Fetch the Preview list
  const handleOpenSyncModal = async () => {
    setIsSyncModalOpen(true);
    setIsPreviewLoading(true);
    try {
      const token = sessionStorage.getItem('access_token');
      const resp = await fetch(`${API_URL}/teams/preview-sync`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) throw new Error('Failed to fetch preview');

      const data = await resp.json();
      setPreviewTeams(data);
      setSelectedRowKeys([]); // Reset selections
    } catch {
      message.error('Failed to load MS Teams preview.');
      setIsSyncModalOpen(false);
    } finally {
      setIsPreviewLoading(false);
    }
  };

  // Step 2: Send the Checked IDs to be permanently saved
  const handleConfirmSync = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('Please select at least one team to sync.');
      return;
    }

    setIsSyncing(true);
    try {
      const token = sessionStorage.getItem('access_token');
      const resp = await fetch(`${API_URL}/teams/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ selectedTeamIds: selectedRowKeys }), // Sending only checked IDs
      });

      if (!resp.ok) throw new Error('Failed to sync teams');

      message.success('Successfully synced selected teams!');
      setIsSyncModalOpen(false);
      query.refetch();
    } catch {
      message.error('Failed to sync teams from Microsoft.');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleArchive = async () => {
    if (!archiveTarget) return;
    try {
      const token = sessionStorage.getItem('access_token');
      const teamId = archiveTarget['MS Team ID'];
      const resp = await fetch(`${API_URL}/teams/${teamId}/archive`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) throw new Error('Failed to archive');
      message.success('Team archived');
      setArchiveTarget(null);
      query.refetch();
    } catch {
      message.error('Failed to archive team');
    }
  };

  const columns = [
    { title: 'Subject / Team Name', dataIndex: 'Subject', key: 'Subject', width: 250 },
    { title: 'Semester', dataIndex: 'Semester', key: 'Semester', width: 150, render: (val: string) => val || <Text type="secondary">Auto-detecting...</Text> },
    { title: 'Academic Year', dataIndex: 'Academic Year', key: 'Academic Year', width: 150, render: (val: string) => val || <Text type="secondary">Auto-detecting...</Text> },
    { title: 'MS Team ID', dataIndex: 'MS Team ID', key: 'MS Team ID', width: 300, render: (val: string) => (<Text copyable style={{ fontSize: 12, fontFamily: 'monospace', color: '#94a3b8' }}>{val}</Text>) },
    {
      title: 'Actions', key: 'actions', width: 120, align: 'center' as const,
      render: (_: unknown, record: TeamRow) => (
        <Button danger size="small" onClick={() => setArchiveTarget(record)}>Archive</Button>
      ),
    },
  ];

  // Columns for the popup modal checklist
  const previewColumns = [
    { title: 'Microsoft Team Name', dataIndex: 'displayName', key: 'displayName' },
  ];

  return (
    <div style={{ padding: '0 4px' }}>
      <Card
        title={
          <Space>
            <TeamOutlined style={{ color: '#3b82f6' }} />
            <Title level={5} style={{ margin: 0 }}>Manage Teams</Title>
          </Space>
        }
        extra={
          <Button
            type="primary"
            icon={<SyncOutlined />}
            onClick={handleOpenSyncModal}
            style={{ borderRadius: 8, background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', border: 'none' }}
          >
            Import Microsoft Teams
          </Button>
        }
        style={{ borderRadius: 12 }}
        bodyStyle={{ padding: 0 }}
      >
        <Table dataSource={teams} columns={columns} rowKey="MS Team ID" loading={query.isLoading} pagination={{ pageSize: 10, style: { paddingRight: '24px' } }} scroll={{ x: 900 }} size="middle" />
      </Card>

      {/* NEW: The Selective Sync Modal */}
      <Modal
        title={
          <Space>
            <SyncOutlined style={{ color: '#3b82f6' }} />
            <span>Select Teams to Import</span>
          </Space>
        }
        open={isSyncModalOpen}
        onCancel={() => setIsSyncModalOpen(false)}
        width={600}
        footer={[
          <Button key="cancel" onClick={() => setIsSyncModalOpen(false)}>Cancel</Button>,
          <Button
            key="submit"
            type="primary"
            loading={isSyncing}
            onClick={handleConfirmSync}
            disabled={selectedRowKeys.length === 0}
            style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', border: 'none' }}
          >
            Import Selected ({selectedRowKeys.length})
          </Button>,
        ]}
      >
        <p style={{ color: '#64748b', marginBottom: 16 }}>
          We found these active classes attached to your Microsoft account. Select the ones you want to track on your dashboard this semester.
        </p>
        <Table
          rowSelection={{
            type: 'checkbox',
            selectedRowKeys,
            onChange: (newSelectedRowKeys) => setSelectedRowKeys(newSelectedRowKeys),
          }}
          dataSource={previewTeams}
          columns={previewColumns}
          rowKey="id" // The MS Graph ID
          loading={isPreviewLoading}
          pagination={false}
          scroll={{ y: 300 }} // Adds a scrollbar if they have dozens of old teams
          size="small"
        />
      </Modal>

      {/* Archive Modal */}
      <Modal
        title={<Space><ExclamationCircleOutlined style={{ color: '#ef4444' }} /><span>Confirm Archive</span></Space>}
        open={!!archiveTarget}
        onCancel={() => setArchiveTarget(null)}
        onOk={handleArchive}
        okText="Archive"
        okButtonProps={{ danger: true }}
      >
        <p>Are you sure you want to archive <Tag color="blue">{archiveTarget?.Subject}</Tag>?</p>
        <p style={{ color: '#64748b', fontSize: 13 }}>This hides it from your active dashboard but does not delete it from MS Teams.</p>
      </Modal>
    </div>
  );
};