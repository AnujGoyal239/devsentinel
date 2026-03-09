/**
 * Unit tests for performance analyzer
 */

import { describe, it, expect, vi } from 'vitest';
import {
  detectNPlusOneQueries,
  detectSyncInAsync,
  detectInefficientLoops,
  detectMissingPagination,
  detectMissingIndexes,
  analyzePerformance,
} from '../analyzer';

// Mock the logger
vi.mock('@/lib/monitoring/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}));

describe('detectNPlusOneQueries', () => {
  it('should detect N+1 query in forEach loop', () => {
    const code = `
users.forEach(async (user) => {
  const posts = await Post.find({ userId: user.id });
  console.log(posts);
});
`;

    const issues = detectNPlusOneQueries('test.ts', code);

    expect(issues).toHaveLength(1);
    expect(issues[0].type).toBe('n_plus_one');
    expect(issues[0].severity).toBe('high');
    expect(issues[0].explanation).toContain('N+1 query');
  });

  it('should detect N+1 query in for loop', () => {
    const code = `
for (const user of users) {
  const result = await db.query('SELECT * FROM posts WHERE user_id = ?', [user.id]);
}
`;

    const issues = detectNPlusOneQueries('test.ts', code);

    expect(issues).toHaveLength(1);
    expect(issues[0].type).toBe('n_plus_one');
  });

  it('should not detect false positives', () => {
    const code = `
const users = await User.find();
console.log(users);
`;

    const issues = detectNPlusOneQueries('test.ts', code);

    expect(issues).toHaveLength(0);
  });
});

describe('detectSyncInAsync', () => {
  it('should detect fs.readFileSync in async function', () => {
    const code = `
async function loadConfig() {
  const data = fs.readFileSync('config.json', 'utf8');
  try {
    return JSON.parse(data);
  } catch (e) {
    return null;
  }
}
`;

    const issues = detectSyncInAsync('test.ts', code);

    expect(issues.length).toBeGreaterThanOrEqual(1);
    const fsIssue = issues.find(i => i.explanation.includes('fs.readFileSync'));
    expect(fsIssue).toBeDefined();
    expect(fsIssue?.type).toBe('sync_in_async');
    expect(fsIssue?.severity).toBe('medium');
  });

  it('should detect fs.writeFileSync in async arrow function', () => {
    const code = `
const saveData = async () => {
  fs.writeFileSync('output.txt', data);
};
`;

    const issues = detectSyncInAsync('test.ts', code);

    expect(issues).toHaveLength(1);
    expect(issues[0].explanation).toContain('fs.writeFileSync');
  });

  it('should not flag sync operations in non-async functions', () => {
    const code = `
function loadConfig() {
  const data = fs.readFileSync('config.json', 'utf8');
  return JSON.parse(data);
}
`;

    const issues = detectSyncInAsync('test.ts', code);

    expect(issues).toHaveLength(0);
  });
});

describe('detectInefficientLoops', () => {
  it('should detect triple-nested loops', () => {
    const code = `
for (const a of arrayA) {
  for (const b of arrayB) {
    for (const c of arrayC) {
      if (a === b && b === c) {
        console.log('match');
      }
    }
  }
}
`;

    const issues = detectInefficientLoops('test.ts', code);

    expect(issues).toHaveLength(1);
    expect(issues[0].type).toBe('inefficient_loop');
    expect(issues[0].severity).toBe('high');
    expect(issues[0].explanation).toContain('Triple-nested');
  });

  it('should not flag double-nested loops', () => {
    const code = `
for (const a of arrayA) {
  for (const b of arrayB) {
    console.log(a, b);
  }
}
`;

    const issues = detectInefficientLoops('test.ts', code);

    expect(issues).toHaveLength(0);
  });
});

describe('detectMissingPagination', () => {
  it('should detect find without limit', () => {
    const code = `
const users = await User.find({ active: true });
`;

    const issues = detectMissingPagination('test.ts', code);

    expect(issues).toHaveLength(1);
    expect(issues[0].type).toBe('missing_pagination');
    expect(issues[0].explanation).toContain('pagination');
  });

  it('should not flag queries with limit', () => {
    const code = `
const users = await User.find({ active: true }).limit(100);
`;

    const issues = detectMissingPagination('test.ts', code);

    expect(issues).toHaveLength(0);
  });

  it('should detect SQL SELECT without LIMIT', () => {
    const code = `
const result = await db.query('SELECT * FROM users WHERE active = true');
`;

    const issues = detectMissingPagination('test.ts', code);

    expect(issues).toHaveLength(1);
  });
});

describe('detectMissingIndexes', () => {
  it('should detect find on non-id field', () => {
    const code = `
const user = await User.find({ email: 'test@example.com' });
`;

    const issues = detectMissingIndexes('test.ts', code);

    expect(issues).toHaveLength(1);
    expect(issues[0].type).toBe('missing_index');
    expect(issues[0].explanation).toContain('email');
  });

  it('should detect sort without index hint', () => {
    const code = `
const users = await User.find().sort({ createdAt: -1 });
`;

    const issues = detectMissingIndexes('test.ts', code);

    expect(issues).toHaveLength(1);
    expect(issues[0].explanation).toContain('createdAt');
  });

  it('should not flag queries on id field', () => {
    const code = `
const user = await User.find({ id: userId });
`;

    const issues = detectMissingIndexes('test.ts', code);

    expect(issues).toHaveLength(0);
  });
});

describe('analyzePerformance', () => {
  it('should detect multiple issue types', () => {
    const code = `
async function processUsers() {
  const users = await User.find({ active: true });
  
  users.forEach(async (user) => {
    const posts = await Post.find({ userId: user.id });
    const data = fs.readFileSync('template.txt', 'utf8');
  });
}
`;

    const issues = analyzePerformance('test.ts', code);

    expect(issues.length).toBeGreaterThan(0);
    
    const types = issues.map(i => i.type);
    expect(types).toContain('n_plus_one');
    expect(types).toContain('sync_in_async');
    expect(types).toContain('missing_pagination');
  });

  it('should return empty array for clean code', () => {
    const code = `
async function getUsers() {
  // @index: active field is indexed
  const users = await User.find({ id: userId }).limit(100);
  return users;
}
`;

    const issues = analyzePerformance('test.ts', code);

    expect(issues).toHaveLength(0);
  });
});
