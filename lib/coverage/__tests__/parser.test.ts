/**
 * Unit tests for code coverage parser
 */

import { describe, it, expect, vi } from 'vitest';
import {
  parseLCOV,
  parseCobertura,
  parseCoverageReport,
  getLineCoverageStatus,
  getRangeCoverageStatus,
  getFileCoveragePercentage,
} from '../parser';

// Mock the logger
vi.mock('@/lib/monitoring/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('parseLCOV', () => {
  it('should parse LCOV format correctly', () => {
    const lcov = `
SF:src/utils/helper.ts
DA:1,1
DA:2,1
DA:3,0
DA:4,1
LF:4
LH:3
end_of_record
SF:src/components/Button.tsx
DA:1,2
DA:2,2
DA:3,2
LF:3
LH:3
end_of_record
`;

    const report = parseLCOV(lcov);

    expect(report.files).toHaveLength(2);
    expect(report.files[0].file_path).toBe('src/utils/helper.ts');
    expect(report.files[0].lines_total).toBe(4);
    expect(report.files[0].lines_covered).toBe(3);
    expect(report.files[0].coverage_percentage).toBe(75);
    
    expect(report.files[1].file_path).toBe('src/components/Button.tsx');
    expect(report.files[1].lines_total).toBe(3);
    expect(report.files[1].lines_covered).toBe(3);
    expect(report.files[1].coverage_percentage).toBe(100);
    
    expect(report.total_lines).toBe(7);
    expect(report.covered_lines).toBe(6);
    expect(report.overall_percentage).toBeCloseTo(85.71, 1);
  });

  it('should handle line coverage data', () => {
    const lcov = `
SF:test.ts
DA:1,1
DA:2,0
DA:3,5
LF:3
LH:2
end_of_record
`;

    const report = parseLCOV(lcov);

    expect(report.files[0].line_coverage).toHaveLength(3);
    expect(report.files[0].line_coverage[0]).toEqual({ line: 1, hits: 1, covered: true });
    expect(report.files[0].line_coverage[1]).toEqual({ line: 2, hits: 0, covered: false });
    expect(report.files[0].line_coverage[2]).toEqual({ line: 3, hits: 5, covered: true });
  });

  it('should handle empty LCOV report', () => {
    const report = parseLCOV('');

    expect(report.files).toHaveLength(0);
    expect(report.total_lines).toBe(0);
    expect(report.covered_lines).toBe(0);
    expect(report.overall_percentage).toBe(0);
  });
});

describe('parseCobertura', () => {
  it('should parse Cobertura XML format', () => {
    const xml = `
<?xml version="1.0" ?>
<coverage>
  <packages>
    <package>
      <classes>
        <class filename="src/utils/helper.ts" line-rate="0.75">
          <lines>
            <line number="1" hits="1"/>
            <line number="2" hits="1"/>
            <line number="3" hits="0"/>
            <line number="4" hits="1"/>
          </lines>
        </class>
        <class filename="src/components/Button.tsx" line-rate="1.0">
          <lines>
            <line number="1" hits="2"/>
            <line number="2" hits="2"/>
          </lines>
        </class>
      </classes>
    </package>
  </packages>
</coverage>
`;

    const report = parseCobertura(xml);

    expect(report.files).toHaveLength(2);
    expect(report.files[0].file_path).toBe('src/utils/helper.ts');
    expect(report.files[0].coverage_percentage).toBe(75);
    expect(report.files[1].file_path).toBe('src/components/Button.tsx');
    expect(report.files[1].coverage_percentage).toBe(100);
  });

  it('should handle invalid XML gracefully', () => {
    const report = parseCobertura('invalid xml');

    expect(report.files).toHaveLength(0);
    expect(report.overall_percentage).toBe(0);
  });
});

describe('parseCoverageReport', () => {
  it('should route to LCOV parser', () => {
    const lcov = `
SF:test.ts
DA:1,1
LF:1
LH:1
end_of_record
`;

    const report = parseCoverageReport(lcov, 'lcov');

    expect(report.files).toHaveLength(1);
    expect(report.files[0].file_path).toBe('test.ts');
  });

  it('should route to Cobertura parser', () => {
    const xml = `
<coverage>
  <packages>
    <package>
      <classes>
        <class filename="test.ts" line-rate="1.0">
          <lines>
            <line number="1" hits="1"/>
          </lines>
        </class>
      </classes>
    </package>
  </packages>
</coverage>
`;

    const report = parseCoverageReport(xml, 'cobertura');

    expect(report.files).toHaveLength(1);
    expect(report.files[0].file_path).toBe('test.ts');
  });
});

describe('getLineCoverageStatus', () => {
  const report = parseLCOV(`
SF:test.ts
DA:1,0
DA:2,1
DA:3,5
LF:3
LH:2
end_of_record
`);

  it('should return uncovered for line with 0 hits', () => {
    const status = getLineCoverageStatus(report, 'test.ts', 1);
    expect(status).toBe('uncovered');
  });

  it('should return partial for line with 1 hit', () => {
    const status = getLineCoverageStatus(report, 'test.ts', 2);
    expect(status).toBe('partial');
  });

  it('should return covered for line with multiple hits', () => {
    const status = getLineCoverageStatus(report, 'test.ts', 3);
    expect(status).toBe('covered');
  });

  it('should return unknown for non-existent file', () => {
    const status = getLineCoverageStatus(report, 'nonexistent.ts', 1);
    expect(status).toBe('unknown');
  });

  it('should return unknown for non-existent line', () => {
    const status = getLineCoverageStatus(report, 'test.ts', 999);
    expect(status).toBe('unknown');
  });
});

describe('getRangeCoverageStatus', () => {
  const report = parseLCOV(`
SF:test.ts
DA:1,1
DA:2,1
DA:3,0
DA:4,0
DA:5,1
LF:5
LH:3
end_of_record
`);

  it('should return covered when all lines are covered', () => {
    const status = getRangeCoverageStatus(report, 'test.ts', 1, 2);
    expect(status).toBe('covered');
  });

  it('should return uncovered when no lines are covered', () => {
    const status = getRangeCoverageStatus(report, 'test.ts', 3, 4);
    expect(status).toBe('uncovered');
  });

  it('should return partial when some lines are covered', () => {
    const status = getRangeCoverageStatus(report, 'test.ts', 1, 3);
    expect(status).toBe('partial');
  });

  it('should return unknown for non-existent file', () => {
    const status = getRangeCoverageStatus(report, 'nonexistent.ts', 1, 5);
    expect(status).toBe('unknown');
  });
});

describe('getFileCoveragePercentage', () => {
  const report = parseLCOV(`
SF:test.ts
DA:1,1
DA:2,0
DA:3,1
DA:4,1
LF:4
LH:3
end_of_record
`);

  it('should return correct coverage percentage', () => {
    const percentage = getFileCoveragePercentage(report, 'test.ts');
    expect(percentage).toBe(75);
  });

  it('should return 0 for non-existent file', () => {
    const percentage = getFileCoveragePercentage(report, 'nonexistent.ts');
    expect(percentage).toBe(0);
  });
});
