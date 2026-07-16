import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../lib/auth-context';
import s from './Layout.module.css';

const LOGO_SQUARES = ['#f2c33c', '#e8583f', '#e85f9c', '#3f6ad8', '#111111', '#3fb6d8', '#7a4fd6', '#2f9e5e', '#f2a33c'];

export function Layout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();

  return (
    <div className={s.shell}>
      <aside className={s.sidebar}>
        <div className={s.brand}>
          <span className={s.brandMark}>
            {LOGO_SQUARES.map((color, i) => (
              <span key={i} style={{ background: color }} />
            ))}
          </span>
          <span className={s.brandWordmark}>
            Plano <em>Visual</em>
          </span>
        </div>

        <nav className={s.nav}>
          <NavLink to="/clients" className={({ isActive }) => `${s.navLink} ${isActive ? s.navLinkActive : ''}`}>
            Clientes
          </NavLink>
        </nav>

        <div className={s.sidebarFooter}>
          {user && <div className={s.userLine}>{user.email}</div>}
          <button className={s.navLink} style={{ textAlign: 'left', border: 'none', background: 'none', cursor: 'pointer' }} onClick={logout}>
            Sair
          </button>
        </div>
      </aside>

      <main className={s.main}>{children}</main>
    </div>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className={s.pageHeader}>
      <div>
        <h1 className={s.pageTitle}>{title}</h1>
        {subtitle && <p className={s.pageSubtitle}>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Breadcrumb({ children }: { children: ReactNode }) {
  return <div className={s.breadcrumb}>{children}</div>;
}
