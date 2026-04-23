import { createContext, useContext, useState, ReactNode } from 'react'
import { Employee, SystemRole } from '../types'

interface AuthContextType {
  currentUser: Employee | null
  login: (user: Employee) => void
  logout: () => void
  hasRole: (role: SystemRole) => boolean
  canApprove: () => boolean
  isAdmin: () => boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<Employee | null>(() => {
    const stored = localStorage.getItem('investcorp_user')
    return stored ? (JSON.parse(stored) as Employee) : null
  })

  const login = (user: Employee) => {
    setCurrentUser(user)
    localStorage.setItem('investcorp_user', JSON.stringify(user))
  }

  const logout = () => {
    setCurrentUser(null)
    localStorage.removeItem('investcorp_user')
  }

  const hasRole = (role: SystemRole) => currentUser?.systemRoles?.includes(role) ?? false

  const canApprove = () =>
    hasRole('manager') || hasRole('app_owner') || hasRole('it_security')

  const isAdmin = () => hasRole('admin')

  return (
    <AuthContext.Provider value={{ currentUser, login, logout, hasRole, canApprove, isAdmin }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
