import { Card, Statistic, Row, Col, Spin } from 'antd';
import {
  ClockCircleOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  SyncOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { useCustom } from '@refinedev/core';

interface KpiData {
  pending: number;
  synced: number;
  overdue: number;
  awaiting: number;
  processing: number;
}

interface Props {
  assignmentId?: string;
}

export const KpiCards = ({ assignmentId }: Props) => {
  const { query, result } = useCustom<KpiData>({
    url: assignmentId ? `/dashboard/kpis?assignmentId=${assignmentId}` : '/dashboard/kpis',
    method: 'get',
    queryOptions: {
      queryKey: ['kpis', assignmentId],
      enabled: !!assignmentId,
    },
  });

  if (query.isLoading && assignmentId) {
    return (
      <Row gutter={[16, 16]}>
        {[1, 2, 3, 4, 5].map((i) => (
          <Col xs={24} sm={12} flex="1 1 200px" key={i}>
            <Card style={{ borderRadius: 12 }}>
              <Spin />
            </Card>
          </Col>
        ))}
      </Row>
    );
  }

  const kpis = result?.data as unknown as KpiData | undefined;

  const displayAwaiting = assignmentId ? (kpis?.awaiting || 0) : '-';
  const displayProcessing = assignmentId ? (kpis?.processing || 0) : '-';
  const displayPending = assignmentId ? (kpis?.pending || 0) : '-';
  const displayOverdue = assignmentId ? (kpis?.overdue || 0) : '-';
  const displayCompleted = assignmentId ? (kpis?.synced || 0) : '-';

  // Array sorted in your requested specific order
  const cards = [
    {
      title: 'Not Submitted',
      value: displayOverdue,
      icon: <ExclamationCircleOutlined />,
      color: '#dc2626', // Deeper red
      bg: 'linear-gradient(135deg, #fecaca, #fca5a5)', // Richer red gradient
    },
    {
      title: 'Pending AI evaluation',
      value: displayAwaiting,
      icon: <SyncOutlined />,
      color: '#3b82f6', // Classic blue
      bg: 'linear-gradient(135deg, #dbeafe, #bfdbfe)',
    },
    {
      title: 'Processing',
      value: displayProcessing,
      icon: <SettingOutlined spin />,
      color: '#ec4899', // Vibrant pink
      bg: 'linear-gradient(135deg, #fce7f3, #fbcfe8)', // Pastel pink gradient
    },
    {
      title: 'Needs Review',
      value: displayPending,
      icon: <ClockCircleOutlined />,
      color: '#f59e0b', // Warm yellow
      bg: 'linear-gradient(135deg, #fef3c7, #fde68a)',
    },
    {
      title: 'Completed',
      value: displayCompleted,
      icon: <CheckCircleOutlined />,
      color: '#10b981', // Emerald green
      bg: 'linear-gradient(135deg, #d1fae5, #a7f3d0)',
    },
  ];

  return (
    <Row gutter={[16, 16]}>
      {cards.map((card) => (
        <Col xs={24} sm={12} flex="1 1 200px" key={card.title}>
          <Card
            style={{
              borderRadius: 12,
              background: card.bg,
              border: 'none',
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
              opacity: assignmentId ? 1 : 0.6,
              transition: 'opacity 0.3s ease',
            }}
            bodyStyle={{ padding: '20px 24px' }}
          >
            <Statistic
              title={
                <span style={{ color: '#475569', fontWeight: 600 }}>
                  {card.title}
                </span>
              }
              value={card.value}
              prefix={
                <span style={{ color: card.color, fontSize: 22 }}>
                  {card.icon}
                </span>
              }
              valueStyle={{
                color: '#0f172a',
                fontWeight: 700,
                fontSize: 28,
              }}
            />
          </Card>
        </Col>
      ))}
    </Row>
  );
};