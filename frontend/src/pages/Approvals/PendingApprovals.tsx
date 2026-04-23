import { useState, useEffect } from 'react'
import { useAuth } from '../../context/AuthContext'
import { accessRequestApi, employeeApi, applicationApi, appRoleApi } from '../../services/api'
import { AccessRequest, Employee, Application, AppRole, RequestStatus, ApprovalStep } from '../../types'

const STAGE_LABELS: Partial<Record<RequestStatus, string>> = {
  pending_manager: 'Pending Manager',
  pending_app_owner: 'Pending App Owner',
  pending_it_security: 'Pending IT Security'
}

const APPROVER_LABELS = ['Manager', 'App Owner', 'IT Security']

const STEP_INDEX_MAP: Partial<Record<RequestStatus, number>> = {
  pending_manager: 0,
  pending_app_owner: 1,
  pending_it_security: 2
}

interface ApproveModalProps {
  request: AccessRequest
  currentUser: Employee
  employees: Employee[]
  applications: Application[]
  roles: AppRole[]
  onClose: () => void
  onAction: (updated: AccessRequest) => void
}

function ApproveModal({ request, currentUser, employees, applications, roles, onClose, onAction }: ApproveModalProps) {
  const [action, setAction] = useState<'approved' | 'rejected' | ''>('')
  const [comments, setComments] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const app = applications.find(a => a.id === request.applicationId)
  const role = roles.find(r => r.id === request.roleId)
  const requestor = employees.find(e => e.id === request.requestorId)
  const manager = requestor ? employees.find(e => e.id === requestor.managerId) : null

  const handleSubmit = async () => {
    if (!action) { setError('Please select Approve or Reject.'); return }
    if (action === 'rejected' && !comments.trim()) {
      setError('Comments are required when rejecting a request.')
      return
    }
    setSubmitting(true)
    try {
      const result = await accessRequestApi.approve(request.id, {
        approverId: currentUser.id,
        action,
        comments: comments.trim()
      })
      onAction(result.data)
      onClose()
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } } }
      setError(axiosErr.response?.data?.error ?? 'Failed to process action. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const getStepIcon = (step: ApprovalStep, idx: number) => {
    const isCurrent = STEP_INDEX_MAP[request.status] === idx
    if (step.action === 'approved') return { icon: '✓', cls: 'approved' }
    if (step.action === 'rejected') return { icon: '✕', cls: 'rejected' }
    if (isCurrent) return { icon: '⏳', cls: 'current' }
    return { icon: '○', cls: 'pending' }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3>Review Access Request</h3>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 3 }}>
              {request.id} · Stage: <strong>{STAGE_LABELS[request.status]}</strong>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr',
            gap: '12px 24px', marginBottom: 20,
            padding: '16px', background: '#f8fafc',
            borderRadius: 8, border: '1px solid #dde2ec'
          }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#6b7280', marginBottom: 3 }}>Requestor</div>
              <div style={{ fontWeight: 600 }}>{requestor ? `${requestor.firstName} ${requestor.lastName}` : request.requestorId}</div>
              <div style={{ fontSize: 12, color: '#6b7280' }}>{requestor?.title} · {requestor?.department}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#6b7280', marginBottom: 3 }}>Manager</div>
              <div style={{ fontWeight: 600 }}>{manager ? `${manager.firstName} ${manager.lastName}` : '—'}</div>
              <div style={{ fontSize: 12, color: '#6b7280' }}>{manager?.title}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#6b7280', marginBottom: 3 }}>Application</div>
              <div style={{ fontWeight: 600 }}>{app?.name}</div>
              <div style={{ fontSize: 12, color: '#6b7280' }}>{app?.category}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#6b7280', marginBottom: 3 }}>Requested Role</div>
              <div style={{ fontWeight: 600 }}>{role?.name}</div>
              <div style={{ fontSize: 12, color: '#6b7280' }}>{role?.description}</div>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#6b7280', marginBottom: 3 }}>Business Justification</div>
              <div style={{ fontSize: 13, lineHeight: 1.6 }}>{request.businessJustification}</div>
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: '#6b7280', marginBottom: 3 }}>Submitted</div>
              <div>{new Date(request.requestedDate).toLocaleString()}</div>
            </div>
          </div>

          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Approval History</div>
            <ul className="timeline">
              {request.approvals.map((step, idx) => {
                const isCurrent = STEP_INDEX_MAP[request.status] === idx
                const { icon, cls } = getStepIcon(step, idx)
                const approver = step.approverId ? employees.find(e => e.id === step.approverId) : null
                return (
                  <li key={idx} className="timeline-item">
                    <div className={`timeline-icon ${cls}`}>{icon}</div>
                    <div className="timeline-content">
                      <div className="timeline-title">Step {idx + 1}: {APPROVER_LABELS[idx]} Approval</div>
                      <div className="timeline-meta">
                        {step.action === 'approved' && approver && `Approved by ${approver.firstName} ${approver.lastName} · ${new Date(step.date!).toLocaleString()}`}
                        {step.action === 'rejected' && approver && `Rejected by ${approver.firstName} ${approver.lastName} · ${new Date(step.date!).toLocaleString()}`}
                        {!step.action && isCurrent && `Awaiting your action (${STAGE_LABELS[request.status]})`}
                        {!step.action && !isCurrent && 'Not yet reached'}
                      </div>
                      {step.comments && <div className="timeline-comment">"{step.comments}"</div>}
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>

          <div className="approve-panel">
            <h4>Your Decision</h4>
            {error && <div className="alert alert-danger" style={{ marginBottom: 12 }}>{error}</div>}
            <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
              <button
                type="button"
                className={`btn ${action === 'approved' ? 'btn-success' : 'btn-secondary'}`}
                onClick={() => { setAction('approved'); setError('') }}
              >
                ✓ Approve
              </button>
              <button
                type="button"
                className={`btn ${action === 'rejected' ? 'btn-danger' : 'btn-secondary'}`}
                onClick={() => { setAction('rejected'); setError('') }}
              >
                ✕ Reject
              </button>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Comments {action === 'rejected' && <span className="required">*</span>}</label>
              <textarea
                value={comments}
                onChange={e => setComments(e.target.value)}
                placeholder={action === 'rejected' ? 'Required: explain why this request is being rejected…' : 'Optional: add any notes for the requestor…'}
                rows={3}
              />
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className={`btn ${action === 'rejected' ? 'btn-danger' : 'btn-accent'}`}
            onClick={handleSubmit}
            disabled={!action || submitting}
          >
            {submitting ? <span className="spinner"></span> : `Submit ${action === 'rejected' ? 'Rejection' : 'Approval'}`}
          </button>
        </div>
      </div>
    </div>
  )
}

interface TabDef {
  key: RequestStatus
  label: string
}

export default function PendingApprovals() {
  const { currentUser, hasRole } = useAuth()
  const [requests, setRequests] = useState<AccessRequest[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [applications, setApplications] = useState<Application[]>([])
  const [roles, setRoles] = useState<AppRole[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<AccessRequest | null>(null)
  const [activeTab, setActiveTab] = useState<RequestStatus | 'all'>('all')

  const load = () => {
    if (!currentUser) return
    Promise.all([
      accessRequestApi.getAll({ approverId: currentUser.id }),
      employeeApi.getAll(),
      applicationApi.getAll(),
      appRoleApi.getAll()
    ]).then(([reqRes, empRes, appRes, roleRes]) => {
      setRequests(reqRes.data.sort((a, b) =>
        new Date(a.requestedDate).getTime() - new Date(b.requestedDate).getTime()
      ))
      setEmployees(empRes.data)
      setApplications(appRes.data)
      setRoles(roleRes.data)
    }).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleAction = (updated: AccessRequest) => {
    setRequests(prev => prev.filter(r => r.id !== updated.id))
    load()
  }

  const getApp = (id: string) => applications.find(a => a.id === id)?.name ?? id
  const getRole = (id: string) => roles.find(r => r.id === id)?.name ?? id
  const getEmp = (id: string) => {
    const e = employees.find(x => x.id === id)
    return e ? `${e.firstName} ${e.lastName}` : id
  }

  const tabs: TabDef[] = []
  if (hasRole('manager')) tabs.push({ key: 'pending_manager', label: 'Manager Approval' })
  if (hasRole('app_owner')) tabs.push({ key: 'pending_app_owner', label: 'App Owner Approval' })
  if (hasRole('it_security')) tabs.push({ key: 'pending_it_security', label: 'IT Security Approval' })

  const displayed = activeTab === 'all' ? requests : requests.filter(r => r.status === activeTab)

  if (loading) return <div className="loading-overlay"><div className="spinner spinner-dark"></div></div>

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Pending Approvals</h2>
          <p>{requests.length} request{requests.length !== 1 ? 's' : ''} awaiting your action</p>
        </div>
      </div>

      {requests.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="icon">🎉</div>
            <h3>All caught up!</h3>
            <p>There are no access requests pending your approval at this time.</p>
          </div>
        </div>
      ) : (
        <div className="card">
          {tabs.length > 1 && (
            <div style={{ padding: '0 20px' }}>
              <div className="tabs">
                <button
                  className={`tab-btn ${activeTab === 'all' ? 'active' : ''}`}
                  onClick={() => setActiveTab('all')}
                >
                  All <span className="tab-badge">{requests.length}</span>
                </button>
                {tabs.map(t => {
                  const count = requests.filter(r => r.status === t.key).length
                  return (
                    <button
                      key={t.key}
                      className={`tab-btn ${activeTab === t.key ? 'active' : ''}`}
                      onClick={() => setActiveTab(t.key)}
                    >
                      {t.label}
                      {count > 0 && <span className="tab-badge">{count}</span>}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Requestor</th>
                  <th>Department</th>
                  <th>Application</th>
                  <th>Role Requested</th>
                  <th>Submitted</th>
                  <th>Stage</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {displayed.map(r => {
                  const requestor = employees.find(e => e.id === r.requestorId)
                  return (
                    <tr key={r.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{getEmp(r.requestorId)}</div>
                        <div className="text-muted text-sm">{requestor?.title}</div>
                      </td>
                      <td>{requestor?.department ?? '—'}</td>
                      <td style={{ fontWeight: 600 }}>{getApp(r.applicationId)}</td>
                      <td>{getRole(r.roleId)}</td>
                      <td>
                        <div>{new Date(r.requestedDate).toLocaleDateString()}</div>
                        <div className="text-muted text-sm">{new Date(r.requestedDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                      </td>
                      <td><span className={`badge badge-${r.status}`}>{STAGE_LABELS[r.status]}</span></td>
                      <td>
                        <button
                          className="btn btn-accent btn-sm"
                          onClick={() => setSelected(r)}
                        >
                          Review →
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selected && currentUser && (
        <ApproveModal
          request={selected}
          currentUser={currentUser}
          employees={employees}
          applications={applications}
          roles={roles}
          onClose={() => setSelected(null)}
          onAction={handleAction}
        />
      )}
    </div>
  )
}
