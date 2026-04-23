import { useState, useEffect, FormEvent } from 'react'
import { applicationApi, employeeApi } from '../../services/api'
import { Application, Employee, RecordStatus } from '../../types'

const CATEGORIES = ['Financial Data', 'CRM', 'ERP', 'Productivity', 'Analytics', 'Security', 'HR', 'Finance', 'Other']

type ApplicationFormData = Omit<Application, 'id' | 'createdDate'>

const emptyForm: ApplicationFormData = {
  name: '', description: '', ownerId: '',
  category: '', status: 'active'
}

interface ApplicationModalProps {
  application: Application | null
  employees: Employee[]
  onClose: () => void
  onSave: () => void
}

function ApplicationModal({ application, employees, onClose, onSave }: ApplicationModalProps) {
  const [form, setForm] = useState<ApplicationFormData>(application ? { ...application } : { ...emptyForm })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const isEdit = !!application

  const validate = (): Record<string, string> => {
    const e: Record<string, string> = {}
    if (!form.name.trim()) e.name = 'Required'
    if (!form.description.trim()) e.description = 'Required'
    if (!form.ownerId) e.ownerId = 'Required'
    if (!form.category) e.category = 'Required'
    return e
  }

  const handleSubmit = async (ev: FormEvent) => {
    ev.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    setSaving(true)
    try {
      if (isEdit && application) {
        await applicationApi.update(application.id, form)
      } else {
        await applicationApi.create(form)
      }
      onSave()
      onClose()
    } catch {
      setErrors({ submit: 'Save failed. Please try again.' })
    } finally {
      setSaving(false)
    }
  }

  const appOwners = employees.filter(e => e.status === 'active')

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{isEdit ? 'Edit Application' : 'Add New Application'}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {errors.submit && <div className="alert alert-danger">{errors.submit}</div>}

            <div className="form-group">
              <label>Application Name <span className="required">*</span></label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Bloomberg Terminal"
              />
              {errors.name && <p className="form-error">{errors.name}</p>}
            </div>

            <div className="form-group">
              <label>Description <span className="required">*</span></label>
              <textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Describe what this application does and who uses it…"
                rows={3}
              />
              {errors.description && <p className="form-error">{errors.description}</p>}
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Category <span className="required">*</span></label>
                <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                  <option value="">— Select —</option>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                {errors.category && <p className="form-error">{errors.category}</p>}
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

            <div className="form-group">
              <label>Application Owner <span className="required">*</span></label>
              <select value={form.ownerId} onChange={e => setForm(f => ({ ...f, ownerId: e.target.value }))}>
                <option value="">— Select owner —</option>
                {appOwners.map(e => (
                  <option key={e.id} value={e.id}>
                    {e.firstName} {e.lastName} — {e.title}
                  </option>
                ))}
              </select>
              {errors.ownerId && <p className="form-error">{errors.ownerId}</p>}
              <p className="form-hint">The application owner will be the Step 2 approver for access requests to this application.</p>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-accent" disabled={saving}>
              {saving ? <span className="spinner"></span> : isEdit ? 'Save Changes' : 'Add Application'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function Applications() {
  const [applications, setApplications] = useState<Application[]>([])
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Application | null>(null)
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [filterStatus, setFilterStatus] = useState<RecordStatus | ''>('active')

  const load = () => {
    setLoading(true)
    Promise.all([applicationApi.getAll(), employeeApi.getAll()])
      .then(([appRes, empRes]) => {
        setApplications(appRes.data)
        setEmployees(empRes.data)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleDeactivate = async (app: Application) => {
    if (!window.confirm(`Deactivate "${app.name}"? Employees will no longer be able to request access to this application.`)) return
    await applicationApi.deactivate(app.id)
    load()
  }

  const handleReactivate = async (app: Application) => {
    await applicationApi.update(app.id, { ...app, status: 'active' })
    load()
  }

  const getOwner = (ownerId: string) => {
    const e = employees.find(x => x.id === ownerId)
    return e ? `${e.firstName} ${e.lastName}` : '—'
  }

  const filtered = applications.filter(a => {
    if (search && !`${a.name} ${a.description}`.toLowerCase().includes(search.toLowerCase())) return false
    if (filterCat && a.category !== filterCat) return false
    if (filterStatus && a.status !== filterStatus) return false
    return true
  })

  const categories = [...new Set(applications.map(a => a.category))].filter(Boolean).sort()

  if (loading) return <div className="loading-overlay"><div className="spinner spinner-dark"></div></div>

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Application Maintenance</h2>
          <p>{applications.filter(a => a.status === 'active').length} active applications</p>
        </div>
        <button className="btn btn-accent" onClick={() => { setEditing(null); setShowModal(true) }}>
          ＋ Add Application
        </button>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="filter-bar" style={{ margin: 0 }}>
            <input
              type="text"
              placeholder="Search applications…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <select value={filterCat} onChange={e => setFilterCat(e.target.value)}>
              <option value="">All Categories</option>
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
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
            <div className="icon">⬡</div>
            <h3>No applications found</h3>
            <p>Add a new application to get started.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Application</th>
                  <th>Category</th>
                  <th>Application Owner</th>
                  <th>Created</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(app => (
                  <tr key={app.id}>
                    <td>
                      <div style={{ fontWeight: 700 }}>{app.name}</div>
                      <div className="text-muted text-sm" style={{ maxWidth: 300 }}>{app.description}</div>
                    </td>
                    <td><span className="dept-tag">{app.category}</span></td>
                    <td>{getOwner(app.ownerId)}</td>
                    <td>{app.createdDate}</td>
                    <td><span className={`badge badge-${app.status}`}>{app.status}</span></td>
                    <td>
                      <div className="btn-group">
                        <button className="btn btn-ghost btn-sm" onClick={() => { setEditing(app); setShowModal(true) }}>Edit</button>
                        {app.status === 'active'
                          ? <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => handleDeactivate(app)}>Deactivate</button>
                          : <button className="btn btn-ghost btn-sm" style={{ color: 'var(--success)' }} onClick={() => handleReactivate(app)}>Reactivate</button>
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
        <ApplicationModal
          application={editing}
          employees={employees}
          onClose={() => { setShowModal(false); setEditing(null) }}
          onSave={load}
        />
      )}
    </div>
  )
}
