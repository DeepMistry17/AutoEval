import { Modal, Typography, Tag, Spin, Card, InputNumber, Button, message, Space, Input, Slider } from 'antd';
import { SaveOutlined, CheckCircleOutlined, EditOutlined, CloseCircleOutlined, RollbackOutlined } from '@ant-design/icons';
import { useEffect, useState } from 'react';
import { API_URL } from '../../../config/constants';

const { Text, Title } = Typography;

interface SubmissionRecord {
  submission_id: number | string;
  full_name: string;
  assignment_title: string;
  ai_suggested_marks: number;
  ai_feedback: string;
  final_marks: number | null;
  status: string;
  file_path: string;
  local_converted_path?: string;
  revision_feedback?: string; 
}

interface Props {
  open: boolean;
  record: SubmissionRecord | null;
  onClose: () => void;
  onRefresh: () => void;
}

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
    const match = line.match(/-\s*(.*?)\s*\(([\d.]+)\/([\d.]+)\):\s*(.*)/);
    if (match) {
      const comment = match[4].trim();
      const levelMatch = comment.match(/\[Level (\d+)\]/i);
      const level = levelMatch ? parseInt(levelMatch[1], 10) : 1;

      breakdown.push({
        key: index,
        category: match[1].trim(),
        score: parseFloat(match[2]),
        max: parseFloat(match[3]),
        comment: comment,
        level: level 
      });
    }
  });
  return { breakdown, overall };
};

