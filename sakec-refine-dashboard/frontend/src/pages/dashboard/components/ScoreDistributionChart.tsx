import { Card, Spin, Empty } from 'antd';
import { Pie } from '@ant-design/charts';
import { useCustom } from '@refinedev/core';

interface StudentRow {
    ai_suggested_marks: number | null;
    final_marks: number | null;
}

interface Props {
    assignmentId?: string;
}

export const ScoreDistributionChart = ({ assignmentId }: Props) => {
    const { query, result } = useCustom<StudentRow[]>({
        url: assignmentId ? `/dashboard/student-summary?assignmentId=${assignmentId}` : '/dashboard/student-summary',
        method: 'get',
        queryOptions: {
            queryKey: ['score-distribution', assignmentId],
            enabled: !!assignmentId,
        },
    });

    if (!assignmentId) {
        return (
            <Card title="Class Performance" style={{ borderRadius: 12, background: '#141414', borderColor: '#262626' }}>
                <div style={{ padding: '60px 0' }}>
                    <Empty description="Select an assignment to view distribution data" />
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
    const rows: StudentRow[] = Array.isArray(rawData) ? rawData : [];

    // Calculate Buckets
    const brackets = {
        '0-25%': 0,
        '26-50%': 0,
        '51-75%': 0,
        '76-100%': 0,
    };

    rows.forEach((row) => {
        const marks = row.final_marks ?? row.ai_suggested_marks ?? null;
        if (marks === null) return;

        const max = 10;
        const percentage = (marks / max) * 100;

        if (percentage <= 25) brackets['0-25%']++;
        else if (percentage <= 50) brackets['26-50%']++;
        else if (percentage <= 75) brackets['51-75%']++;
        else brackets['76-100%']++;
    });

    const chartData = Object.entries(brackets)
        .map(([bracket, count]) => ({ bracket, count }))
        .filter(data => data.count > 0);

    // FIX: Catch empty chart data (when students exist but aren't graded yet) to fix layout sizing
    if (chartData.length === 0) {
        return (
            <Card title="Class Performance" style={{ borderRadius: 12, background: '#141414', borderColor: '#262626' }}>
                <div style={{ padding: '60px 0' }}>
                    <Empty description="No graded data available yet" />
                </div>
            </Card>
        );
    }

    const config = {
        appendPadding: 10,
        data: chartData,
        angleField: 'count',
        colorField: 'bracket',
        radius: 0.85,
        theme: 'dark',
        color: (datum: any) => {
            if (datum.bracket === '0-25%') return '#ef4444';
            if (datum.bracket === '26-50%') return '#f59e0b';
            if (datum.bracket === '51-75%') return '#3b82f6';
            return '#10b981';
        },
        label: {
            type: 'inner',
            offset: '-30%',
            content: ({ percent }: any) => `${(percent * 100).toFixed(0)}%`,
            style: { fontSize: 14, textAlign: 'center', fontWeight: 'bold', fill: '#ffffff', textShadow: '0px 2px 4px rgba(0,0,0,0.8)' },
        },
        legend: { position: 'bottom' as const, itemName: { style: { fill: '#d4d4d4' } } },
        interactions: [{ type: 'element-active' }],
    };

    return (
        <Card
            title="Class Performance"
            style={{ borderRadius: 12, background: '#141414', borderColor: '#262626' }}
            bodyStyle={{ padding: '16px 24px' }}
        >
            <Pie {...config} height={260} />
        </Card>
    );
};