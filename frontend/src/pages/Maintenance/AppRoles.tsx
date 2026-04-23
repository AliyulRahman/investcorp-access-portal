import { useState, useEffect, FormEvent } from 'react'
import { appRoleApi, applicationApi } from '../../services/api'
import { AppRole, Application, RecordStatus } from '../../types'

type AppRoleFormData = Omit<AppRole, 'id'>

const emptyForm: AppRoleFormData = { applicationId: '', name: '', description: '', status: 'active' }

interface RoleModalProps {
  role: AppRole | null
  applications: Application[]
  onClose: () => void
  onSave: () => void
}

function RoleModal({ role, applications, onClose, onSave }: RoleModalProps) {
  const [form, setForm] = useState<AppRoleFormData>(role ? { ...role } : { ...emptyForm })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const isEdit = !!role

  const validate = (): Record<string, string> => {
    const e: Record<string, string> = {}
    if (!form.applicationId) e.applicationId = 'Required'
    if (!form.name.trim()) e.name = 'Required'
    if (!form.description.trim()) e.description = 'Required'
    return e
  }

  const handleSubmit = async (ev: FormEvent) => {
    ev.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    setSaving(true)
    try {
      if (isEdit && role) {
        await appRoleApi.update(role.id, form)
      } else {
        await appRoleApi.create(form)
      }
      onSave()
      onClose()
    } catch {
      setErrors({ submit: 'Save failed. Please try again.' })
    } finally {
      setSaving(false)
    }
  }

  const activeApps = applications.filter(a => a.status === 'active')

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{isEdit ? 'Edit Role' : 'Add New Role'}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {errors.submit && <div className="alert alert-danger">{errors.submit}</div>}

            <div className="form-group">
              <label>Application <span className="required">*</span></label>
              <select
                value={form.applicationId}
                onChange={e => setForm(f => ({ ...f, applicationId: e.target.value }))}
                disabled={isEdit}
              >
                <option value="">— Select application —</option>
                {activeApps.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              {errors.applicationId && <p className="form-error">{errors.applicationId}</p>}
            </div>

            <div className="form-group">
              <label>Role Name <span className="required">*</span></label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Read Only, Standard User, Administrator"
              />
              {errors.name && <p className="form-error">{errors.name}</p>}
            </div>

            <div className="form-group">
              <label>Description <span className="required">*</span></label>
              <textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Describe what permissions this role grants…"
                rows={3}
              />
              {errors.description && <p className="form-error">{errors.description}</p>}
            </div>

            <div className="form-group">
              <label>Status</label>
              <select
                value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value as RecordStatus }))}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-accent" disabled={saving}>
              {saving ? <span className="spinner"></span> : isEdit ? 'Save Changes' : 'Add Role'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

interface GroupedRoles {
  app: Application
  roles: AppRole[]
}

export default function AppRoles() {
  const [roles, setRoles] = useState<AppRole[]>([])
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<AppRole | null>(null)
  const [filterApp, setFilterApp] = useState('')
  const [filterStatus, setFilterStatus] = useState<RecordStatus | ''>('active')
  const [search, setSearch] = useState('')

  const load = () => {
    setLoading(true)
    Promise.all([appRoleApi.getAll(), applicationApi.getAll()])
      .then(([roleRes, appRes]) => {
        setRoles(roleRes.data)
        setApplications(appRes.data)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleDeactivate = async (role: AppRole) => {
    if (!window.confirm(`Deactivate role "${role.name}"? Employees will no longer be able to request this role.`)) return
    await appRoleApi.deactivate(role.id)
    load()
  }

  const handleReactivate = async (role: AppRole) => {
    await appRoleApi.update(role.id, { ...role, status: 'active' })
    load()
  }

  const getAppName = (id: string) => applications.find(a => a.id === id)?.name ?? id

  const filtered = roles.filter(r => {
    if (filterApp && r.applicationId !== filterApp) return false
    if (filterStatus && r.status !== filterStatus) return false
    if (search && !`${r.name} ${r.description}`.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const grouped = applications.reduce<Record<string, GroupedRoles>>((acc, app) => {
    const appRoles = filtered.filter(r => r.applicationId === app.id)
    if (appRoles.length > 0) acc[app.id] = { app, roles: appRoles }
    return acc
  }, {})

  const showGrouped = !filterApp && !search

  if (loading) return <div className="loading-overlay"><div className="spinner spinner-dark"></div></div>

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Application Roles</h2>
          <p>{roles.filter(r => r.status === 'active').length} active roles across {applications.length} applications</p>
        </div>
        <button className="btn btn-accent" onClick={() => { setEditing(null); setShowModal(true) }}>
          ＋ Add Role
        </button>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="filter-bar" style={{ margin: 0 }}>
            <input
              type="text"
              placeholder="Search roles…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <select value={filterApp} onChange={e => setFilterApp(e.target.value)}>
              <option value="">All Applications</option>
              {applications.filter(a => a.status === 'active').map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value as RecordStatus | '')}
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <span className="text-muted text-sm">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="icon">🔑</div>
            <h3>No roles found</h3>
            <p>Add roles to your applications so employees can request access.</p>
          </div>
        ) : showGrouped ? (
          Object.values(grouped).map(({ app, roles: appRoles }) => (
            <div key={app.id} style={{ borderBottom: '1px solid var(--border)' }}>
              <div style={{
                padding: '10px 20px',
                background: '#f8fafc',
                display: 'flex',
                alignItems: 'center',
                gap: 10
              }}>
                <span style={{ fontWeight: 700, fontSize: 13.5 }}>{app.name}</span>
                <span className="dept-tag">{app.category}</span>
                <span className="text-muted text-sm" style={{ marginLeft: 'auto' }}>{appRoles.length} role{appRoles.length !== 1 ? 's' : ''}</span>
              </div>
              <table style={{ marginBottom: 0 }}>
                <thead>
                  <tr>
                    <th>Role Name</th>
                    <th>Description</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {appRoles.map(role => (
                    <tr key={role.id}>
                      <td style={{ fontWeight: 600 }}>{role.name}</td>
                      <td style={{ color: '#5a6478' }}>{role.description}</td>
                      <td><span className={`badge badge-${role.status}`}>{role.status}</span></td>
                      <td>
                        <div className="btn-group">
                          <button className="btn btn-ghost btn-sm" onClick={() => { setEditing(role); setShowModal(true) }}>Edit</button>
                          {role.status === 'active'
                            ? <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => handleDeactivate(role)}>Deactivate</button>
                            : <button className="btn btn-ghost btn-sm" style={{ color: 'var(--success)' }} onClick={() => handleReactivate(role)}>Reactivate</button>
                          }
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Application</th>
                  <th>Role Name</th>
                  <th>Description</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(role => (
                  <tr key={role.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{getAppName(role.applicationId)}</div>
                    </td>
                    <td style={{ fontWeight: 600 }}>{role.name}</td>
                    <td style={{ color: '#5a6478' }}>{role.description}</td>
                    <td><span className={`badge badge-${role.status}`}>{role.status}</span></td>
                    <td>
                      <div className="btn-group">
                        <button className="btn btn-ghost btn-sm" onClick={() => { setEditing(role); setShowModal(true) }}>Edit</button>
                        {role.status === 'active'
                          ? <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => handleDeactivate(role)}>Deactivate</button>
                          : <button className="btn btn-ghost btn-sm" style={{ color: 'var(--success)' }} onClick={() => handleReactivate(role)}>Reactivate</button>
                        }
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <RoleModal
          role={editing}
          applications={applications}
          onClose={() => { setShowModal(false); setEditing(null) }}
          onSave={load}
        />
      )}
    </div>
  )
}