export const ReviewModal = ({ open, record, onClose, onRefresh }: Props) => {
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [isLoadingPdf, setIsLoadingPdf] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [editedMark, setEditedMark] = useState<number | null>(null);

  const [confirmAction, setConfirmAction] = useState<'accept' | 'edit' | 'clear' | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");

  const [rubricBreakdown, setRubricBreakdown] = useState<any[]>([]);

  // REVISION MODAL STATE
  const [isRevisionModalOpen, setIsRevisionModalOpen] = useState(false);
  const [revisionText, setRevisionText] = useState("");
  const [isReturning, setIsReturning] = useState(false);

  useEffect(() => {
    if (open && record) {
      setEditedMark(record.final_marks ?? record.ai_suggested_marks);

      const { overall, breakdown } = parseFeedback(record.ai_feedback);
      setFeedbackText(overall || record.ai_feedback);
      setRubricBreakdown(breakdown);

      setIsEditing(false);
      setConfirmAction(null);
      setRevisionText(""); 

      setIsLoadingPdf(true);
      const token = sessionStorage.getItem('access_token');
      let fetchUrl = '';

      if (record.local_converted_path) {
        fetchUrl = `${API_URL}/assignments/local-pdf?filePath=${encodeURIComponent(record.local_converted_path)}`;
      } else if (record.file_path) {
        fetchUrl = `${API_URL}/assignments/view-file?url=${encodeURIComponent(record.file_path)}`;
      }

      if (fetchUrl) {
        fetch(fetchUrl, { headers: { Authorization: `Bearer ${token}` } })
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
        setIsLoadingPdf(false);
      }
    }
    return () => {
      if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl);
      setPdfBlobUrl(null);
    };
  }, [open, record]);

  const handleSave = async () => {
    if (!record || editedMark === null) return;
    setIsSaving(true);
    try {
      const token = sessionStorage.getItem('access_token');

      const resp = await fetch(`${API_URL}/submissions/${record.submission_id}/sync`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          finalMarks: editedMark,
          overallFeedback: feedbackText,         
          rubricBreakdown: rubricBreakdown       
        }),
      });

      if (!resp.ok) throw new Error('Failed to sync');

      message.success('Rubric matched, marks saved, and returned in Teams!');
      onRefresh();
      onClose();
    } catch {
      message.error('Failed to sync to Teams');
    } finally {
      setIsSaving(false);
    }
  };

  const executeReturnForRevision = async () => {
    if (!record || !revisionText.trim()) return;
    setIsReturning(true);

    try {
      const token = sessionStorage.getItem('access_token');
      const resp = await fetch(`${API_URL}/submissions/${record.submission_id}/return-revision`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ revisionFeedback: revisionText }),
      });

      if (!resp.ok) throw new Error('Failed to return for revision');

      message.success('Assignment returned to student for revision!');
      setIsRevisionModalOpen(false);
      onRefresh();
      onClose();
    } catch {
      message.error('Failed to return assignment');
    } finally {
      setIsReturning(false);
    }
  };

  const handleFeedbackAction = (action: 'accept' | 'edit' | 'clear') => {
    setConfirmAction(action);
  };

  const executeAction = () => {
    if (confirmAction === 'edit') {
      setIsEditing(true);
    } else if (confirmAction === 'clear') {
      setFeedbackText("");
      setIsEditing(false);
    } else if (confirmAction === 'accept') {
      setIsEditing(false);
    }
    setConfirmAction(null);
  };

  const cancelAction = () => {
    setConfirmAction(null);
  };

  const handleRubricLevelChange = (index: number, newLevel: number) => {
    const updated = [...rubricBreakdown];
    const item = updated[index];
    item.level = newLevel;
    item.score = parseFloat(((newLevel / 4) * item.max).toFixed(2));
    item.comment = item.comment.replace(/\[Level \d+\]/i, `[Level ${newLevel}]`);
    setRubricBreakdown(updated);
    const newTotal = updated.reduce((sum, curr) => sum + curr.score, 0);
    setEditedMark(parseFloat(newTotal.toFixed(2)));
  };

  const handleRubricCommentChange = (index: number, newComment: string) => {
    const updated = [...rubricBreakdown];
    updated[index].comment = newComment;
    setRubricBreakdown(updated);
  };

  if (!record) return null;

  return (
    <Modal
      title={null}
      open={open}
      onCancel={onClose}
      footer={null}
      width="95vw"
      centered
      closeIcon={<span style={{ color: '#a3a3a3', fontSize: '20px', zIndex: 10 }}>✖</span>}
      styles={{
        body: { padding: '24px', background: '#0a0a0a', borderRadius: 12 },
        mask: { backdropFilter: 'blur(8px)' }
      }}
    >
      <div style={{ display: 'flex', gap: '24px', height: '85vh' }}>

        <div style={{ flex: '0 0 60%', display: 'flex', flexDirection: 'column' }}>
          <Title level={4} style={{ color: '#e5e5e5', marginTop: 0 }}>Reviewing: {record.full_name}</Title>

          <div style={{ flex: 1, borderRadius: 12, overflow: 'hidden', border: '1px solid #262626', background: '#141414', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {(!record.file_path && !record.local_converted_path) ? (
              <Text type="secondary">The student clicked 'Turn In' but did not attach any file.</Text>
            ) : (!record.local_converted_path && record.file_path?.match(/\.(mp4|zip|rar|exe|mp3|wav|avi|mov)$/i)) ? (
              <div style={{ textAlign: 'center' }}>
                <Text style={{ color: '#a3a3a3', display: 'block' }}>Unsupported File Type</Text>
                <Text type="secondary" style={{ fontSize: '12px' }}>Download directly from MS Teams.</Text>
              </div>
            ) : isLoadingPdf ? (
              <Spin tip="Loading Document securely..." />
            ) : pdfBlobUrl ? (
              <iframe src={`${pdfBlobUrl}#toolbar=0&navpanes=0`} style={{ width: '100%', height: '100%', border: 'none' }} title="Submission PDF" />
            ) : (
              <Text type="danger">Failed to load the document.</Text>
            )}
          </div>
        </div>

        <div style={{ flex: '0 0 40%', display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto', paddingRight: '8px' }}>

          <div style={{ background: '#1f1f1f', padding: '20px', borderRadius: 12, border: '1px solid #262626', marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div>
                <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>AI Suggested Score</Text>
                <Text style={{ color: '#e5e5e5', fontSize: 24, fontWeight: 700 }}>{record.ai_suggested_marks} / 10</Text>
              </div>
              <div style={{ textAlign: 'right' }}>
                <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>Final Override Mark</Text>
                <InputNumber
                  min={0} max={10} step={0.5}
                  value={editedMark}
                  onChange={(val) => setEditedMark(val)}
                  style={{ width: 80, fontSize: 18, fontWeight: 'bold' }}
                />
              </div>
            </div>

            {/* BUTTON WIDTH FIX: flex: 1 for both buttons */}
            <div style={{ display: 'flex', gap: '12px' }}>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                size="large"
                loading={isSaving}
                onClick={handleSave}
                style={{ flex: 1, background: 'linear-gradient(135deg, #10b981, #059669)', border: 'none', fontWeight: 600 }}
              >
                Save & Sync
              </Button>
              <Button
                danger
                type="default"
                icon={<RollbackOutlined />}
                size="large"
                onClick={() => setIsRevisionModalOpen(true)}
                style={{ flex: 1, fontWeight: 600, background: 'rgba(239, 68, 68, 0.1)', borderColor: '#ef4444', color: '#ef4444' }}
              >
                Return
              </Button>
            </div>
          </div>

          {/* TEXT CHANGE FIX: Changed WAITING FOR REVISION to REVISION REQUESTED */}
          {record.revision_feedback && (
            <div style={{ background: 'rgba(234, 179, 8, 0.1)', border: '1px solid #eab308', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px' }}>
              <Text strong style={{ color: '#eab308', display: 'block', marginBottom: '4px' }}>REVISION REQUESTED</Text>
              <Text style={{ color: '#fef08a' }}>{record.revision_feedback}</Text>
            </div>
          )}

          <div style={{ flex: 1 }}>
            <Text strong style={{ color: '#a3a3a3', fontSize: 13, display: 'block', marginBottom: 12 }}>RUBRIC EVALUATION</Text>

            {rubricBreakdown.map((item, index) => (
              <Card key={item.key} size="small" style={{ background: '#141414', borderColor: '#262626', marginBottom: 12, borderRadius: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <Text strong style={{ color: '#e5e5e5' }}>{item.category}</Text>

                  {isEditing ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', width: '250px' }}>
                      <Slider
                        min={1} max={4} step={1}
                        value={item.level}
                        onChange={(val) => handleRubricLevelChange(index, val)}
                        style={{ flex: 1, margin: 0 }}
                        trackStyle={{ background: '#3b82f6' }}
                      />
                      <Text style={{ color: '#e5e5e5', width: '75px', textAlign: 'right', fontWeight: 600 }}>
                        {item.score.toFixed(2)}
                      </Text>
                    </div>
                  ) : (
                    <Tag color={item.score === item.max ? 'green' : item.score < (item.max / 2) ? 'red' : 'orange'} style={{ margin: 0 }}>
                      {item.score} / {item.max} Pts
                    </Tag>
                  )}
                </div>

                <div style={{ background: '#0a0a0a', padding: 8, borderRadius: 4, borderLeft: '3px solid #3b82f6' }}>
                  {isEditing ? (
                    <Input.TextArea
                      value={item.comment}
                      onChange={(e) => handleRubricCommentChange(index, e.target.value)}
                      autoSize={{ minRows: 2, maxRows: 5 }}
                      style={{ background: '#1f1f1f', color: '#e5e5e5', borderColor: '#262626', marginTop: '4px' }}
                    />
                  ) : (
                    <Text style={{ color: '#a3a3a3', fontSize: 13 }}>{item.comment}</Text>
                  )}
                </div>
              </Card>
            ))}

            <Text strong style={{ color: '#a3a3a3', fontSize: 13, display: 'block', margin: '20px 0 12px' }}>AI FEEDBACK STUDIO</Text>
            <div style={{ background: '#141414', borderRadius: 8, border: '1px solid #262626', padding: 16 }}>

              {isEditing ? (
                <Input.TextArea
                  value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)}
                  autoSize={{ minRows: 4, maxRows: 8 }}
                  style={{ background: '#1f1f1f', color: '#e5e5e5', borderColor: '#262626', marginBottom: 16 }}
                />
              ) : (
                <Text style={{ color: '#e5e5e5', whiteSpace: 'pre-wrap', fontSize: 14, lineHeight: 1.6, display: 'block', marginBottom: 16 }}>
                  {feedbackText}
                </Text>
              )}

              <Space>
                {isEditing ? (
                  <Button onClick={() => handleFeedbackAction('accept')} size="small" icon={<CheckCircleOutlined />} style={{ color: '#10b981', borderColor: '#10b981', background: 'transparent' }}>
                    Accept
                  </Button>
                ) : (
                  <Button onClick={() => handleFeedbackAction('edit')} size="small" icon={<EditOutlined />} style={{ color: '#3b82f6', borderColor: '#3b82f6', background: 'transparent' }}>
                    Edit
                  </Button>
                )}

                <Button onClick={() => handleFeedbackAction('clear')} size="small" icon={<CloseCircleOutlined />} danger type="text">
                  Clear
                </Button>
              </Space>
            </div>

          </div>
        </div>
      </div>

      <Modal
        title={<Text style={{ color: '#e5e5e5' }}>Confirm Action</Text>}
        open={!!confirmAction}
        onOk={executeAction}
        onCancel={cancelAction}
        okText="Yes, I'm sure"
        cancelText="Cancel"
        okButtonProps={{
          danger: confirmAction === 'clear',
          style: confirmAction === 'accept' ? { background: '#10b981', borderColor: '#10b981' } : {}
        }}
        style={{ background: '#141414', border: '1px solid #262626', borderRadius: '8px', paddingBottom: 0 }}
        styles={{
          body: { padding: '24px 0', background: '#0a0a0a' },
          header: { background: '#141414', borderBottom: '1px solid #262626', paddingBottom: '12px' }
        }}
        closeIcon={<span style={{ color: '#a3a3a3' }}>✖</span>}
        centered
      >
        <Text style={{ color: '#a3a3a3' }}>
          Are you sure you want to <strong>{confirmAction}</strong> this AI feedback?
        </Text>
      </Modal>

      {/* REVISION MODAL FIX: Centered title, cleaner border, better padding */}
      <Modal
        title={
          <div style={{ textAlign: 'center', width: '100%' }}>
            <Text strong style={{ color: '#ef4444', fontSize: '18px', letterSpacing: '0.5px' }}>Revision Requested</Text>
          </div>
        }
        open={isRevisionModalOpen}
        onOk={executeReturnForRevision}
        onCancel={() => {
          setIsRevisionModalOpen(false);
          setRevisionText("");
        }}
        okText="Confirm & Return"
        cancelText="Cancel"
        confirmLoading={isReturning}
        okButtonProps={{ danger: true, style: { fontWeight: 600 } }}
        cancelButtonProps={{ style: { color: '#a3a3a3', borderColor: '#262626', background: 'transparent' } }}
        style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid #3f3f46' }} 
        styles={{
          body: { padding: '24px', background: '#18181b' }, 
          header: { background: '#18181b', borderBottom: '1px solid #27272a', padding: '16px 24px' }
        }}
        closeIcon={<span style={{ color: '#71717a', fontSize: '16px' }}>✖</span>}
        centered
        width={450} 
      >
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <Text style={{ color: '#a1a1aa', fontSize: '14px' }}>
              Provide instructions for the student. This feedback will be sent directly to their MS Teams account.
            </Text>
        </div>
        <Input.TextArea
          placeholder="E.g., You uploaded the wrong SQL file. Please upload the Python script instead."
          value={revisionText}
          onChange={(e) => setRevisionText(e.target.value)}
          autoSize={{ minRows: 4, maxRows: 6 }}
          style={{ 
            background: '#09090b', 
            color: '#e4e4e7', 
            borderColor: '#27272a',
            padding: '12px',
            borderRadius: '8px',
            fontSize: '14px'
          }}
        />
      </Modal>

    </Modal>
  );
};