'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BOARDS } from '../lib/boards';
import Icon from './Icon';

export default function Sidebar() {
  const pathname = usePathname();
  return (
    <nav className="side">
      {BOARDS.map((board) => (
        <div className="group" key={board.id}>
          <div className="gh">
            <span className={`dot ${board.dot}`} /> {board.name}
          </div>
          <div className="nav">
            {board.panels.map((panel) => {
              const href = panel.key === 'overview' ? `/${board.id}` : `/${board.id}/${panel.key}`;
              const active = pathname === href;
              return (
                <Link key={panel.key} href={href} className={active ? 'active' : ''}>
                  <Icon name={panel.icon} /> {panel.nav}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}
