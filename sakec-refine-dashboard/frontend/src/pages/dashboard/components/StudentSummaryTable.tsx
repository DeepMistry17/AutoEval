import { Table, Tag } from 'antd';
import { useCustom } from '@refinedev/core';

interface StudentRow {
  roll_no: string;
  prn?: string; 
  telegram_id?: string; 
  full_name: string;
  submission_time: string | null;
  status: string;
  is_late: boolean | null;
  ai_suggested_marks: number | null;
  final_marks: number | null;
}

interface Props {
  assignmentId?: string;
}

export const StudentSummaryTable = ({ assignmentId }: Props) => {
  const { query, result } = useCustom<StudentRow[]>({
    url: assignmentId ? `/dashboard/student-summary?assignmentId=${assignmentId}` : '/dashboard/student-summary',
    method: 'get',
    queryOptions: {
      queryKey: ['student-summary', assignmentId],
    },
  });

  const rawData = result?.data as unknown;
  const rows: StudentRow[] = Array.isArray(rawData) ? rawData : [];

  const columns = [
    {
      title: 'Roll No.',
      dataIndex: 'roll_no',
      key: 'roll_no',
      width: 100,
      align: 'center' as const,
      render: (val: string | null) => val || '—', 
    },
    {
      title: 'Name',
      dataIndex: 'full_name',
      key: 'full_name',
      render: (text: string, record: any) => {
        return (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ marginRight: '8px' }}>{text}</span>
            
            {!record.telegram_id && ( 
              <Tag color="warning" style={{ margin: 0, whiteSpace: 'nowrap' }}>
                ⚠️ Pending Bot Setup
              </Tag>
            )}
          </div>
        );
      },
    },
    {
      title: 'Submission Time',
      dataIndex: 'submission_time',
      key: 'submission_time',
      width: 180,
      render: (val: string | null) =>
        val
          ? new Date(val).toLocaleString('en-IN', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })
          : '—',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 130,
      align: 'center' as const,
      render: (val: string) => {
        // Using Ant Design native presets to preserve dark mode pastel styling
        const tagColors: Record<string, string> = {
          'Not Submitted': 'red',
          'Pending': 'blue',
          'Processing': 'magenta', // Renders as pink in Ant Design
          'Graded': 'gold',        // Renders as warm yellow
          'Synced': 'green',
        };
        return <Tag color={tagColors[val] || 'default'}>{val}</Tag>;
      },
    },
    {
      title: 'Late?',
      dataIndex: 'is_late',
      key: 'is_late',
      width: 80,
      align: 'center' as const,
      render: (val: boolean | null) =>
        val === true ? <Tag color="red">Yes</Tag> : val === false ? <Tag color="green">No</Tag> : '—',
    },
    {
      title: 'AI Marks',
      dataIndex: 'ai_suggested_marks',
      key: 'ai_suggested_marks',
      width: 100,
      align: 'center' as const,
      render: (val: number | null) => val ?? '—',
    },
    {
      title: 'Final Marks',
      dataIndex: 'final_marks',
      key: 'final_marks',
      width: 100,
      align: 'center' as const,
      render: (val: number | null) => val ?? '—',
    },
  ];

  return (
    <Table
      dataSource={rows}
      columns={columns}
      rowKey={(record, index) => record.roll_no || record.prn || `fallback-row-${index}`}
      loading={query.isLoading}
      pagination={{ defaultPageSize: 15, showSizeChanger: true, style: { paddingRight: '24px' } }}
      scroll={{ x: 900 }}
      size="small"
    />
  );
};