import { Link, NavLink, Outlet } from 'react-router-dom'

export default function Layout() {
  return (
    <div className="site">
      <header className="site-header">
        <Link to="/" className="site-logo" aria-label="Página inicial do Quina">
          <span className="logo__tile logo__tile--a">Q</span>
          <span className="logo__tile logo__tile--b">U</span>
          <span className="logo__tile logo__tile--a">I</span>
          <span className="logo__tile logo__tile--b">N</span>
          <span className="logo__tile logo__tile--a">A</span>
        </Link>
        <nav className="site-nav">
          <NavLink to="/palavras" className={({ isActive }) => `site-nav__link${isActive ? ' site-nav__link--active' : ''}`}>
            Palavras
          </NavLink>
          <NavLink to="/fiada" className={({ isActive }) => `site-nav__link${isActive ? ' site-nav__link--active' : ''}`}>
            Fiada
          </NavLink>
        </nav>
      </header>
      <Outlet />
    </div>
  )
}