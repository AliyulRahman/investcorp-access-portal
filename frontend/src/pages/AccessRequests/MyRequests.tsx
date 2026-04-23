import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { accessRequestApi, employeeApi, applicationApi, appRoleApi } from '../../services/api'
import { AccessRequest, Employee, Application, AppRole, RequestStatus, ApprovalStep } from '../../types'

const STATUS_LABELS: Record<RequestStatus, string> = {
  pending_manager: 'Pending Manager',
  pending_app_owner: 'Pending App Owner',
  pending_it_security: 'Pending IT Security',
  approved: 'Approved',
  rejected: 'Rejected',
  cancelled: 'Cancelled'
}

const APPROVER_LABELS = ['Manager', 'App Owner', 'IT Security']

type StepState = 'done' | 'rejected' | 'current' | 'pending'

const CURRENT_MAP: Partial<Record<RequestStatus, number>> = {
  pending_manager: 0,
  pending_app_owner: 1,
  pending_it_security: 2
}

interface RequestDetailProps {
  request: AccessRequest
  employees: Employee[]
  applications: Application[]
  roles: AppRole[]
  onClose: () => void
  onCancel: (id: string) => void
}

function RequestDetail({ request, employees, applications, roles, onClose, onCancel }: RequestDetailProps) {
  const app = applications.find(a => a.id === request.applicationId)
  const role = roles.find(r => r.id === request.roleId)

  const getApprovalIcon = (action: ApprovalStep['action'], isCurrent: boolean, status: RequestStatus) => {
    if (action === 'approved') return { icon: '✓', cls: 'approved' }
    if (action === 'rejected') return { icon: '✕', cls: 'rejected' }
    if (isCurrent && !['approved', 'rejected', 'cancelled'].includes(status)) return { icon: '⏳', cls: 'current' }
    return { icon: '○', cls: 'pending' }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3>Request #{request.id}</h3>
            <span className={`badge badge-${request.status}`} style={{ marginTop: 4, display: 'inline-flex' }}>
              {STATUS_LABELS[request.status]}
            </span>
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <div className="request-detail-grid" style={{ marginBottom: 20 }}>
            <div className="detail-item">
              <label>Application</label>
              <p style={{ fontWeight: 600 }}>{app?.name ?? request.applicationId}</p>
              <p className="text-muted text-sm">{app?.category}</p>
            </div>
            <div className="detail-item">
              <label>Requested Role</label>
              <p style={{ fontWeight: 600 }}>{role?.name ?? request.roleId}</p>
              <p className="text-muted text-sm">{role?.description}</p>
            </div>
            <div className="detail-item">
              <label>Submitted On</label>
              <p>{new Date(request.requestedDate).toLocaleString()}</p>
            </div>
            <div className="detail-item">
              <label>Request ID</label>
              <p style={{ fontFamily: 'monospace' }}>{request.id}</p>
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', color: '#6b7280' }}>
              Business Justification
            </label>
            <p style={{
              marginTop: 6, padding: '10px 14px',
              background: '#f8fafc', borderRadius: 8,
              border: '1px solid #dde2ec', fontSize: 13.5, lineHeight: 1.6
            }}>
              {request.businessJustification}
            </p>
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', color: '#6b7280', marginBottom: 12, display: 'block' }}>
              Approval Timeline
            </label>
            <ul className="timeline">
              {request.approvals.map((step, idx) => {
                const isCurrent = CURRENT_MAP[request.status] === idx
                const { icon, cls } = getApprovalIcon(step.action, isCurrent, request.status)
                const approver = step.approverId ? employees.find(e => e.id === step.approverId) : null
                return (
                  <li key={idx} className="timeline-item">
                    <div className={`timeline-icon ${cls}`}>{icon}</div>
                    <div className="timeline-content">
                      <div className="timeline-title">Step {idx + 1}: {APPROVER_LABELS[idx]} Approval</div>
                      <div className="timeline-meta">
                        {step.action === 'approved' && approver && `Approved by ${approver.firstName} ${approver.lastName}`}
                        {step.action === 'rejected' && approver && `Rejected by ${approver.firstName} ${approver.lastName}`}
                        {!step.action && isCurrent && 'Awaiting approval'}
                        {!step.action && !isCurrent && cls !== 'rejected' && 'Not yet reached'}
                        {step.date && ` · ${new Date(step.date).toLocaleString()}`}
                      </div>
                      {step.comments && <div className="timeline-comment">"{step.comments}"</div>}
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        </div>
        <div className="modal-footer">
          {['pending_manager', 'rejected'].includes(request.status) && (
            <button className="btn btn-danger" onClick={() => onCancel(request.id)}>
              Cancel Request
            </button>
          )}
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}

export default function MyRequests() {
  const { currentUser } = useAuth()
  const [requests, setRequests] = useState<AccessRequest[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [applications, setApplications] = useState<Application[]>([])
  const [roles, setRoles] = useState<AppRole[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<AccessRequest | null>(null)
  const [filterStatus, setFilterStatus] = useState<RequestStatus | ''>('')

  const load = () => {
    if (!currentUser) return
    Promise.all([
      accessRequestApi.getAll({ requestorId: currentUser.id }),
      employeeApi.getAll(),
      applicationApi.getAll(),
      appRoleApi.getAll()
    ]).then(([reqRes, empRes, appRes, roleRes]) => {
      setRequests(reqRes.data.sort((a, b) =>
        new Date(b.requestedDate).getTime() - new Date(a.requestedDate).getTime()
      ))
      setEmployees(empRes.data)
      setApplications(appRes.data)
      setRoles(roleRes.data)
    }).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleCancel = async (id: string) => {
    if (!window.confirm('Cancel this access request?')) return
    await accessRequestApi.cancel(id)
    setSelected(null)
    load()
  }

  const filtered = filterStatus ? requests.filter(r => r.status === filterStatus) : requests

  const getApp = (id: string) => applications.find(a => a.id === id)?.name ?? id
  const getRole = (id: string) => roles.find(r => r.id === id)?.name ?? id

  const getStepState = (step: ApprovalStep, idx: number, status: RequestStatus): StepState => {
    if (step.action === 'approved') return 'done'
    if (step.action === 'rejected') return 'rejected'
    if (CURRENT_MAP[status] === idx) return 'current'
    return 'pending'
  }

  if (loading) return <div className="loading-overlay"><div className="spinner spinner-dark"></div></div>

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>My Access Requests</h2>
          <p>{requests.length} total request{requests.length !== 1 ? 's' : ''}</p>
        </div>
        <Link to="/requests/new" className="btn btn-accent">＋ New Request</Link>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="filter-bar" style={{ margin: 0 }}>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value as RequestStatus | '')}
              style={{ minWidth: 200 }}
            >
              <option value="">All Statuses</option>
              {(Object.entries(STATUS_LABELS) as [RequestStatus, string][]).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>
          <span className="text-muted text-sm">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="icon">📂</div>
            <h3>No requests found</h3>
            <p>You haven't submitted any access requests yet. Click "New Request" to get started.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Application</th>
                  <th>Role</th>
                  <th>Date Submitted</th>
                  <th>Approval Progress</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id}>
                    <td style={{ fontFamily: 'monospace', color: '#6b7280', fontSize: 12 }}>{r.id}</td>
                    <td style={{ fontWeight: 600 }}>{getApp(r.applicationId)}</td>
                    <td>{getRole(r.roleId)}</td>
                    <td>{new Date(r.requestedDate).toLocaleDateString()}</td>
                    <td>
                      <div className="approval-steps">
                        {r.approvals.map((step, idx) => (
                          <div key={idx} className="step-item">
                            {idx > 0 && <div className={`step-line ${r.approvals[idx - 1].action === 'approved' ? 'done' : ''}`}></div>}
                            <div
                              className={`step-dot ${getStepState(step, idx, r.status)}`}
                              title={APPROVER_LABELS[idx]}
                            >
                              {getStepState(step, idx, r.status) === 'done' ? '✓' :
                                getStepState(step, idx, r.status) === 'rejected' ? '✕' : idx + 1}
                            </div>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td><span className={`badge badge-${r.status}`}>{STATUS_LABELS[r.status]}</span></td>
                    <td>
                      <button className="btn btn-ghost btn-sm" onClick={() => setSelected(r)}>
                        Details
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
        <RequestDetail
          request={selected}
          employees={employees}
          applications={applications}
          roles={roles}
          onClose={() => setSelected(null)}
          onCancel={handleCancel}
        />
      )}
    </div>
  )
}
