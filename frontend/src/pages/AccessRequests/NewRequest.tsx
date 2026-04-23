import { useState, useEffect, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { applicationApi, appRoleApi, employeeApi, accessRequestApi } from '../../services/api'
import { Application, AppRole, Employee } from '../../types'

interface ApproverChain {
  manager: Employee | undefined
  appOwner: Employee | undefined
  itSec: Employee[]
}

interface RequestForm {
  applicationId: string
  roleId: string
  businessJustification: string
}

export default function NewRequest() {
  const { currentUser } = useAuth()
  const navigate = useNavigate()

  const [applications, setApplications] = useState<Application[]>([])
  const [roles, setRoles] = useState<AppRole[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [filteredRoles, setFilteredRoles] = useState<AppRole[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const [form, setForm] = useState<RequestForm>({
    applicationId: '',
    roleId: '',
    businessJustification: ''
  })

  useEffect(() => {
    Promise.all([
      applicationApi.getAll({ status: 'active' }),
      appRoleApi.getAll({ status: 'active' }),
      employeeApi.getAll()
    ]).then(([appRes, roleRes, empRes]) => {
      setApplications(appRes.data)
      setRoles(roleRes.data)
      setEmployees(empRes.data)
    })
  }, [])

  useEffect(() => {
    if (form.applicationId) {
      setFilteredRoles(roles.filter(r => r.applicationId === form.applicationId))
      setForm(f => ({ ...f, roleId: '' }))
    } else {
      setFilteredRoles([])
    }
  }, [form.applicationId, roles])

  const getApproverChain = (): ApproverChain | null => {
    if (!form.applicationId) return null
    const app = applications.find(a => a.id === form.applicationId)
    const manager = employees.find(e => e.id === currentUser?.managerId)
    const appOwner = app ? employees.find(e => e.id === app.ownerId) : undefined
    const itSec = employees.filter(e => e.systemRoles.includes('it_security') && e.status === 'active')
    return { manager, appOwner, itSec }
  }

  const chain = getApproverChain()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (!form.applicationId || !form.roleId || !form.businessJustification.trim()) {
      setError('Please fill in all required fields.')
      return
    }
    if (form.businessJustification.trim().length < 20) {
      setError('Business justification must be at least 20 characters.')
      return
    }
    if (!currentUser) return
    setSubmitting(true)
    try {
      await accessRequestApi.create({
        requestorId: currentUser.id,
        applicationId: form.applicationId,
        roleId: form.roleId,
        businessJustification: form.businessJustification.trim()
      })
      setSuccess(true)
      setTimeout(() => navigate('/requests/my'), 1800)
    } catch {
      setError('Failed to submit request. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <div style={{ maxWidth: 560, margin: '60px auto', textAlign: 'center' }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Request Submitted!</h2>
        <p style={{ color: '#5a6478' }}>Your access request has been submitted and is pending manager approval. Redirecting…</p>
      </div>
    )
  }

  const chainItems = chain ? [
    {
      step: 1, label: 'Step 1 — Manager Approval',
      icon: '👤',
      name: chain.manager ? `${chain.manager.firstName} ${chain.manager.lastName}` : 'No manager assigned',
      desc: chain.manager?.title,
      color: '#1d4ed8'
    },
    {
      step: 2, label: 'Step 2 — Application Owner',
      icon: '⬡',
      name: chain.appOwner ? `${chain.appOwner.firstName} ${chain.appOwner.lastName}` : 'Owner not found',
      desc: chain.appOwner?.title,
      color: '#6d28d9'
    },
    {
      step: 3, label: 'Step 3 — IT Security',
      icon: '🔒',
      name: chain.itSec.length > 0
        ? chain.itSec.map(e => `${e.firstName} ${e.lastName}`).join(', ')
        : 'IT Security team',
      desc: 'Security review and final approval',
      color: '#b91c1c'
    }
  ] : []

  return (
    <div style={{ maxWidth: 680 }}>
      <form onSubmit={handleSubmit}>
        <div className="card">
          <div className="card-header">
            <h3>Request Details</h3>
          </div>
          <div className="card-body">
            {error && <div className="alert alert-danger">{error}</div>}

            <div className="form-group">
              <label>Requestor</label>
              <input
                type="text"
                value={`${currentUser?.firstName} ${currentUser?.lastName} — ${currentUser?.department}`}
                disabled
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Application <span className="required">*</span></label>
                <select
                  value={form.applicationId}
                  onChange={e => setForm(f => ({ ...f, applicationId: e.target.value }))}
                >
                  <option value="">— Select application —</option>
                  {applications.map(app => (
                    <option key={app.id} value={app.id}>{app.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Role / Access Level <span className="required">*</span></label>
                <select
                  value={form.roleId}
                  onChange={e => setForm(f => ({ ...f, roleId: e.target.value }))}
                  disabled={!form.applicationId}
                >
                  <option value="">— Select role —</option>
                  {filteredRoles.map(role => (
                    <option key={role.id} value={role.id}>{role.name}</option>
                  ))}
                </select>
                {form.roleId && (
                  <p className="form-hint">
                    {filteredRoles.find(r => r.id === form.roleId)?.description}
                  </p>
                )}
              </div>
            </div>

            <div className="form-group">
              <label>Business Justification <span className="required">*</span></label>
              <textarea
                value={form.businessJustification}
                onChange={e => setForm(f => ({ ...f, businessJustification: e.target.value }))}
                placeholder="Explain why you need this access and how it relates to your job responsibilities…"
                rows={4}
              />
              <p className="form-hint">{form.businessJustification.length} characters (minimum 20)</p>
            </div>
          </div>
        </div>

        {chain && (
          <div className="card mt-4">
            <div className="card-header"><h3>Approval Chain Preview</h3></div>
            <div className="card-body">
              <p className="text-muted text-sm" style={{ marginBottom: 16 }}>
                Your request will go through the following 3-step approval process:
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {chainItems.map(item => (
                  <div key={item.step} style={{
                    display: 'flex', gap: 12, alignItems: 'flex-start',
                    padding: '12px 14px', background: '#f8fafc',
                    borderRadius: 8, border: '1px solid #dde2ec'
                  }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%',
                      background: item.color + '15', color: item.color,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 14, flexShrink: 0, fontWeight: 700
                    }}>
                      {item.step}
                    </div>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.4px', color: '#6b7280', marginBottom: 2 }}>
                        {item.label}
                      </div>
                      <div style={{ fontWeight: 600, fontSize: 13.5 }}>{item.name}</div>
                      {item.desc && <div style={{ fontSize: 12, color: '#6b7280' }}>{item.desc}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="btn-group mt-4">
          <button type="submit" className="btn btn-accent" disabled={submitting}>
            {submitting ? <><span className="spinner"></span> Submitting…</> : '→ Submit Access Request'}
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => navigate('/')}>
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
