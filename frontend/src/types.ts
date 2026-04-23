export type SystemRole = 'employee' | 'manager' | 'app_owner' | 'it_security' | 'admin'
export type RecordStatus = 'active' | 'inactive'
export type RequestStatus =
  | 'pending_manager'
  | 'pending_app_owner'
  | 'pending_it_security'
  | 'approved'
  | 'rejected'
  | 'cancelled'
export type ApprovalAction = 'approved' | 'rejected' | null
export type ApproverRole = 'manager' | 'app_owner' | 'it_security'

export interface Employee {
  id: string
  firstName: string
  lastName: string
  email: string
  phone: string
  department: string
  title: string
  managerId: string | null
  systemRoles: SystemRole[]
  status: RecordStatus
  joiningDate: string
}

export interface Application {
  id: string
  name: string
  description: string
  category: string
  ownerId: string
  status: RecordStatus
  createdDate: string
}

export interface AppRole {
  id: string
  name: string
  description: string
  applicationId: string
  status: RecordStatus
}

export interface ApprovalStep {
  step: number
  approverRole: ApproverRole
  approverId: string | null
  action: ApprovalAction
  date: string | null
  comments: string
}

export interface AccessRequest {
  id: string
  requestorId: string
  applicationId: string
  roleId: string
  businessJustification: string
  requestedDate: string
  status: RequestStatus
  approvals: ApprovalStep[]
}
