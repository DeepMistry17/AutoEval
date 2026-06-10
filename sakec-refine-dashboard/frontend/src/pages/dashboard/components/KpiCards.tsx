import { Card, Statistic, Row, Col, Spin } from 'antd';
import {
  ClockCircleOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import { useCustom } from '@refinedev/core';

interface KpiData {
  pending: number;
  synced: number;
  overdue: number;
  awaiting: number;
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
        {[1, 2, 3, 4].map((i) => (
          <Col xs={24} sm={12} md={6} key={i}>
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
  const displayPending = assignmentId ? (kpis?.pending || 0) : '-';
  const displayOverdue = assignmentId ? (kpis?.overdue || 0) : '-';
  const displayCompleted = assignmentId ? (kpis?.synced || 0) : '-';

  const cards = [
    {
      title: 'Awaiting AI',
      value: displayAwaiting,
      icon: <SyncOutlined />,
      color: '#3b82f6',
      bg: 'linear-gradient(135deg, #dbeafe, #bfdbfe)',
    },
    {
      title: 'Needs Review',
      value: displayPending,
      icon: <ClockCircleOutlined />,
      color: '#f59e0b',
      bg: 'linear-gradient(135deg, #fef3c7, #fde68a)',
    },
    {
      title: 'Not Submitted',
      value: displayOverdue,
      icon: <ExclamationCircleOutlined />,
      color: '#ef4444',
      bg: 'linear-gradient(135deg, #fee2e2, #fecaca)',
    },
    {
      title: 'Completed',
      value: displayCompleted,
      icon: <CheckCircleOutlined />,
      color: '#10b981',
      bg: 'linear-gradient(135deg, #d1fae5, #a7f3d0)',
    },
  ];

  return (
    <Row gutter={[16, 16]}>
      {cards.map((card) => (
        // Adjusted the Col size to sm={12} md={6} so 4 cards fit evenly
        <Col xs={24} sm={12} md={6} key={card.title}>
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