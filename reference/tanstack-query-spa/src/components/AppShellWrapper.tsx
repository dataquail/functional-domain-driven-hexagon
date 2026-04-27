import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { IconHome, IconArchive, IconPencil } from './icons';

type Props = {
  children: React.ReactNode;
};

export const AppShellWrapper = ({ children }: Props) => {
  const [mobileOpened, setMobileOpened] = useState(false);
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  return (
    <div className="app-layout">
      <header className="app-header">
        <div className="avatar">
          <IconPencil size="1.25rem" />
        </div>
        <button
          type="button"
          className={`burger-btn ${mobileOpened ? 'open' : ''}`}
          onClick={() => setMobileOpened((o) => !o)}
          aria-label="Toggle navigation"
        >
          <span />
          <span />
          <span />
        </button>
      </header>

      <nav className={`app-nav ${mobileOpened ? 'open' : ''}`}>
        <Link
          to="/"
          className={`nav-link ${isActive('/') ? 'active' : ''}`}
          onClick={() => setMobileOpened(false)}
        >
          <IconHome /> Active Todos
        </Link>
        <Link
          to="/archived"
          className={`nav-link ${isActive('/archived') ? 'active' : ''}`}
          onClick={() => setMobileOpened(false)}
        >
          <IconArchive /> Archived Todos
        </Link>
        <Link
          to="/review"
          className={`nav-link ${isActive('/review') ? 'active' : ''}`}
          onClick={() => setMobileOpened(false)}
        >
          <IconPencil /> Review Todos
        </Link>
      </nav>

      <main className="app-main">{children}</main>
    </div>
  );
};
