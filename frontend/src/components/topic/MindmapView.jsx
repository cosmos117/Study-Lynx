import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { branchPath, clampZoom, splitBranches, toOutline, topicAnchor, wrapLabel } from '../../utils/mindmap.js';

// On phones there's no room for branches, so the map becomes a stacked list of boxes.
const NARROW_QUERY = '(max-width: 640px)';
const ZOOM_STEP = 0.1;
// The branch meets a box beside its first line, like a branch ending at a note card.
const BOX_ANCHOR_Y = 22;
// Branch labels use 12.5px bold text; this is roughly one character's width.
const LABEL_CHAR_PX = 7.4;
const LABEL_LINE_PX = 15;
// Share of the space between a box and the topic used by the straight run that carries the label.
const SHELF_SHARE = 0.62;

function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const list = window.matchMedia(query);
    const onChange = () => setMatches(list.matches);
    list.addEventListener('change', onChange);
    return () => list.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

function Points({ items }) {
  return (
    <ul className="lynx-mm-points">
      {items.map((item) => (
        <li key={item.label}>
          <strong>{item.label}</strong>{item.note && <span>: {item.note}</span>}
          {item.children?.length > 0 && <Points items={item.children} />}
        </li>
      ))}
    </ul>
  );
}

function BranchBox({ branch, boxRef }) {
  return (
    <article ref={boxRef} className="lynx-mm-box">
      <h3 className="lynx-mm-box-title">{branch.label}</h3>
      {branch.note && <p className="lynx-mm-note">{branch.note}</p>}
      {branch.children?.length > 0 && <Points items={branch.children} />}
    </article>
  );
}

/** Works out each branch line and its label from where the boxes actually ended up. */
function layoutBranches(stage, bubble, boxes, sides) {
  const origin = stage.getBoundingClientRect();
  // Measured on screen, so undo the zoom to get the map's own coordinates.
  const scale = origin.width / stage.offsetWidth || 1;
  const local = (rect) => ({
    left: (rect.left - origin.left) / scale,
    right: (rect.right - origin.left) / scale,
    top: (rect.top - origin.top) / scale,
    height: rect.height / scale,
  });
  const topic = local(bubble.getBoundingClientRect());
  const links = [];
  for (const [side, items] of sides) {
    items.forEach(({ branch, index }, k) => {
      const element = boxes.get(index);
      if (!element) return;
      const box = local(element.getBoundingClientRect());
      const boxPoint = { x: side === 'left' ? box.right : box.left, y: box.top + Math.min(BOX_ANCHOR_Y, box.height / 2) };
      const topicPoint = topicAnchor(topic, side, k, items.length);
      const room = Math.abs(topicPoint.x - boxPoint.x) * SHELF_SHARE;
      const lines = wrapLabel(branch.label, Math.floor(room / LABEL_CHAR_PX));
      const shelf = Math.min(room, Math.max(...lines.map((line) => line.length)) * LABEL_CHAR_PX + 18);
      links.push({
        key: index,
        title: branch.label,
        d: branchPath(side, boxPoint, topicPoint, shelf),
        lines,
        labelX: side === 'left' ? boxPoint.x + shelf / 2 : boxPoint.x - shelf / 2,
        labelY: boxPoint.y - 7,
      });
    });
  }
  return links;
}

/**
 * A revision-book style mind map: the topic in the middle, a branch to each box with the branch
 * name written along it, and the box holding a short note and the key points. Zoomable.
 */
