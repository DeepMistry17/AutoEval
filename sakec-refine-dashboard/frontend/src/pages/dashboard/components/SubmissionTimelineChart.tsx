import { Card, Spin, Empty } from 'antd';
import { Column } from '@ant-design/charts';
import { useCustom } from '@refinedev/core';

interface ComplianceData {
  on_time: string;
  late: string;
  missing: string;
}

interface Props {
  assignmentId?: string;
}

export const SubmissionTimelineChart = ({ assignmentId }: Props) => {
  const { query, result } = useCustom<ComplianceData>({
    url: assignmentId ? `/dashboard/submission-timeline?assignmentId=${assignmentId}` : '/dashboard/submission-timeline',
    method: 'get',
    queryOptions: {
      queryKey: ['submission-timeline', assignmentId],
      enabled: !!assignmentId,
    },
  });

  if (!assignmentId) {
    return (
      <Card title="Submission Tracker" style={{ borderRadius: 12, background: '#141414', borderColor: '#262626' }}>
        <div style={{ padding: '60px 0' }}>
          <Empty description="Select an assignment to view timeline" />
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

  const data = result?.data as unknown as ComplianceData;
  const onTime = parseInt(data?.on_time || '0', 10);
  const late = parseInt(data?.late || '0', 10);
  const missing = parseInt(data?.missing || '0', 10);

  if (onTime === 0 && late === 0 && missing === 0) {
    return (
      <Card title="Submission Tracker" style={{ borderRadius: 12, background: '#141414', borderColor: '#262626' }}>
        <div style={{ padding: '60px 0' }}>
          <Empty description="No roster data available" />
        </div>
      </Card>
    );
  }

  // Format data for individual side-by-side columns
  const chartData = [
    { type: 'On Time', count: onTime },
    { type: 'Late', count: late },
    { type: 'Missing', count: missing },
  ].filter(d => d.count > 0); // Hide empty segments

  const config = {
    data: chartData,
    xField: 'type',   // This places "On Time", "Late", "Missing" directly on the X-axis
    yField: 'count',
    colorField: 'type',
    theme: 'dark',
    columnStyle: { radius: [4, 4, 0, 0] as [number, number, number, number] },
    
    // Explicit color mapping so it doesn't break if a category is missing
    color: (datum: any) => {
      if (datum.type === 'On Time') return '#10b981'; // Green
      if (datum.type === 'Late') return '#f59e0b';    // Orange
      return '#dc2626';                               // Red for Missing
    },
    
    legend: false, // Turned off since the X-axis labels now tell us what the colors mean
    
    label: {
      position: 'top' as const,
      style: { fill: '#ffffff', fontWeight: 600 },
      offsetY: 8,
    },
    xAxis: {
      label: { style: { fill: '#a3a3a3', fontSize: 12 } }, // Turned labels back on
      grid: null,
      line: { style: { stroke: '#737373' } },
    },
    yAxis: {
      title: { text: 'Students', style: { fill: '#a3a3a3' } },
      label: { style: { fill: '#737373' } },
      grid: { line: { style: { stroke: '#262626', lineDash: [4, 4] } } },
      line: { style: { stroke: '#737373' } },
    },
  };

  return (
    <Card
      title="Submission Tracker"
      style={{ borderRadius: 12, background: '#141414', borderColor: '#262626' }}
      bodyStyle={{ padding: '16px 24px' }}
    >
      <Column {...config} height={260} />
    </Card>
  );
};