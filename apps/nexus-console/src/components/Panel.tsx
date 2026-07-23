import type { Block, Cell, Panel as PanelType } from '../lib/boards';
import Icon from './Icon';
import LiveHealth from './LiveHealth';

function Badge({ text, variant }: { text: string; variant?: string }) {
  return <span className={`badge ${variant ?? ''}`.trim()}>{text}</span>;
}

function renderCell(cell: Cell, i: number) {
  if (typeof cell === 'string') return <td key={i}>{cell}</td>;
  return (
    <td key={i}>
      <Badge text={cell.badge} variant={cell.variant} />
    </td>
  );
}

function renderBlock(block: Block, i: number) {
  if (block.type === 'cards') {
    return (
      <div className="cards" key={i}>
        {block.items.map((it, j) => (
          <div className="card" key={j}>
            <p className="t">
              <Icon name={it.icon} /> {it.title}
            </p>
            {it.kpi !== undefined && <div className="kpi">{it.kpi}</div>}
            {it.desc && <p className="d">{it.desc}</p>}
            {it.badge && (
              <p style={{ marginTop: 8 }}>
                <Badge text={it.badge.text} variant={it.badge.variant} />
              </p>
            )}
          </div>
        ))}
      </div>
    );
  }
  if (block.type === 'table') {
    return (
      <table key={i}>
        <thead>
          <tr>{block.head.map((h, j) => <th key={j}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {block.rows.length === 0 ? (
            <tr>
              <td className="empty" colSpan={block.head.length}>
                {block.empty ?? '暂无数据'}
              </td>
            </tr>
          ) : (
            block.rows.map((row, r) => <tr key={r}>{row.map((c, k) => renderCell(c, k))}</tr>)
          )}
        </tbody>
      </table>
    );
  }
  if (block.type === 'live') {
    return <LiveHealth key={i} />;
  }
  return (
    <div className="note" key={i}>
      {block.text}
    </div>
  );
}

export default function Panel({ panel }: { panel: PanelType }) {
  return (
    <>
      <div className="crumb">{panel.crumb}</div>
      <h1 className="h1">{panel.h1}</h1>
      <p className="sub">{panel.sub}</p>
      {panel.blocks.map((b, i) => renderBlock(b, i))}
    </>
  );
}
