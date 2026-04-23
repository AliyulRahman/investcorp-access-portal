import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { employeeApi } from '../services/api'
import { Employee, SystemRole } from '../types'

const ROLE_COLORS: Record<SystemRole, string> = {
  manager: '#c9973a',
  app_owner: '#6d28d9',
  it_security: '#dc2626',
  admin: '#1d4ed8',
  employee: '#6b7280'
}

export default function Login() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    employeeApi.getAll({ status: 'active' })
      .then(res => setEmployees(res.data))
      .catch(() => setEmployees([]))
      .finally(() => setLoading(false))
  }, [])

  const handleLogin = async () => {
    if (!selectedId) return
    setSubmitting(true)
    const emp = employees.find(e => e.id === selectedId)
    if (emp) {
      login(emp)
      navigate('/')
    }
    setSubmitting(false)
  }

  const selected = employees.find(e => e.id === selectedId)

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-logo">
          <h1>Invest<span>corp</span></h1>
          <p>Access Request Management Portal</p>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <div className="spinner spinner-dark" style={{ margin: '0 auto' }}></div>
          </div>
        ) : (
          <>
            <div className="form-group">
              <label>Select Your Account <span className="required">*</span></label>
              <select value={selectedId} onChange={e => setSelectedId(e.target.value)}>
                <option value="">— Choose your name —</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.firstName} {emp.lastName} — {emp.title}
                  </option>
                ))}
              </select>
              <p className="form-hint">POC: select any employee to log in as that user</p>
            </div>

            {selected && (
              <div style={{
                background: '#f8fafc',
                border: '1px solid #dde2ec',
                borderRadius: '8px',
                padding: '14px',
                marginBottom: '20px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: '50%',
                    background: '#0f2d4e', color: 'white',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: 14, flexShrink: 0
                  }}>
                    {selected.firstName[0]}{selected.lastName[0]}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>
                      {selected.firstName} {selected.lastName}
                    </div>
                    <div style={{ fontSize: 12, color: '#6b7280' }}>
                      {selected.title} · {selected.department}
                    </div>
                    <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                      {selected.systemRoles.map(r => (
                        <span key={r} style={{
                          fontSize: 10, fontWeight: 700,
                          padding: '2px 6px', borderRadius: 4,
                          background: ROLE_COLORS[r] + '22',
                          color: ROLE_COLORS[r],
                          textTransform: 'uppercase',
                          letterSpacing: '0.3px'
                        }}>
                          {r.replace('_', ' ')}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <button
              className="btn btn-primary btn-lg w-full"
              onClick={handleLogin}
              disabled={!selectedId || submitting}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              {submitting ? <span className="spinner"></span> : 'Sign In to Portal'}
            </button>
          </>
        )}

        <hr className="login-divider" />
        <p style={{ textAlign: 'center', fontSize: 11, color: '#9ca3af' }}>
          Investcorp Access Portal v1.0 · Proof of Concept
        </p>
      </div>
    </div>
  )
}
