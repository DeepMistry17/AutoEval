import { useState, useEffect } from 'react';
import { Modal, Button, Typography, Checkbox, Spin, message } from 'antd';
import * as XLSX from 'xlsx';

const { Text } = Typography;
import { API_URL } from '../../../config/constants';

interface ExportModalProps {
  visible: boolean;
  onClose: () => void;
  teamId: string | null;
}

export default function ExportModal({ visible, onClose, teamId }: ExportModalProps) {
  const [assignments, setAssignments] = useState<any[]>([]);
  const [checkedList, setCheckedList] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  // 1. Fetch the assignments for the checkboxes when the modal opens
  useEffect(() => {
    if (visible && teamId) {
      fetchAssignments();
    } else {
      setCheckedList([]);
    }
  }, [visible, teamId]);

  const fetchAssignments = async () => {
    setLoading(true);
    try {
      const token = sessionStorage.getItem('access_token');
      // Reusing your existing assignments API route
      const res = await fetch(`${API_URL}/assignments?teamId=${teamId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) throw new Error("Failed to fetch assignments");

      const data = await res.json();
      setAssignments(data);

      // Auto-check all assignments by default for convenience
      setCheckedList(data.map((a: any) => a.assignment_id));
    } catch (error) {
      console.error(error);
      message.error("Failed to load assignments.");
    }
    setLoading(false);
  };

  // 2. Handle the POST request and Excel generation
  const handleExport = async () => {
    if (checkedList.length === 0) {
      message.warning("Please select at least one assignment.");
      return;
    }

    setExporting(true);
    try {
      const token = sessionStorage.getItem('access_token');

      // Hit the new POST route we just built in the backend
      const res = await fetch(`${API_URL}/dashboard/export`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ teamId, assignmentIds: checkedList }),
      });

      if (!res.ok) throw new Error("Export request failed");

      const rawData = await res.json();

      // 3. Data Transformation: Group the flat SQL data into Excel Rows
      // We map it by roll_no so each student gets exactly one row.
      const rowMap: Record<string, any> = {};

      rawData.forEach((row: any) => {
        if (!rowMap[row.roll_no]) {
          // Initialize the row with the student's base information
          rowMap[row.roll_no] = {
            'Roll No': row.roll_no,
            'Student Name': row.name
          };
        }
        // Dynamically add the assignment title as a column, and the mark as the cell value
        rowMap[row.roll_no][row.assignment_title] = row.marks;
      });

      // Convert our map back into a simple array for the SheetJS library
      const excelData = Object.values(rowMap);

      // 4. Generate and Download the Excel File
      const worksheet = XLSX.utils.json_to_sheet(excelData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Term Clearance");

      // Trigger the browser to download the file
      XLSX.writeFile(workbook, `SAKEC_Term_Clearance_${teamId?.substring(0, 8)}.xlsx`);

      message.success("Excel file downloaded successfully!");
      onClose(); // Close the modal
    } catch (error) {
      console.error(error);
      message.error("Failed to generate Excel file.");
    }
    setExporting(false);
  };

  return (
    <Modal
      title="Export Term Work to Excel"
      open={visible}
      onCancel={onClose}
      footer={[
        <Button key="cancel" onClick={onClose} disabled={exporting}>
          Cancel
        </Button>,
        <Button
          key="export"
          type="primary"
          style={{ backgroundColor: '#52c41a' }}
          onClick={handleExport}
          loading={exporting}
        >
          Download Excel
        </Button>,
      ]}
      styles={{ body: { backgroundColor: '#1f1f1f', padding: '20px' } }}
    >
      <Text style={{ color: '#fff', display: 'block', marginBottom: '16px' }}>
        Select the assignments you want to include as columns in the final Excel report.
      </Text>

      {loading ? (
        <div style={{ textAlign: 'center', margin: '20px 0' }}>
          <Spin />
        </div>
      ) : (
        <Checkbox.Group
          style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
          value={checkedList}
          onChange={(list) => setCheckedList(list as string[])}
        >
          {assignments.map(a => (
            <Checkbox key={a.assignment_id} value={a.assignment_id} style={{ color: '#e5e5e5' }}>
              {a.title}
            </Checkbox>
          ))}
        </Checkbox.Group>
      )}
    </Modal>
  );
}