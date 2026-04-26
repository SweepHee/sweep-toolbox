import { NavLink } from 'react-router-dom';
import { ArrowLeftRight, Clock, StickyNote, Settings } from 'lucide-react';

const navItems = [
  { to: '/', icon: ArrowLeftRight, label: '변환' },
  { to: '/history', icon: Clock, label: '이력' },
  { to: '/notes', icon: StickyNote, label: '메모' },
  { to: '/settings', icon: Settings, label: '설정' },
];

export default function Sidebar() {
  return (
    <aside className="w-16 flex flex-col items-center py-4 gap-2 bg-[#0d0d1a] border-r border-white/5 shrink-0">
      {navItems.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) =>
            `flex flex-col items-center justify-center w-12 h-12 rounded-xl gap-1 transition-all text-xs font-medium ` +
            (isActive
              ? 'bg-indigo-500/20 text-indigo-400'
              : 'text-white/30 hover:text-white/70 hover:bg-white/5')
          }
          title={label}
        >
          <Icon size={20} />
        </NavLink>
      ))}
    </aside>
  );
}
