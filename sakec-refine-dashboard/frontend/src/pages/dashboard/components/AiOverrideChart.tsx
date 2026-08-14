import { Card, Spin, Empty } from 'antd';
import { Pie } from '@ant-design/charts';
import { useCustom } from '@refinedev/core';

interface OverrideData {
  accepted: string;
  overridden: string;
}

interface Props {
  assignmentId?: string;
}

export const AiOverrideChart = ({ assignmentId }: Props) => {
  const { query, result } = useCustom<OverrideData>({
    url: assignmentId ? `/dashboard/ai-override?assignmentId=${assignmentId}` : '/dashboard/ai-override',
    method: 'get',
    queryOptions: {
      queryKey: ['ai-override', assignmentId],
      // FIX: Prevents the API call from firing before an assignment is selected
      enabled: !!assignmentId, 
    },
  });

  // FIX: Shows the empty state matching the other charts when no assignment is selected
  if (!assignmentId) {
    return (
      <Card title="AI Grade Acceptance" style={{ borderRadius: 12, background: '#141414', borderColor: '#262626' }}>
        <div style={{ padding: '60px 0' }}>
          <Empty description="Select an assignment to view override data" />
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

  const data = result?.data as unknown as OverrideData;
  const acceptedCount = parseInt(data?.accepted || '0', 10);
  const overriddenCount = parseInt(data?.overridden || '0', 10);

  if (acceptedCount === 0 && overriddenCount === 0) {
    return (
      <Card title="AI Grade Acceptance" style={{ borderRadius: 12, background: '#141414', borderColor: '#262626' }}>
        <Empty description="No graded submissions to analyze yet" />
      </Card>
    );
  }

  // Formatting data for the Pie chart
  const chartData = [
    { type: 'Accepted', count: acceptedCount },
    { type: 'Overridden', count: overriddenCount },
  ].filter(d => d.count > 0); // Hide empty slices

  const config = {
    appendPadding: 10,
    data: chartData,
    angleField: 'count',
    colorField: 'type',
    radius: 0.85,
    theme: 'dark',
    color: (datum: any) => {
        if (datum.type === 'Accepted') return '#3b82f6'; // Match the Blue KPI
        return '#f59e0b'; // Match the Yellow Needs Review KPI
    },
    label: {
        type: 'inner',
        offset: '-30%',
        content: ({ percent }: any) => `${(percent * 100).toFixed(0)}%`,
        style: {
            fontSize: 14,
            textAlign: 'center',
            fontWeight: 'bold',
            fill: '#ffffff',
            textShadow: '0px 2px 4px rgba(0,0,0,0.8)'
        },
    },
    legend: {
        position: 'bottom' as const,
        itemName: { style: { fill: '#d4d4d4' } },
    },
    interactions: [{ type: 'element-active' }],
  };

  return (
    <Card
      title="AI Grade Acceptance"
      style={{ borderRadius: 12, background: '#141414', borderColor: '#262626' }}
      bodyStyle={{ padding: '16px 24px' }}
    >
      <Pie {...config} height={260} />
    </Card>
  );
};