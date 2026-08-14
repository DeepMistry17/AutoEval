import { Card, Spin, Empty, Progress } from 'antd';
import { useCustom } from '@refinedev/core';

interface AlertData {
  linked: string;
  total: string;
}

interface Props {
  assignmentId?: string;
}

export const AlertReadinessChart = ({ assignmentId }: Props) => {
  const { query, result } = useCustom<AlertData>({
    url: assignmentId ? `/dashboard/alert-readiness?assignmentId=${assignmentId}` : '/dashboard/alert-readiness',
    method: 'get',
    queryOptions: {
      queryKey: ['alert-readiness', assignmentId],
      enabled: !!assignmentId,
    },
  });

  if (!assignmentId) {
    return (
      <Card title="Student linked with Telegram" style={{ borderRadius: 12, background: '#141414', borderColor: '#262626' }}>
        <div style={{ padding: '60px 0' }}>
          <Empty description="Select an assignment" />
        </div>
      </Card>
    );
  }

  if (query.isLoading) {
    return (
      <Card style={{ borderRadius: 12, height: 260, background: '#141414', borderColor: '#262626' }}>
        <Spin style={{ display: 'flex', justifyContent: 'center', paddingTop: 100 }} />
      </Card>
    );
  }

  const data = result?.data as unknown as AlertData;
  const linked = parseInt(data?.linked || '0', 10);
  const total = parseInt(data?.total || '0', 10);

  if (total === 0) {
    return (
      <Card title="Student linked with Telegram" style={{ borderRadius: 12, background: '#141414', borderColor: '#262626' }}>
        <div style={{ padding: '60px 0' }}>
          <Empty description="No roster data" />
        </div>
      </Card>
    );
  }

  const percent = (linked / total) * 100;
  
  // Dynamic colors: Red (<50%), Orange (50-80%), Green (>80%)
  const gaugeColor = percent < 50 ? '#dc2626' : percent < 80 ? '#f59e0b' : '#10b981';

  return (
    <Card
      title="Student linked with Telegram"
      style={{ borderRadius: 12, background: '#141414', borderColor: '#262626' }}
      bodyStyle={{ padding: '16px 24px' }}
    >
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 260 }}>
        <Progress
          type="dashboard"
          percent={Math.round(percent)}
          strokeColor={gaugeColor}
          trailColor="#262626"
          size={200}
          strokeWidth={10}
          format={() => (
            <div style={{ display: 'flex', flexDirection: 'column', marginTop: -15 }}>
              <span style={{ fontSize: 24, fontWeight: 'bold', color: '#ffffff' }}>{linked} / {total}</span>
              <span style={{ fontSize: 13, color: '#a3a3a3', marginTop: 4 }}>Linked</span>
            </div>
          )}
        />
      </div>
    </Card>
  );
};