import { Card, Spin, Empty } from 'antd';
import { Column } from '@ant-design/charts';
import { useCustom } from '@refinedev/core';

interface AlignmentRow {
  assignment: string;
  avg_ai: number;
  avg_teacher: number;
}

interface Props {
  assignmentId?: string;
}

export const AlignmentChart = ({ assignmentId }: Props) => {
  const { query, result } = useCustom<AlignmentRow[]>({
    url: assignmentId ? `/dashboard/alignment?assignmentId=${assignmentId}` : '/dashboard/alignment',
    method: 'get',
    queryOptions: {
      queryKey: ['alignment', assignmentId],
      enabled: !!assignmentId,
    },
  });

  if (!assignmentId) {
    return (
      <Card title="AI vs Teacher: Grading Alignment" style={{ borderRadius: 12, background: '#141414', borderColor: '#262626' }}>
        <div style={{ padding: '60px 0' }}>
          <Empty description="Select an assignment to view alignment data" />
        </div>
      </Card>
    );
  }

  if (query.isLoading) {
    return (
      <Card style={{ borderRadius: 12, height: 320, background: '#141414', borderColor: '#262626' }}>
        <Spin style={{ display: 'flex', justifyContent: 'center', paddingTop: 120 }} />
      </Card>
    );
  }

  const rawData = result?.data as unknown;
  const rows: AlignmentRow[] = Array.isArray(rawData) ? rawData : [];

  if (rows.length === 0) {
    return (
      <Card title="AI vs Teacher: Grading Alignment" style={{ borderRadius: 12, background: '#141414', borderColor: '#262626' }}>
        <Empty description="No graded data available yet" />
      </Card>
    );
  }

  const chartData = rows.flatMap((row) => [
    {
      assignment: row.assignment,
      type: 'AI Average',
      value: parseFloat(String(row.avg_ai)) || 0,
    },
    {
      assignment: row.assignment,
      type: 'Teacher Average',
      value: parseFloat(String(row.avg_teacher)) || 0,
    },
  ]);

 const config = {
    data: chartData,
    xField: 'assignment',
    yField: 'value',
    seriesField: 'type',
    colorField: 'type',
    isGroup: true,

    // THE NUCLEAR OVERRIDE (Raw Array)
    color: ['#0ea5e9', '#ff5a1f'],

    // // THE FIRE & ICE OVERRIDE (Forced Function)
    // color: (datum: { type: string }) => {
    //   if (datum.type === 'AI Average') {
    //     return '#0ea5e9'; // Bright Azure Blue
    //   }
    //   return '#ff5a1f'; // Blazing Neon Orange
    // },
    
    columnStyle: { radius: [4, 4, 0, 0] as [number, number, number, number] },
    theme: 'dark',
    label: {
      position: 'top' as const,
      style: { fill: '#e5e5e5', fontSize: 12, fontWeight: 600 },
      offsetY: 8,
    },
    xAxis: {
      label: { autoRotate: true, style: { fill: '#a3a3a3', fontSize: 11 } },
      line: { style: { stroke: '#737373' } },
    },
    yAxis: {
      title: { text: 'Average Marks', style: { fill: '#a3a3a3' } },
      label: { style: { fill: '#737373' } },
      grid: { line: { style: { stroke: '#262626', lineDash: [4, 4] } } },
      line: { style: { stroke: '#737373' } },
    },
    legend: {
      position: 'top-left' as const,
      itemName: { style: { fill: '#d4d4d4' } },
    },
  };

  return (
    <Card
      title="AI vs Teacher: Grading Alignment"
      style={{ borderRadius: 12, background: '#141414', borderColor: '#262626' }}
      bodyStyle={{ padding: '16px 24px' }}
    >
      <Column {...config} height={260} />
    </Card>
  );
};