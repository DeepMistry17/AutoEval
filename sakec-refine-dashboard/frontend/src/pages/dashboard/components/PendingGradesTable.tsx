import { Table, Button, Tag, Empty } from 'antd';
import { EyeOutlined } from '@ant-design/icons';
import { useCustom } from '@refinedev/core';

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

export const PendingGradesTable = ({ assignmentId, onReview }: Props) => {

  const { query, result } = useCustom<PendingGrade[]>({
    url: assignmentId ? `/dashboard/pending-grades?assignmentId=${assignmentId}` : '/dashboard/pending-grades',
    method: 'get',
    queryOptions: {
      queryKey: ['pending-grades', assignmentId],
    },
  });

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
        const displayMark = val ?? record.ai_suggested_marks;
        return <span style={{ fontWeight: 600 }}>{displayMark}</span>;
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
      width: 100,
      align: 'center' as const,
      render: (_: unknown, record: PendingGrade) => (
        <Button
          type="primary"
          size="small"
          icon={<EyeOutlined />}
          onClick={() => onReview(record)}
        >
          Review
        </Button>
      ),
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