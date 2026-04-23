import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import NewRequest from './pages/AccessRequests/NewRequest'
import MyRequests from './pages/AccessRequests/MyRequests'
import PendingApprovals from './pages/Approvals/PendingApprovals'
import Employees from './pages/Maintenance/Employees'
import Applications from './pages/Maintenance/Applications'
import AppRoles from './pages/Maintenance/AppRoles'

interface ProtectedRouteProps {
  children: React.ReactNode
  requireAdmin?: boolean
  requireApprover?: boolean
}

function ProtectedRoute({ children, requireAdmin, requireApprover }: ProtectedRouteProps) {
  const { currentUser, isAdmin, canApprove } = useAuth()
  if (!currentUser) return <Navigate to="/login" replace />
  if (requireAdmin && !isAdmin()) return <Navigate to="/" replace />
  if (requireApprover && !canApprove()) return <Navigate to="/" replace />
  return <>{children}</>
}

function AppRoutes() {
  const { currentUser } = useAuth()

  return (
    <Routes>
      <Route path="/login" element={currentUser ? <Navigate to="/" replace /> : <Login />} />
      <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="requests/new" element={<NewRequest />} />
        <Route path="requests/my" element={<MyRequests />} />
        <Route path="approvals" element={
          <ProtectedRoute requireApprover>
            <PendingApprovals />
          </ProtectedRoute>
        } />
        <Route path="maintenance/employees" element={
          <ProtectedRoute requireAdmin>
            <Employees />
          </ProtectedRoute>
        } />
        <Route path="maintenance/applications" element={
          <ProtectedRoute requireAdmin>
            <Applications />
          </ProtectedRoute>
        } />
        <Route path="maintenance/app-roles" element={
          <ProtectedRoute requireAdmin>
            <AppRoles />
          </ProtectedRoute>
        } />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  )
}
