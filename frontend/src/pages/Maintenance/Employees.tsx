import { useState, useEffect, FormEvent } from 'react'
import { employeeApi } from '../../services/api'
import { Employee, SystemRole, RecordStatus } from '../../types'

const ALL_ROLES: SystemRole[] = ['employee', 'manager', 'app_owner', 'it_security', 'admin']
const ROLE_LABELS: Record<SystemRole, string> = {
  employee: 'Employee',
  manager: 'Manager',
  app_owner: 'App Owner',
  it_security: 'IT Security',
  admin: 'Admin'
}

const DEPARTMENTS = ['Technology', 'Finance', 'Sales', 'IT Security', 'Executive', 'Operations', 'Risk Management', 'Legal', 'HR']

type EmployeeFormData = Omit<Employee, 'id'>

const emptyForm: EmployeeFormData = {
  firstName: '', lastName: '', email: '', phone: '',
  department: '', title: '', managerId: null, systemRoles: ['employee'],
  joiningDate: new Date().toISOString().split('T')[0], status: 'active'
}

interface EmployeeModalProps {
  employee: Employee | null
  employees: Employee[]
  onClose: () => void
  onSave: () => void
}

function EmployeeModal({ employee, employees, onClose, onSave }: EmployeeModalProps) {
  const [form, setForm] = useState<EmployeeFormData>(employee ? { ...employee } : { ...emptyForm })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  const isEdit = !!employee

  const validate = (): Record<string, string> => {
    const e: Record<string, string> = {}
    if (!form.firstName.trim()) e.firstName = 'Required'
    if (!form.lastName.trim()) e.lastName = 'Required'
    if (!form.email.trim()) e.email = 'Required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Invalid email'
    if (!form.department) e.department = 'Required'
    if (!form.title.trim()) e.title = 'Required'
    if (form.systemRoles.length === 0) e.systemRoles = 'Select at least one role'
    return e
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    setSaving(true)
    try {
      if (isEdit && employee) {
        await employeeApi.update(employee.id, form)
      } else {
        await employeeApi.create(form)
      }
      onSave()
      onClose()
    } catch {
      setErrors({ submit: 'Save failed. Please try again.' })
    } finally {
      setSaving(false)
    }
  }

  const toggleRole = (role: SystemRole) => {
    setForm(f => ({
      ...f,
      systemRoles: f.systemRoles.includes(role)
        ? f.systemRoles.filter(r => r !== role)
        : [...f.systemRoles, role]
    }))
  }

  const managers = employees.filter(e =>
    e.systemRoles.includes('manager') && e.status === 'active' &&
    (!isEdit || e.id !== employee?.id)
  )

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{isEdit ? 'Edit Employee' : 'Add New Employee'}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {errors.submit && <div className="alert alert-danger">{errors.submit}</div>}

            <div className="workday-note">
              ℹ️ <span>In production, employee data will be automatically synced from <strong>Workday</strong> (HR system).</span>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>First Name <span className="required">*</span></label>
                <input type="text" value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} />
                {errors.firstName && <p className="form-error">{errors.firstName}</p>}
              </div>
              <div className="form-group">
                <label>Last Name <span className="required">*</span></label>
                <input type="text" value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} />
                {errors.lastName && <p className="form-error">{errors.lastName}</p>}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Email Address <span className="required">*</span></label>
                <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="name@investcorp.com" />
                {errors.email && <p className="form-error">{errors.email}</p>}
              </div>
              <div className="form-group">
                <label>Phone</label>
                <input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+1-212-555-0000" />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Department <span className="required">*</span></label>
                <select value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))}>
                  <option value="">— Select —</option>
                  {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                {errors.department && <p className="form-error">{errors.department}</p>}
              </div>
              <div className="form-group">
                <label>Job Title <span className="required">*</span></label>
                <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Senior Analyst" />
                {errors.title && <p className="form-error">{errors.title}</p>}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Direct Manager</label>
                <select
                  value={form.managerId ?? ''}
                  onChange={e => setForm(f => ({ ...f, managerId: e.target.value || null }))}
                >
                  <option value="">— No manager (top-level) —</option>
                  {managers.map(m => (
                    <option key={m.id} value={m.id}>{m.firstName} {m.lastName} — {m.title}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Joining Date</label>
                <input type="date" value={form.joiningDate} onChange={e => setForm(f => ({ ...f, joiningDate: e.target.value }))} />
              </div>
            </div>

            <div className="form-group">
              <label>System Roles <span className="required">*</span></label>
              <div className="roles-checkboxes">
                {ALL_ROLES.map(role => (
                  <label key={role} className="role-checkbox">
                    <input
                      type="checkbox"
                      checked={form.systemRoles.includes(role)}
                      onChange={() => toggleRole(role)}
                    />
                    {ROLE_LABELS[role]}
                  </label>
                ))}
              </div>
              {errors.systemRoles && <p className="form-error">{errors.systemRoles}</p>}
              <p className="form-hint">
                Manager = can approve team requests · App Owner = can approve for owned apps · IT Security = final approval step · Admin = maintenance screens
              </p>
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
              {saving ? <span className="spinner"></span> : isEdit ? 'Save Changes' : 'Add Employee'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function Employees() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Employee | null>(null)
  const [search, setSearch] = useState('')
  const [filterDept, setFilterDept] = useState('')
  const [filterStatus, setFilterStatus] = useState<RecordStatus | ''>('active')
  const [filterManager, setFilterManager] = useState('')

  const load = () => {
    setLoading(true)
    employeeApi.getAll().then(res => setEmployees(res.data)).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleDeactivate = async (emp: Employee) => {
    if (!window.confirm(`Deactivate ${emp.firstName} ${emp.lastName}? They will no longer be able to use the portal.`)) return
    await employeeApi.deactivate(emp.id)
    load()
  }

  const handleReactivate = async (emp: Employee) => {
    await employeeApi.update(emp.id, { ...emp, status: 'active' })
    load()
  }

  const getManager = (managerId: string | null) => {
    if (!managerId) return '—'
    const m = employees.find(e => e.id === managerId)
    return m ? `${m.firstName} ${m.lastName}` : '—'
  }

  const filtered = employees.filter(e => {
    const name = `${e.firstName} ${e.lastName} ${e.email} ${e.title}`.toLowerCase()
    if (search && !name.includes(search.toLowerCase())) return false
    if (filterDept && e.department !== filterDept) return false
    if (filterStatus && e.status !== filterStatus) return false
    if (filterManager && e.managerId !== filterManager) return false
    return true
  })

  const departments = [...new Set(employees.map(e => e.department))].sort()
  const managerOptions = employees.filter(e => employees.some(emp => emp.managerId === e.id))
    .sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`))

  if (loading) return <div className="loading-overlay"><div className="spinner spinner-dark"></div></div>

  return (
    <div>
      <div className="page-header">
        <div>
          <h2>Employee Maintenance</h2>
          <p>{employees.filter(e => e.status === 'active').length} active employees</p>
        </div>
        <button className="btn btn-accent" onClick={() => { setEditing(null); setShowModal(true) }}>
          ＋ Add Employee
        </button>
      </div>

      <div className="workday-note">
        ℹ️ <strong>Future Integration:</strong> Employee records will be automatically synchronized from <strong>Workday</strong> (HR System). Manual entry is available for this POC phase.
      </div>

      <div className="card">
        <div className="card-header">
          <div className="filter-bar" style={{ margin: 0 }}>
            <input
              type="text"
              placeholder="Search by name, email, title…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <select value={filterDept} onChange={e => setFilterDept(e.target.value)}>
              <option value="">All Departments</option>
              {departments.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <select value={filterManager} onChange={e => setFilterManager(e.target.value)}>
              <option value="">All Managers</option>
              {managerOptions.map(m => (
                <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>
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
            <div className="icon">👥</div>
            <h3>No employees found</h3>
            <p>Adjust your filters or add a new employee.</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Department</th>
                  <th>Title</th>
                  <th>Manager</th>
                  <th>System Roles</th>
                  <th>Joined</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(emp => (
                  <tr key={emp.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 34, height: 34, borderRadius: '50%',
                          background: emp.status === 'active' ? '#0f2d4e' : '#dde2ec',
                          color: emp.status === 'active' ? 'white' : '#9ca3af',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontWeight: 700, fontSize: 12, flexShrink: 0
                        }}>
                          {emp.firstName[0]}{emp.lastName[0]}
                        </div>
                        <div>
                          <div className="full-name">{emp.firstName} {emp.lastName}</div>
                          <div className="text-muted text-sm">{emp.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>{emp.department}</td>
                    <td>{emp.title}</td>
                    <td>{getManager(emp.managerId)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                        {emp.systemRoles.map(r => (
                          <span key={r} className={`role-tag ${r}`}>{ROLE_LABELS[r] ?? r}</span>
                        ))}
                      </div>
                    </td>
                    <td>{emp.joiningDate}</td>
                    <td><span className={`badge badge-${emp.status}`}>{emp.status}</span></td>
                    <td>
                      <div className="btn-group">
                        <button className="btn btn-ghost btn-sm" onClick={() => { setEditing(emp); setShowModal(true) }}>Edit</button>
                        {emp.status === 'active'
                          ? <button className="btn btn-ghost btn-sm" style={{ color: 'var(--danger)' }} onClick={() => handleDeactivate(emp)}>Deactivate</button>
                          : <button className="btn btn-ghost btn-sm" style={{ color: 'var(--success)' }} onClick={() => handleReactivate(emp)}>Reactivate</button>
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
        <EmployeeModal
          employee={editing}
          employees={employees}
          onClose={() => { setShowModal(false); setEditing(null) }}
          onSave={load}
        />
      )}
    </div>
  )
}
