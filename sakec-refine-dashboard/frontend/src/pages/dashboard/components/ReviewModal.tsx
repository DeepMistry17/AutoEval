
import { Modal, Typography, Divider, Tag, Spin, Table } from 'antd';
import { useEffect, useState } from 'react';

const { Text } = Typography;
import { API_URL } from '../../../config/constants';

interface SubmissionRecord {
  submission_id: number | string;
  full_name: string;
  assignment_title: string;
  ai_suggested_marks: number;
  ai_feedback: string;
  final_marks: number | null;
  status: string;
  file_path: string;
  local_converted_path?: string; // <-- NEW
}

interface Props {
  open: boolean;
  record: SubmissionRecord | null;
  onClose: () => void;
}

// --- PARSER FUNCTION FOR THE AI MARKS BREAKDOWN ---
const parseFeedback = (rawText: string) => {
  if (!rawText) return { breakdown: [], overall: 'No feedback provided.' };

  const lines = rawText.split('\n');
  const breakdown: any[] = [];
  let overall = '';
  let isOverall = false;

  lines.forEach((line, index) => {
    if (line.includes('Overall Feedback:')) {
      isOverall = true;
      overall = line.replace('Overall Feedback:', '').trim();
      return;
    }
    if (isOverall) {
      overall += '\n' + line;
      return;
    }

    // Regex to match: "- Category (Score/Max): Comment"
    const match = line.match(/-\s*(.*?)\s*\(([\d.]+)\/([\d.]+)\):\s*(.*)/);
    if (match) {
      breakdown.push({
        key: index,
        category: match[1].trim(),
        score: parseFloat(match[2]),
        max: parseFloat(match[3]),
        comment: match[4].trim()
      });
    }
  });

  return { breakdown, overall };
};

