import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useEffect, useState } from 'react'
import { accessRequestApi } from '../services/api'
import { SystemRole } from '../types'

const ROLE_LABELS: Record<SystemRole, string> = {
  manager: 'Manager',
  app_owner: 'App Owner',
  it_security: 'IT Security',
  admin: 'Admin',
  employee: 'Employee'
}

interface PageMeta {
  title: string
  sub: string
}

export default function Layout() {
  const { currentUser, logout, canApprove, isAdmin } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    if (canApprove() && currentUser) {
      accessRequestApi.getAll({ approverId: currentUser.id })
        .then(res => setPendingCount(res.data.length))
        .catch(() => {})
    }
  }, [location.pathname])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const initials = `${currentUser?.firstName?.[0] ?? ''}${currentUser?.lastName?.[0] ?? ''}`

  const getPageTitle = (): PageMeta => {
    const p = location.pathname
    if (p === '/') return { title: 'Dashboard', sub: 'Overview of your access requests and approvals' }
    if (p === '/requests/new') return { title: 'New Access Request', sub: 'Request access to an application' }
    if (p === '/requests/my') return { title: 'My Requests', sub: 'View and manage your access requests' }
    if (p === '/approvals') return { title: 'Pending Approvals', sub: 'Review and action access requests awaiting your approval' }
    if (p === '/maintenance/employees') return { title: 'Employee Maintenance', sub: 'Manage employee records and system roles' }
    if (p === '/maintenance/applications') return { title: 'Application Maintenance', sub: 'Manage applications and their owners' }
    if (p === '/maintenance/app-roles') return { title: 'Application Roles', sub: 'Manage roles available per application' }
    return { title: 'Investcorp Access Portal', sub: '' }
  }

  const { title, sub } = getPageTitle()

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <h1>Invest<span>corp</span></h1>
          <p>Access Portal</p>
        </div>

        <div className="sidebar-user">
          <div className="sidebar-avatar">{initials}</div>
          <div className="sidebar-user-info">
            <div className="name">{currentUser?.firstName} {currentUser?.lastName}</div>
            <div className="role-tags">
              {currentUser?.systemRoles?.map(r => (
                <span key={r} className={`role-tag ${r}`}>{ROLE_LABELS[r] ?? r}</span>
              ))}
            </div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section-label">Main</div>
          <NavLink to="/" end className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <span className="icon">⊞</span> Dashboard
          </NavLink>

          <div className="nav-section-label">Access Requests</div>
          <NavLink to="/requests/new" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <span className="icon">＋</span> New Request
          </NavLink>
          <NavLink to="/requests/my" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <span className="icon">☰</span> My Requests
          </NavLink>

          {canApprove() && (
            <>
              <div className="nav-section-label">Approvals</div>
              <NavLink to="/approvals" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                <span className="icon">✓</span> Pending Approvals
                {pendingCount > 0 && <span className="nav-badge">{pendingCount}</span>}
              </NavLink>
            </>
          )}

          {isAdmin() && (
            <>
              <div className="nav-section-label">Maintenance</div>
              <NavLink to="/maintenance/employees" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                <span className="icon">👥</span> Employees
              </NavLink>
              <NavLink to="/maintenance/applications" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                <span className="icon">⬡</span> Applications
              </NavLink>
              <NavLink to="/maintenance/app-roles" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                <span className="icon">🔑</span> App Roles
              </NavLink>
            </>
          )}
        </nav>

        <div className="sidebar-footer">
          <button className="logout-btn" onClick={handleLogout}>
            ⎋ Sign Out
          </button>
        </div>
      </aside>

      <div className="main-content">
        <header className="topbar">
          <div>
            <div className="topbar-title">{title}</div>
            {sub && <div className="topbar-subtitle">{sub}</div>}
          </div>
        </header>
        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
