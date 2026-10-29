import { describe, expect, it } from 'vitest';
import { branchPath, branchWeight, clampZoom, splitBranches, toOutline, topicAnchor, wrapLabel } from './mindmap.js';

const branch = (label, points = 2, note = true) => ({
  label,
  ...(note ? { note: `${label} summary.` } : {}),
  children: Array.from({ length: points }, (_, index) => ({ label: `${label}.${index + 1}`, note: 'Fact.' })),
});

describe('splitBranches', () => {
  it('puts branches on both sides and keeps every branch once, in order', () => {
    const root = { label: 'T', children: ['A', 'B', 'C', 'D', 'E'].map((label) => branch(label)) };
    const { left, right } = splitBranches(root);
    expect(left.length).toBeGreaterThan(0);
    expect(right.length).toBeGreaterThan(0);
    const all = [...left, ...right].map((item) => item.index).sort();
    expect(all).toEqual([0, 1, 2, 3, 4]);
    for (const side of [left, right]) {
      expect(side.map((item) => item.index)).toEqual([...side.map((item) => item.index)].sort((a, b) => a - b));
    }
  });

  it('balances the two sides by how much each box holds', () => {
    const root = { label: 'T', children: [branch('Big', 5), branch('S1', 1), branch('S2', 1), branch('S3', 1)] };
    const { left, right } = splitBranches(root);
    const weight = (side) => side.reduce((sum, item) => sum + branchWeight(item.branch), 0);
    expect(Math.abs(weight(left) - weight(right))).toBeLessThanOrEqual(branchWeight(branch('Big', 5)));
    expect(right[0].branch.label).toBe('Big');
    expect(left.map((item) => item.branch.label)).toContain('S1');
  });

  it('handles a map with no branches', () => {
    expect(splitBranches({ label: 'T' })).toEqual({ left: [], right: [] });
    expect(splitBranches(null)).toEqual({ left: [], right: [] });
  });
});

describe('topicAnchor', () => {
  const bubble = { left: 100, right: 300, top: 50, height: 60 };

  it('leaves from the middle of the bubble edge when there is one branch', () => {
    expect(topicAnchor(bubble, 'left', 0, 1)).toEqual({ x: 100, y: 80 });
    expect(topicAnchor(bubble, 'right', 0, 1)).toEqual({ x: 300, y: 80 });
  });

  it('spreads several branches down the edge, top to bottom, inside the bubble', () => {
    const points = [0, 1, 2].map((k) => topicAnchor(bubble, 'left', k, 3));
    expect(points[0].y).toBeLessThan(points[1].y);
    expect(points[1].y).toBeLessThan(points[2].y);
    for (const point of points) {
      expect(point.y).toBeGreaterThanOrEqual(50);
      expect(point.y).toBeLessThanOrEqual(110);
      expect(point.x).toBeGreaterThanOrEqual(100);
    }
    // Points away from the middle sit further in, following the rounded end of the pill.
    expect(points[0].x).toBeGreaterThan(points[1].x);
  });
});

describe('wrapLabel', () => {
  it('keeps a short label on one line', () => {
    expect(wrapLabel('Normal forms', 20)).toEqual(['Normal forms']);
  });

  it('wraps a long label onto two lines instead of cutting it', () => {
    expect(wrapLabel('Objectives and Anomalies', 16)).toEqual(['Objectives and', 'Anomalies']);
  });

  it('ends with … only when even two lines are not enough', () => {
    const lines = wrapLabel('Functional dependencies and their many different types', 14);
    expect(lines).toHaveLength(2);
    expect(lines[1].endsWith('…')).toBe(true);
    for (const line of lines) expect(line.length).toBeLessThanOrEqual(14);
  });

  it('shortens a single very long word', () => {
    expect(wrapLabel('Supercalifragilistic', 10)).toEqual(['Supercali…']);
  });
});

describe('branchPath', () => {
  it('runs from the box along a straight shelf, then curves to the topic (left side)', () => {
    expect(branchPath('left', { x: 0, y: 20 }, { x: 200, y: 80 }, 60)).toBe('M 0 20 H 60 C 130 20, 130 80, 200 80');
  });

  it('curves from the topic, then runs along a straight shelf into the box (right side)', () => {
    expect(branchPath('right', { x: 400, y: 20 }, { x: 200, y: 80 }, 60)).toBe('M 200 80 C 270 80, 270 20, 340 20 H 400');
  });
});

describe('clampZoom', () => {
  it('keeps zoom between 40% and 200%, rounded to whole percent', () => {
    expect(clampZoom(0.1)).toBe(0.4);
    expect(clampZoom(5)).toBe(2);
    expect(clampZoom(0.8333)).toBe(0.83);
  });
});

describe('toOutline', () => {
  it('writes the topic, each branch with its note, and each point with its note', () => {
    const text = toOutline({ label: 'Normalization', children: [branch('1NF', 1)] });
    expect(text).toContain('# Normalization');
    expect(text).toContain('## 1NF\n1NF summary.');
    expect(text).toContain('- **1NF.1**: Fact.');
  });

  it('works for older maps without notes', () => {
    expect(toOutline({ label: 'T', children: [{ label: 'A', children: [{ label: 'a' }] }] })).toContain('- **a**');
  });
});
