/**
 * PDF Export Utility
 * 
 * Generates a PDF report with:
 * - Project name and analysis date
 * - Health score with color coding
 * - Summary: total findings, by severity, by category
 * - All findings with details
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface Project {
  id: string;
  name: string;
  repo_url: string;
}

interface AnalysisRun {
  id: string;
  project_id: string;
  status: string;
  health_score: number | null;
  total_tests: number;
  passed: number;
  failed: number;
  created_at: string;
  completed_at: string | null;
}

interface Finding {
  id: string;
  category: 'bug' | 'security' | 'production' | 'prd_compliance';
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  bug_type: string | null;
  status: 'pass' | 'fail';
  file_path: string | null;
  line_start: number | null;
  line_end: number | null;
  code_snippet: string | null;
  explanation: string | null;
  fix_explanation: string | null;
}

export async function exportReportToPDF(
  project: Project,
  analysisRun: AnalysisRun,
  findings: Finding[]
) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let yPosition = 20;

  // Helper function to add new page if needed
  const checkPageBreak = (requiredSpace: number) => {
    if (yPosition + requiredSpace > pageHeight - 20) {
      doc.addPage();
      yPosition = 20;
      return true;
    }
    return false;
  };

  // Title
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('DevSentinel Analysis Report', pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 15;

  // Project Info
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`Project: ${project.name}`, 20, yPosition);
  yPosition += 7;
  doc.text(`Repository: ${project.repo_url}`, 20, yPosition);
  yPosition += 7;
  
  const analysisDate = new Date(analysisRun.completed_at || analysisRun.created_at);
  doc.text(`Analysis Date: ${analysisDate.toLocaleDateString()} ${analysisDate.toLocaleTimeString()}`, 20, yPosition);
  yPosition += 15;

  // Health Score Section
  checkPageBreak(40);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Health Score', 20, yPosition);
  yPosition += 10;

  const healthScore = analysisRun.health_score ?? 0;
  const healthColor = healthScore >= 80 ? [34, 197, 94] : healthScore >= 50 ? [234, 179, 8] : [239, 68, 68];
  
  doc.setFontSize(48);
  doc.setTextColor(healthColor[0], healthColor[1], healthColor[2]);
  doc.text(healthScore.toString(), 20, yPosition);
  
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'normal');
  doc.text(`Total Tests: ${analysisRun.total_tests}`, 60, yPosition - 20);
  doc.text(`Passed: ${analysisRun.passed}`, 60, yPosition - 10);
  doc.text(`Failed: ${analysisRun.failed}`, 60, yPosition);
  yPosition += 20;

  // Summary by Severity
  checkPageBreak(60);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Summary by Severity', 20, yPosition);
  yPosition += 10;

  const severityCounts = {
    critical: findings.filter(f => f.severity === 'critical').length,
    high: findings.filter(f => f.severity === 'high').length,
    medium: findings.filter(f => f.severity === 'medium').length,
    low: findings.filter(f => f.severity === 'low').length,
    info: findings.filter(f => f.severity === 'info').length,
  };

  autoTable(doc, {
    startY: yPosition,
    head: [['Severity', 'Count']],
    body: [
      ['Critical', severityCounts.critical.toString()],
      ['High', severityCounts.high.toString()],
      ['Medium', severityCounts.medium.toString()],
      ['Low', severityCounts.low.toString()],
      ['Info', severityCounts.info.toString()],
    ],
    theme: 'grid',
    headStyles: { fillColor: [71, 85, 105] },
    margin: { left: 20 },
    tableWidth: 80,
  });

  yPosition = (doc as any).lastAutoTable.finalY + 15;

  // Summary by Category
  checkPageBreak(60);
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Summary by Category', 20, yPosition);
  yPosition += 10;

  const categoryCounts = {
    bug: findings.filter(f => f.category === 'bug').length,
    security: findings.filter(f => f.category === 'security').length,
    production: findings.filter(f => f.category === 'production').length,
    prd_compliance: findings.filter(f => f.category === 'prd_compliance').length,
  };

  autoTable(doc, {
    startY: yPosition,
    head: [['Category', 'Count']],
    body: [
      ['Bug', categoryCounts.bug.toString()],
      ['Security', categoryCounts.security.toString()],
      ['Production', categoryCounts.production.toString()],
      ['PRD Compliance', categoryCounts.prd_compliance.toString()],
    ],
    theme: 'grid',
    headStyles: { fillColor: [71, 85, 105] },
    margin: { left: 20 },
    tableWidth: 80,
  });

  yPosition = (doc as any).lastAutoTable.finalY + 20;

  // Detailed Findings
  doc.addPage();
  yPosition = 20;
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Detailed Findings', 20, yPosition);
  yPosition += 15;

  // Sort findings by severity (critical first)
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };
  const sortedFindings = [...findings].sort((a, b) => 
    severityOrder[a.severity] - severityOrder[b.severity]
  );

  sortedFindings.forEach((finding, index) => {
    checkPageBreak(80);

    // Finding header
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`${index + 1}. ${finding.bug_type || finding.category.toUpperCase()}`, 20, yPosition);
    yPosition += 7;

    // Severity and Category
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Severity: ${finding.severity.toUpperCase()} | Category: ${finding.category}`, 20, yPosition);
    yPosition += 7;

    // File path
    if (finding.file_path) {
      doc.text(`File: ${finding.file_path}`, 20, yPosition);
      if (finding.line_start) {
        doc.text(` (Lines ${finding.line_start}${finding.line_end ? `-${finding.line_end}` : ''})`, 20 + doc.getTextWidth(`File: ${finding.file_path}`), yPosition);
      }
      yPosition += 7;
    }

    // Explanation
    if (finding.explanation) {
      doc.setFont('helvetica', 'italic');
      const explanationLines = doc.splitTextToSize(finding.explanation, pageWidth - 40);
      explanationLines.forEach((line: string) => {
        checkPageBreak(7);
        doc.text(line, 20, yPosition);
        yPosition += 5;
      });
      yPosition += 3;
    }

    // Code snippet (truncated for PDF)
    if (finding.code_snippet) {
      checkPageBreak(30);
      doc.setFont('courier', 'normal');
      doc.setFontSize(8);
      const codeLines = finding.code_snippet.split('\n').slice(0, 10); // First 10 lines only
      codeLines.forEach((line: string) => {
        checkPageBreak(5);
        const truncatedLine = line.length > 80 ? line.substring(0, 80) + '...' : line;
        doc.text(truncatedLine, 25, yPosition);
        yPosition += 4;
      });
      if (finding.code_snippet.split('\n').length > 10) {
        doc.text('... (truncated)', 25, yPosition);
        yPosition += 4;
      }
      yPosition += 5;
    }

    // Fix explanation
    if (finding.fix_explanation) {
      checkPageBreak(15);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.text('Suggested Fix:', 20, yPosition);
      yPosition += 5;
      doc.setFont('helvetica', 'italic');
      const fixLines = doc.splitTextToSize(finding.fix_explanation, pageWidth - 40);
      fixLines.forEach((line: string) => {
        checkPageBreak(7);
        doc.text(line, 20, yPosition);
        yPosition += 5;
      });
      yPosition += 3;
    }

    yPosition += 10; // Space between findings
  });

  // Footer on each page
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(128, 128, 128);
    doc.text(
      `Page ${i} of ${totalPages}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    );
    doc.text(
      'Generated by DevSentinel',
      pageWidth - 20,
      pageHeight - 10,
      { align: 'right' }
    );
  }

  // Save the PDF
  const fileName = `${project.name.replace(/[^a-z0-9]/gi, '_')}_analysis_report.pdf`;
  doc.save(fileName);
}
