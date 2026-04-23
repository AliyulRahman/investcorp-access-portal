import axios, { AxiosResponse } from 'axios'
import {
  Employee,
  Application,
  AppRole,
  AccessRequest,
  RecordStatus
} from '../types'

const api = axios.create({ baseURL: '/api' })

interface EmployeeParams {
  status?: RecordStatus
}

interface AppParams {
  status?: RecordStatus
}

interface AppRoleParams {
  status?: RecordStatus
  applicationId?: string
}

interface AccessRequestParams {
  requestorId?: string
  approverId?: string
}

interface ApprovePayload {
  approverId: string
  action: 'approved' | 'rejected'
  comments: string
}

export const employeeApi = {
  getAll: (params?: EmployeeParams): Promise<AxiosResponse<Employee[]>> =>
    api.get('/employees', { params }),
  getById: (id: string): Promise<AxiosResponse<Employee>> =>
    api.get(`/employees/${id}`),
  create: (data: Omit<Employee, 'id'>): Promise<AxiosResponse<Employee>> =>
    api.post('/employees', data),
  update: (id: string, data: Partial<Employee>): Promise<AxiosResponse<Employee>> =>
    api.put(`/employees/${id}`, data),
  deactivate: (id: string): Promise<AxiosResponse<void>> =>
    api.delete(`/employees/${id}`)
}

export const applicationApi = {
  getAll: (params?: AppParams): Promise<AxiosResponse<Application[]>> =>
    api.get('/applications', { params }),
  getById: (id: string): Promise<AxiosResponse<Application>> =>
    api.get(`/applications/${id}`),
  create: (data: Omit<Application, 'id' | 'createdDate'>): Promise<AxiosResponse<Application>> =>
    api.post('/applications', data),
  update: (id: string, data: Partial<Application>): Promise<AxiosResponse<Application>> =>
    api.put(`/applications/${id}`, data),
  deactivate: (id: string): Promise<AxiosResponse<void>> =>
    api.delete(`/applications/${id}`)
}

export const appRoleApi = {
  getAll: (params?: AppRoleParams): Promise<AxiosResponse<AppRole[]>> =>
    api.get('/app-roles', { params }),
  getById: (id: string): Promise<AxiosResponse<AppRole>> =>
    api.get(`/app-roles/${id}`),
  create: (data: Omit<AppRole, 'id'>): Promise<AxiosResponse<AppRole>> =>
    api.post('/app-roles', data),
  update: (id: string, data: Partial<AppRole>): Promise<AxiosResponse<AppRole>> =>
    api.put(`/app-roles/${id}`, data),
  deactivate: (id: string): Promise<AxiosResponse<void>> =>
    api.delete(`/app-roles/${id}`)
}

export const accessRequestApi = {
  getAll: (params?: AccessRequestParams): Promise<AxiosResponse<AccessRequest[]>> =>
    api.get('/access-requests', { params }),
  getById: (id: string): Promise<AxiosResponse<AccessRequest>> =>
    api.get(`/access-requests/${id}`),
  create: (data: Pick<AccessRequest, 'requestorId' | 'applicationId' | 'roleId' | 'businessJustification'>): Promise<AxiosResponse<AccessRequest>> =>
    api.post('/access-requests', data),
  approve: (id: string, data: ApprovePayload): Promise<AxiosResponse<AccessRequest>> =>
    api.post(`/access-requests/${id}/approve`, data),
  cancel: (id: string): Promise<AxiosResponse<AccessRequest>> =>
    api.patch(`/access-requests/${id}/cancel`)
}
