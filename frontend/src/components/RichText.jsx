import { parseBlocks, parseInline } from '../utils/richText.js';

function Inline({ text, onCite }) {
  return parseInline(text).map((piece, index) => {
    if (piece.type === 'bold') return <strong key={index}>{piece.value}</strong>;
    if (piece.type === 'code') return <code key={index}>{piece.value}</code>;
    if (piece.type === 'cite') {
      return onCite
        ? <button type="button" key={index} className="lynx-cite" onClick={() => onCite(piece.number)} aria-label={`Show source ${piece.number}`}>{piece.number}</button>
        : <sup key={index} className="lynx-cite">{piece.number}</sup>;
    }
    return piece.value;
  });
}

/** Renders an AI answer's light formatting as React elements (never as HTML). */
export default function RichText({ text, onCite }) {
  return (
    <div className="lynx-rich">
      {parseBlocks(text).map((block, index) => {
        if (block.type === 'p') return <p key={index}><Inline text={block.text} onCite={onCite} /></p>;
        const List = block.type === 'ol' ? 'ol' : 'ul';
        return <List key={index}>{block.items.map((item, i) => <li key={i}><Inline text={item} onCite={onCite} /></li>)}</List>;
      })}
    </div>
  );
}