export const ReviewModal = ({ open, record, onClose }: Props) => {
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);

  useEffect(() => {
    if (open && record) {
      setIsLoadingPdf(true);
      const token = sessionStorage.getItem('access_token');

      // The Smart Toggle: Decide which route to call
      let fetchUrl = '';
      if (record.local_converted_path) {
        // Option 1: Use the new local Gotenberg PDF
        fetchUrl = `${API_URL}/assignments/local-pdf?filePath=${encodeURIComponent(record.local_converted_path)}`;
      } else if (record.file_path) {
        // Option 2: Fallback to the original MS Graph URL
        fetchUrl = `${API_URL}/assignments/view-file?url=${encodeURIComponent(record.file_path)}`;
      }

      if (fetchUrl) {
        fetch(fetchUrl, {
          headers: { Authorization: `Bearer ${token}` }
        })
          .then((res) => {
            if (!res.ok) throw new Error('Failed to fetch file');
            return res.blob();
          })
          .then((blob) => {
            const objectUrl = URL.createObjectURL(blob);
            setPdfBlobUrl(objectUrl);
            setIsLoadingPdf(false);
          })
          .catch((err) => {
            console.error("Error loading Document:", err);
            setIsLoadingPdf(false);
          });
      } else {
        setIsLoadingPdf(false); // No file path exists at all
      }
    }

    return () => {
      if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl);
      setPdfBlobUrl(null);
    };
  }, [open, record]);

  if (!record) return null;

  const { breakdown, overall } = parseFeedback(record.ai_feedback);

  const columns = [
    {
      title: 'Parameter',
      dataIndex: 'category',
      key: 'category',
      width: '25%',
      render: (text: string) => <Text strong style={{ color: '#e5e5e5' }}>{text}</Text>,
    },
    {
      title: 'Marks',
      key: 'marks',
      width: '15%',
      align: 'center' as const,
      render: (_: any, r: any) => (
        <Tag color={r.score === r.max ? 'green' : r.score < (r.max / 2) ? 'red' : 'orange'}>
          {r.score} / {r.max}
        </Tag>
      ),
    },
    {
      title: 'AI Comment',
      dataIndex: 'comment',
      key: 'comment',
      render: (text: string) => <Text style={{ color: '#d4d4d4' }}>{text}</Text>,
    },
  ];

  return (
    <Modal
      title={<span style={{ color: '#e5e5e5', fontSize: '16px' }}>Reviewing: {record.full_name}</span>}
      open={open}
      onCancel={onClose}
      footer={null}
      width={1100}
      centered
      closeIcon={<span style={{ color: '#a3a3a3', fontSize: '18px' }}>✖</span>}
      styles={{
        // Removed the problematic 'content' tag entirely to fix TS2353
        header: {
          background: 'transparent',
          borderBottom: '1px solid #262626',
          paddingBottom: '16px',
          marginBottom: '16px'
        },
        body: { padding: 0 },
      }}
    >
      <div style={{ padding: '0 8px' }}>
        {/* PDF Viewer with Unsupported File Check */}
        {(!record.file_path && !record.local_converted_path) ? (
          <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a', borderRadius: 8, marginBottom: 16, color: '#737373', border: '1px solid #262626' }}>
            ⚠️ The student clicked 'Turn In' but did not attach any file.
          </div>
        ) : (!record.local_converted_path && record.file_path?.match(/\.(mp4|zip|rar|exe|mp3|wav|avi|mov)$/i)) ? (
          <div style={{ height: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a', borderRadius: 8, marginBottom: 16, color: '#737373', border: '1px solid #262626' }}>
            <span style={{ fontSize: '24px', marginBottom: '8px' }}>📎</span>
            <Text style={{ color: '#a3a3a3' }}>Unsupported File Type</Text>
            <Text type="secondary" style={{ fontSize: '12px', marginTop: '4px' }}>This file cannot be previewed. Please download it directly from MS Teams.</Text>
          </div>
        ) : (
          <div style={{ borderRadius: 8, overflow: 'hidden', border: '1px solid #262626', marginBottom: 16, minHeight: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0a' }}>
            {isLoadingPdf ? (
              <Spin tip="Loading Document securely..." />
            ) : pdfBlobUrl ? (
              <iframe src={`${pdfBlobUrl}#toolbar=0&navpanes=0`} style={{ width: '100%', height: 500, border: 'none' }} title="Submission PDF" />
            ) : (
              <Text type="danger">Failed to load the document.</Text>
            )}
          </div>
        )}

        <Divider style={{ margin: '12px 0', borderColor: '#262626' }} />

        {/* AI Feedback Section */}
        <div style={{ background: '#1f1f1f', borderRadius: 8, padding: 20, border: '1px solid #262626' }}>

          {/* Top Score Tags */}
          <div style={{ display: 'flex', gap: 24, marginBottom: 20 }}>
            <div>
              <Text strong style={{ color: '#a3a3a3', fontSize: 13, display: 'block', marginBottom: 4 }}>Total AI Score</Text>
              <Tag color="gold" style={{ fontSize: 18, padding: '4px 12px', fontWeight: 700, margin: 0 }}>
                {record.ai_suggested_marks} / 10
              </Tag>
            </div>
            <div>
              <Text strong style={{ color: '#a3a3a3', fontSize: 13, display: 'block', marginBottom: 4 }}>Current Final Marks</Text>
              <Tag color="blue" style={{ fontSize: 18, padding: '4px 12px', fontWeight: 700, margin: 0 }}>
                {record.final_marks ?? 'Not set'} / 10
              </Tag>
            </div>
          </div>

          {/* Marks Breakdown Table */}
          {breakdown.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <Text strong style={{ color: '#a3a3a3', fontSize: 13, display: 'block', marginBottom: 8 }}>Marks Breakdown</Text>
              <Table
                dataSource={breakdown}
                columns={columns}
                pagination={false}
                size="small"
                bordered
                className="dark-table-override"
              />
            </div>
          )}

          {/* Overall Feedback Text */}
          <Text strong style={{ color: '#a3a3a3', fontSize: 13, display: 'block', marginBottom: 8 }}>
            Overall Feedback
          </Text>
          <div
            style={{
              padding: 16,
              background: '#0a0a0a',
              borderRadius: 8,
              border: '1px solid #262626',
              lineHeight: 1.7,
              fontSize: 14,
              color: '#e5e5e5',
              whiteSpace: 'pre-wrap',
            }}
          >
            {overall || record.ai_feedback}
          </div>
        </div>
      </div>
    </Modal>
  );
};