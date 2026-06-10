import { Table, Button, InputNumber, message, Tag, Empty } from 'antd';
import { EyeOutlined, SaveOutlined } from '@ant-design/icons';
import { useCustom } from '@refinedev/core';
import { useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

interface PendingGrade {
  submission_id: number;
  roll_no: number;
  full_name: string;
  assignment_title: string;
  ai_suggested_marks: number;
  ai_feedback: string;
  final_marks: number | null;
  status: string;
  file_path: string;
}

interface Props {
  assignmentId?: string;
  onReview: (record: PendingGrade) => void;
  onRefresh: () => void;
}

export const PendingGradesTable = ({ assignmentId, onReview, onRefresh }: Props) => {
  const [editedMarks, setEditedMarks] = useState<Record<number, number>>({});
  const [savingId, setSavingId] = useState<number | null>(null);

  const { query, result } = useCustom<PendingGrade[]>({
    url: assignmentId ? `/dashboard/pending-grades?assignmentId=${assignmentId}` : '/dashboard/pending-grades',
    method: 'get',
    queryOptions: {
      queryKey: ['pending-grades', assignmentId],
    },
  });

  // CHANGED: We now pass the entire record so we can grab the AI mark if needed
  const handleSave = async (record: PendingGrade) => {
    // Determine what to save: The typed mark -> The DB Mark -> The AI Mark
    const marksToSave = editedMarks[record.submission_id] ?? record.final_marks ?? record.ai_suggested_marks;

    setSavingId(record.submission_id);
    try {
      const token = sessionStorage.getItem('access_token');
      const resp = await fetch(`${API_URL}/submissions/${record.submission_id}/sync`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ finalMarks: marksToSave }),
      });

      if (!resp.ok) throw new Error('Failed to sync');
      message.success('Marks synced successfully');
      
      setEditedMarks((prev) => {
        const copy = { ...prev };
        delete copy[record.submission_id];
        return copy;
      });
      query.refetch();
      onRefresh();
    } catch {
      message.error('Failed to save marks');
    } finally {
      setSavingId(null);
    }
  };

  const rawData = result?.data as unknown;
  const rows: PendingGrade[] = Array.isArray(rawData) ? rawData : [];

  const columns = [
    {
      title: 'Roll.no',
      dataIndex: 'roll_no', 
      key: 'roll_no',
      width: 80,
      align: 'center' as const,
    },
    {
      title: 'Student',
      dataIndex: 'full_name',
      key: 'full_name',
      width: 150,
    },
    {
      title: 'Assignment',
      dataIndex: 'assignment_title',
      key: 'assignment_title',
      width: 160,
    },
    {
      title: 'AI Marks',
      dataIndex: 'ai_suggested_marks',
      key: 'ai_suggested_marks',
      width: 100,
      align: 'center' as const,
      render: (val: number) => (
        <Tag color="gold" style={{ fontWeight: 600 }}>
          {val}
        </Tag>
      ),
    },
    {
      title: 'Final Marks',
      dataIndex: 'final_marks',
      key: 'final_marks',
      width: 130,
      align: 'center' as const,
      render: (val: number | null, record: PendingGrade) => {
        // THE MAGIC TRICK: Default to AI Marks if 'val' is null!
        const currentVal = editedMarks[record.submission_id] ?? val ?? record.ai_suggested_marks;
        const diff = Math.abs(record.ai_suggested_marks - currentVal);
        
        return (
          <InputNumber
            min={0}
            max={10}
            value={currentVal}
            onChange={(v) =>
              setEditedMarks((prev) => ({
                ...prev,
                [record.submission_id]: v as number,
              }))
            }
            style={{
              width: 80,
              backgroundColor: diff > 2 ? '#450a0a' : undefined,
              borderColor: diff > 2 ? '#ef4444' : undefined,
            }}
          />
        );
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      align: 'center' as const,
      render: (val: string) => {
        const colorMap: Record<string, string> = {
          Graded: 'orange',
          Synced: 'blue',
          Pending: 'default',
        };
        return <Tag color={colorMap[val] || 'default'}>{val}</Tag>;
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 160,
      align: 'center' as const,
      render: (_: unknown, record: PendingGrade) => {
        const isEdited = editedMarks[record.submission_id] !== undefined;
        const isPendingSave = record.final_marks === null; // Needs its first save
        
        return (
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <Button
              type="primary"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => onReview(record)}
            >
              Review
            </Button>
            <Button
              type="primary"
              size="small"
              icon={<SaveOutlined />}
              style={{ background: '#15803d', borderColor: '#15803d' }}
              loading={savingId === record.submission_id}
              // It is disabled ONLY if they haven't typed anything AND it's already synced to the DB
              disabled={!isEdited && !isPendingSave}
              onClick={() => handleSave(record)}
            >
              Save
            </Button>
          </div>
        );
      },
    },
  ];

  if (!assignmentId) {
    return (
      <div style={{ padding: '60px 0' }}>
        <Empty description="Select an assignment to view submissions needing review" />
      </div>
    );
  }

  return (
    <Table
      dataSource={rows}
      columns={columns}
      rowKey="submission_id"
      loading={query.isLoading}
      pagination={{ defaultPageSize: 15, showSizeChanger: true, style: { paddingRight: '24px' } }}
      scroll={{ x: 1100 }}
      size="middle"
      style={{ borderRadius: 12, overflow: 'hidden' }}
    />
  );
};