export default function MindmapView({ content }) {
  const root = content.content || content;
  const { left, right } = useMemo(() => splitBranches(root), [root]);
  const narrow = useMediaQuery(NARROW_QUERY);
  const viewport = useRef(null);
  const stage = useRef(null);
  const bubble = useRef(null);
  const boxes = useRef(new Map());
  const [links, setLinks] = useState([]);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [viewportWidth, setViewportWidth] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [fitting, setFitting] = useState(true);

  const setBox = (index) => (element) => {
    if (element) boxes.current.set(index, element); else boxes.current.delete(index);
  };

  const measure = useCallback(() => {
    if (!stage.current || !bubble.current) return;
    setSize({ width: stage.current.offsetWidth, height: stage.current.offsetHeight });
    setLinks(narrow ? [] : layoutBranches(stage.current, bubble.current, boxes.current, [['left', left], ['right', right]]));
  }, [left, right, narrow]);

  useLayoutEffect(() => {
    measure();
    const observer = new ResizeObserver(() => {
      measure();
      if (viewport.current) setViewportWidth(viewport.current.clientWidth);
    });
    if (stage.current) observer.observe(stage.current);
    if (viewport.current) observer.observe(viewport.current);
    return () => observer.disconnect();
  }, [measure]);

  // "Fit" keeps the whole map in view as the window resizes, until the student picks a zoom.
  const fitZoom = size.width && viewportWidth ? clampZoom(Math.min(1, (viewportWidth - 2) / size.width)) : 1;
  const scale = narrow ? 1 : fitting ? fitZoom : zoom;
  const zoomTo = (value) => { setFitting(false); setZoom(clampZoom(value)); };

  // Ctrl/⌘ + scroll zooms the map. Attached natively: React's wheel listener can't prevent scrolling.
  const scaleRef = useRef(scale);
  scaleRef.current = scale;
  useEffect(() => {
    const element = viewport.current;
    if (!element || narrow) return undefined;
    const onWheel = (event) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      setFitting(false);
      setZoom(clampZoom(scaleRef.current + (event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP)));
    };
    element.addEventListener('wheel', onWheel, { passive: false });
    return () => element.removeEventListener('wheel', onWheel);
  }, [narrow]);

  const download = () => {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([toOutline(root)], { type: 'text/markdown' }));
    link.download = `${root.label.replace(/[^\w-]+/g, '-').toLowerCase() || 'mind-map'}.md`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const hasNotes = root.children?.some((branch) => branch.note);

  const map = (
    <div ref={stage} className={`lynx-mm ${narrow ? 'is-stacked' : 'is-wide'}`} style={narrow ? undefined : { transform: `scale(${scale})` }}>
      {!narrow && (
        <svg className="lynx-mm-links" aria-hidden="true">
          {links.map((link) => (
            <g key={link.key} className="lynx-mm-branch">
              <title>{link.title}</title>
              <path d={link.d} className="lynx-mm-curve" />
              {link.lines.map((line, i) => (
                <text key={line} x={link.labelX} y={link.labelY - (link.lines.length - 1 - i) * LABEL_LINE_PX} textAnchor="middle" className="lynx-mm-curve-label">{line}</text>
              ))}
            </g>
          ))}
        </svg>
      )}
      <div className="lynx-mm-col">{left.map(({ branch, index }) => <BranchBox key={index} branch={branch} boxRef={setBox(index)} />)}</div>
      <div className="lynx-mm-centre"><div ref={bubble} className="lynx-mm-root">{root.label}</div></div>
      <div className="lynx-mm-col">{right.map(({ branch, index }) => <BranchBox key={index} branch={branch} boxRef={setBox(index)} />)}</div>
    </div>
  );

  return (
    <div>
      <div className="lynx-row-between lynx-mm-toolbar">
        <p className="lynx-eyebrow">AI-generated. Verify important facts.</p>
        {!narrow && (
          <div className="lynx-mm-zoom" role="group" aria-label="Zoom">
            <button type="button" onClick={() => zoomTo(scale - ZOOM_STEP)} disabled={scale <= 0.4} className="lynx-btn lynx-btn-ghost lynx-btn-sm" aria-label="Zoom out">−</button>
            <button type="button" onClick={() => zoomTo(1)} className="lynx-btn lynx-btn-ghost lynx-btn-sm lynx-mm-zoom-value" title="Reset to 100%">{Math.round(scale * 100)}%</button>
            <button type="button" onClick={() => zoomTo(scale + ZOOM_STEP)} disabled={scale >= 2} className="lynx-btn lynx-btn-ghost lynx-btn-sm" aria-label="Zoom in">+</button>
            <button type="button" onClick={() => setFitting(true)} disabled={fitting} className="lynx-btn lynx-btn-ghost lynx-btn-sm">Fit</button>
          </div>
        )}
      </div>
      {narrow ? map : (
        <div ref={viewport} className="lynx-mm-viewport">
          <div className="lynx-mm-sizer" style={{ width: size.width * scale, height: size.height * scale }}>{map}</div>
        </div>
      )}
      <div className="lynx-row-between lynx-section-gap">
        <p className="lynx-muted lynx-caption">
          {hasNotes
            ? `Each branch ends in a box with a short note and its key points.${narrow ? '' : ' Ctrl + scroll to zoom.'}`
            : 'This map was made before notes were added. Click Rebuild for the full version.'}
        </p>
        <button type="button" onClick={download} className="lynx-btn lynx-btn-ghost lynx-btn-sm">Download as notes</button>
      </div>
    </div>
  );
}
