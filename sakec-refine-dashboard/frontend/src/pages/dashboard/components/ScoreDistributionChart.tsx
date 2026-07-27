import { Card, Spin, Empty } from 'antd';
import { Column } from '@ant-design/charts';
import { useCustom } from '@refinedev/core';

interface StudentRow {
    ai_suggested_marks: number | null;
    final_marks: number | null;
}

interface Props {
    assignmentId?: string;
}

export const ScoreDistributionChart = ({ assignmentId }: Props) => {
    // Using the exact endpoint from StudentSummaryTable
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
            <Card title="Score Distribution" style={{ borderRadius: 12, background: '#141414', borderColor: '#262626' }}>
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

    if (rows.length === 0) {
        return (
            <Card title="Score Distribution" style={{ borderRadius: 12, background: '#141414', borderColor: '#262626' }}>
                <Empty description="No graded data available yet" />
            </Card>
        );
    }

    // Calculate Buckets
    const brackets = {
        '0-25%': 0,
        '26-50%': 0,
        '51-75%': 0,
        '76-100%': 0,
    };

    rows.forEach((row) => {
        // Prefer final_marks, fallback to ai_suggested_marks
        const marks = row.final_marks ?? row.ai_suggested_marks ?? null;

        // Skip students who haven't been graded yet
        if (marks === null) return;

        // Assuming a max score of 10 based on your dashboard screenshot
        const max = 10;

        const percentage = (marks / max) * 100;

        if (percentage <= 25) brackets['0-25%']++;
        else if (percentage <= 50) brackets['26-50%']++;
        else if (percentage <= 75) brackets['51-75%']++;
        else brackets['76-100%']++;
    });

    const chartData = Object.entries(brackets).map(([bracket, count]) => ({
        bracket,
        count,
    }));

    const config = {
        data: chartData,
        xField: 'bracket',
        yField: 'count',
        color: '#8b5cf6', // Distinct purple color for the bell curve bars
        columnStyle: { radius: [4, 4, 0, 0] as [number, number, number, number] },
        theme: 'dark',
        label: {
            position: 'top' as const,
            style: { fill: '#e5e5e5', fontSize: 12, fontWeight: 600 },
            offsetY: 8,
        },
        xAxis: {
            label: { style: { fill: '#a3a3a3', fontSize: 11 } },
            line: { style: { stroke: '#737373' } },
        },
        yAxis: {
            title: { text: 'Number of Students', style: { fill: '#a3a3a3' } },
            label: { style: { fill: '#737373' } },
            grid: { line: { style: { stroke: '#262626', lineDash: [4, 4] } } },
            line: { style: { stroke: '#737373' } },
        },
    };

    return (
        <Card
            title="Score Distribution"
            style={{ borderRadius: 12, background: '#141414', borderColor: '#262626' }}
            bodyStyle={{ padding: '16px 24px' }}
        >
            <Column {...config} height={260} />
        </Card>
    );
};