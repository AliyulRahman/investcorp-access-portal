import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { accessRequestApi, employeeApi, applicationApi, appRoleApi } from '../services/api'
import { AccessRequest, Employee, Application, AppRole, RequestStatus, ApprovalStep } from '../types'

const STATUS_LABELS: Record<RequestStatus, string> = {
  pending_manager: 'Pending Manager',
  pending_app_owner: 'Pending App Owner',
  pending_it_security: 'Pending IT Security',
  approved: 'Approved',
  rejected: 'Rejected',
  cancelled: 'Cancelled'
}

type StepState = 'done' | 'rejected' | 'current' | 'pending'

const CURRENT_MAP: Partial<Record<RequestStatus, number>> = {
  pending_manager: 0,
  pending_app_owner: 1,
  pending_it_security: 2
}

interface ApprovalStepsProps {
  approvals: ApprovalStep[]
  status: RequestStatus
}

function ApprovalSteps({ approvals, status }: ApprovalStepsProps) {
  const getState = (step: ApprovalStep, idx: number): StepState => {
    if (step.action === 'approved') return 'done'
    if (step.action === 'rejected') return 'rejected'
    if (status === 'rejected' && step.action === null && approvals.slice(0, idx).every(s => s.action === 'approved')) return 'rejected'
    if (CURRENT_MAP[status] === idx) return 'current'
    return 'pending'
  }

  return (
    <div className="approval-steps">
      {approvals.map((step, idx) => (
        <div key={idx} className="step-item">
          {idx > 0 && <div className={`step-line ${approvals[idx - 1].action === 'approved' ? 'done' : ''}`}></div>}
          <div
            className={`step-dot ${getState(step, idx)}`}
            title={(['Manager', 'App Owner', 'IT Security'])[idx]}
          >
            {getState(step, idx) === 'done' ? '✓' :
              getState(step, idx) === 'rejected' ? '✕' : idx + 1}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function Dashboard() {
  const { currentUser, canApprove, isAdmin } = useAuth()
  const navigate = useNavigate()
  const [myRequests, setMyRequests] = useState<AccessRequest[]>([])
  const [pendingApprovals, setPendingApprovals] = useState<AccessRequest[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [applications, setApplications] = useState<Application[]>([])
  const [roles, setRoles] = useState<AppRole[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!currentUser) return
    const fetches: Promise<unknown>[] = [
      accessRequestApi.getAll({ requestorId: currentUser.id }),
      employeeApi.getAll(),
      applicationApi.getAll(),
      appRoleApi.getAll()
    ]
    if (canApprove()) fetches.push(accessRequestApi.getAll({ approverId: currentUser.id }))

    Promise.all(fetches).then(results => {
      const [reqRes, empRes, appRes, rolesRes, pendingRes] = results as [
        Awaited<ReturnType<typeof accessRequestApi.getAll>>,
        Awaited<ReturnType<typeof employeeApi.getAll>>,
        Awaited<ReturnType<typeof applicationApi.getAll>>,
        Awaited<ReturnType<typeof appRoleApi.getAll>>,
        Awaited<ReturnType<typeof accessRequestApi.getAll>> | undefined
      ]
      setMyRequests(reqRes.data)
      setEmployees(empRes.data)
      setApplications(appRes.data)
      setRoles(rolesRes.data)
      if (pendingRes) setPendingApprovals(pendingRes.data)
    }).finally(() => setLoading(false))
  }, [])

  const getName = (id: string) => {
    const e = employees.find(x => x.id === id)
    return e ? `${e.firstName} ${e.lastName}` : id
  }
  const getApp = (id: string) => applications.find(x => x.id === id)?.name ?? id
  const getRole = (id: string) => roles.find(x => x.id === id)?.name ?? id

  const activeStatuses: RequestStatus[] = ['pending_manager', 'pending_app_owner', 'pending_it_security']
  const activeRequests = myRequests.filter(r => activeStatuses.includes(r.status))
  const approvedRequests = myRequests.filter(r => r.status === 'approved')
  const recentRequests = [...myRequests]
    .sort((a, b) => new Date(b.requestedDate).getTime() - new Date(a.requestedDate).getTime())
    .slice(0, 5)

  if (loading) return <div className="loading-overlay"><div className="spinner spinner-dark"></div></div>

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Welcome back, {currentUser?.firstName}!</h2>
          <p>{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        <Link to="/requests/new" className="btn btn-accent">
          ＋ New Access Request
        </Link>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon blue">📋</div>
          <div>
            <div className="stat-value">{activeRequests.length}</div>
            <div className="stat-label">Active Requests</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green">✅</div>
          <div>
            <div className="stat-value">{approvedRequests.length}</div>
            <div className="stat-label">Approved</div>
          </div>
        </div>
        {canApprove() && (
          <Link to="/approvals" className="stat-card" style={{ textDecoration: 'none', color: 'inherit', cursor: 'pointer' }}>
            <div className="stat-icon orange">⏳</div>
            <div>
              <div className="stat-value">{pendingApprovals.length}</div>
              <div className="stat-label">Pending My Approval</div>
            </div>
          </Link>
        )}
        <div className="stat-card">
          <div className="stat-icon purple">📁</div>
          <div>
            <div className="stat-value">{myRequests.length}</div>
            <div className="stat-label">Total Requests</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: canApprove() ? '1fr 1fr' : '1fr', gap: 20 }}>
        <div className="card">
          <div className="card-header">
            <h3>My Recent Requests</h3>
            <Link to="/requests/my" className="btn btn-ghost btn-sm">View All →</Link>
          </div>
          {recentRequests.length === 0 ? (
            <div className="empty-state" style={{ padding: 40 }}>
              <div className="icon">📂</div>
              <h3>No requests yet</h3>
              <p>Submit your first access request to get started.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Application / Role</th>
                    <th>Progress</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentRequests.map(r => (
                    <tr key={r.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{getApp(r.applicationId)}</div>
                        <div className="text-muted text-sm">{getRole(r.roleId)}</div>
                      </td>
                      <td><ApprovalSteps approvals={r.approvals} status={r.status} /></td>
                      <td><span className={`badge badge-${r.status}`}>{STATUS_LABELS[r.status]}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {canApprove() && (
          <div className="card">
            <div className="card-header">
              <h3>Pending My Approval</h3>
              <Link to="/approvals" className="btn btn-ghost btn-sm">View All →</Link>
            </div>
            {pendingApprovals.length === 0 ? (
              <div className="empty-state" style={{ padding: 40 }}>
                <div className="icon">🎉</div>
                <h3>All caught up!</h3>
                <p>No pending approvals at this time.</p>
              </div>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Requestor</th>
                      <th>Application / Role</th>
                      <th>Stage</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingApprovals.slice(0, 5).map(r => (
                      <tr key={r.id} className="tr-clickable" onClick={() => navigate('/approvals')}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{getName(r.requestorId)}</div>
                          <div className="text-muted text-sm">{new Date(r.requestedDate).toLocaleDateString()}</div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{getApp(r.applicationId)}</div>
                          <div className="text-muted text-sm">{getRole(r.roleId)}</div>
                        </td>
                        <td><span className={`badge badge-${r.status}`}>{STATUS_LABELS[r.status]}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {isAdmin() && (
        <div className="card mt-6">
          <div className="card-header"><h3>Quick Links — Administration</h3></div>
          <div className="card-body" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Link to="/maintenance/employees" className="btn btn-secondary">👥 Manage Employees</Link>
            <Link to="/maintenance/applications" className="btn btn-secondary">⬡ Manage Applications</Link>
            <Link to="/maintenance/app-roles" className="btn btn-secondary">🔑 Manage App Roles</Link>
          </div>
        </div>
      )}
    </div>
  )
}
