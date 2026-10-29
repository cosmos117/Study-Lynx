// Pure helpers for the revision-style mind map (no React, so they can be unit tested).

/** How much room a branch's box needs: one line for its note plus one per key point. */
export const branchWeight = (branch) => 1 + (branch.note ? 1 : 0)
  + (branch.children || []).reduce((sum, child) => sum + 1 + (child.children?.length || 0), 0);

/**
 * Splits the main branches between the left and right of the topic so both sides are about
 * the same height. Order is kept within each side, so the map still reads top to bottom.
 */
export function splitBranches(root) {
  const left = [];
  const right = [];
  let leftWeight = 0;
  let rightWeight = 0;
  (root?.children || []).forEach((branch, index) => {
    const weight = branchWeight(branch);
    if (rightWeight <= leftWeight) {
      right.push({ branch, index });
      rightWeight += weight;
    } else {
      left.push({ branch, index });
      leftWeight += weight;
    }
  });
  return { left, right };
}

/**
 * Where the k-th of n branches on one side leaves the topic bubble. Branches are spread down the
 * bubble's edge (instead of all leaving from its middle) so curves and their labels never bunch up.
 * `bubble` is { left, right, top, height }; the bubble is a pill, so points follow its rounded end.
 */
export function topicAnchor(bubble, side, k, n) {
  const radius = bubble.height / 2;
  const spread = Math.max(0, radius - 6);
  const offset = n <= 1 ? 0 : -spread + (2 * spread * k) / (n - 1);
  const inset = radius - Math.sqrt(Math.max(0, radius * radius - offset * offset));
  return {
    x: side === 'left' ? bubble.left + inset : bubble.right - inset,
    y: bubble.top + radius + offset,
  };
}

/**
 * Word-wraps a label into at most `maxLines` lines of `maxChars`, ending with … if it still
 * doesn't fit. Labels stay horizontal, so they are always easy to read.
 */
export function wrapLabel(label, maxChars, maxLines = 2) {
  const width = Math.max(6, maxChars);
  const lines = [];
  let line = '';
  for (const word of label.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (next.length <= width) {
      line = next;
    } else {
      if (line) lines.push(line);
      line = word.length > width ? `${word.slice(0, width - 1)}…` : word;
    }
  }
  if (line) lines.push(line);
  if (lines.length <= maxLines) return lines;
  const kept = lines.slice(0, maxLines);
  const last = kept[maxLines - 1];
  kept[maxLines - 1] = `${(last.length >= width ? last.slice(0, width - 1) : last).trimEnd()}…`;
  return kept;
}

/**
 * A branch from the topic to a box: a smooth curve, then a short straight run beside the box where
 * the branch label sits. Always drawn left to right.
 *   side 'left':  box ──shelf── ⤳ topic        side 'right': topic ⤳ ──shelf── box
 */
export function branchPath(side, boxPoint, topicPoint, shelf) {
  if (side === 'left') {
    const shelfEnd = boxPoint.x + shelf;
    const bend = (topicPoint.x - shelfEnd) / 2;
    return `M ${boxPoint.x} ${boxPoint.y} H ${shelfEnd} C ${shelfEnd + bend} ${boxPoint.y}, ${topicPoint.x - bend} ${topicPoint.y}, ${topicPoint.x} ${topicPoint.y}`;
  }
  const shelfStart = boxPoint.x - shelf;
  const bend = (shelfStart - topicPoint.x) / 2;
  return `M ${topicPoint.x} ${topicPoint.y} C ${topicPoint.x + bend} ${topicPoint.y}, ${shelfStart - bend} ${boxPoint.y}, ${shelfStart} ${boxPoint.y} H ${boxPoint.x}`;
}

export const clampZoom = (value, min = 0.4, max = 2) => Math.min(max, Math.max(min, Math.round(value * 100) / 100));

/** The whole map as a Markdown outline, for downloading. */
export function toOutline(root) {
  const lines = [`# ${root.label}`];
  const walk = (node, depth) => {
    const text = node.note ? `**${node.label}**: ${node.note}` : `**${node.label}**`;
    lines.push(depth === 1 ? `\n## ${node.label}${node.note ? `\n${node.note}` : ''}` : `${'  '.repeat(depth - 2)}- ${text}`);
    node.children?.forEach((child) => walk(child, depth + 1));
  };
  root.children?.forEach((child) => walk(child, 1));
  return `${lines.join('\n')}\n`;
}
