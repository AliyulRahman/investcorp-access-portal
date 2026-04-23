-- ============================================================
--  Investcorp Access Portal  -  Database Setup Script
--  Server   : AZUKDSQL03
--  Database : AI_Dev
--  Generated: 2026-04-22
--
--  Execution order:
--    1. Creates / switches to AI_Dev database
--    2. Drops tables (reverse FK order, safe re-run)
--    3. Creates tables with constraints
--    4. Seeds all sample data from JSON files
-- ============================================================


-- ============================================================
-- 1. DATABASE
-- ============================================================
USE master;
GO

IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = N'AI_Dev')
BEGIN
    CREATE DATABASE AI_Dev;
    PRINT 'Database AI_Dev created.';
END
ELSE
    PRINT 'Database AI_Dev already exists.';
GO

USE AI_Dev;
GO


-- ============================================================
-- 2. DROP EXISTING TABLES  (reverse FK order for safe re-run)
-- ============================================================
IF OBJECT_ID('dbo.ApprovalSteps',  'U') IS NOT NULL  DROP TABLE dbo.ApprovalSteps;
IF OBJECT_ID('dbo.AccessRequests', 'U') IS NOT NULL  DROP TABLE dbo.AccessRequests;
IF OBJECT_ID('dbo.AppRoles',       'U') IS NOT NULL  DROP TABLE dbo.AppRoles;
IF OBJECT_ID('dbo.Applications',   'U') IS NOT NULL  DROP TABLE dbo.Applications;
IF OBJECT_ID('dbo.EmployeeRoles',  'U') IS NOT NULL  DROP TABLE dbo.EmployeeRoles;
IF OBJECT_ID('dbo.Employees',      'U') IS NOT NULL  DROP TABLE dbo.Employees;
GO


-- ============================================================
-- 3. CREATE TABLES
-- ============================================================

-- ------------------------------------------------------------
-- Employees
-- ------------------------------------------------------------
CREATE TABLE dbo.Employees (
    Id          VARCHAR(20)     NOT NULL,
    FirstName   NVARCHAR(100)   NOT NULL,
    LastName    NVARCHAR(100)   NOT NULL,
    Email       NVARCHAR(255)   NOT NULL,
    Phone       NVARCHAR(50)    NOT NULL CONSTRAINT DF_Employees_Phone    DEFAULT '',
    Department  NVARCHAR(100)   NOT NULL,
    Title       NVARCHAR(200)   NOT NULL,
    ManagerId   VARCHAR(20)         NULL,
    Status      NVARCHAR(20)    NOT NULL CONSTRAINT DF_Employees_Status   DEFAULT 'active',
    JoiningDate DATE            NOT NULL,
    CreatedAt   DATETIME2       NOT NULL CONSTRAINT DF_Employees_Created  DEFAULT SYSUTCDATETIME(),
    UpdatedAt   DATETIME2       NOT NULL CONSTRAINT DF_Employees_Updated  DEFAULT SYSUTCDATETIME(),

    CONSTRAINT PK_Employees          PRIMARY KEY (Id),
    CONSTRAINT UQ_Employees_Email    UNIQUE      (Email),
    CONSTRAINT FK_Employees_Manager  FOREIGN KEY (ManagerId) REFERENCES dbo.Employees(Id),
    CONSTRAINT CK_Employees_Status   CHECK       (Status IN ('active', 'inactive'))
);
GO

-- ------------------------------------------------------------
-- EmployeeRoles  (normalises the systemRoles[] array)
-- ------------------------------------------------------------
CREATE TABLE dbo.EmployeeRoles (
    Id          INT             NOT NULL IDENTITY(1,1),
    EmployeeId  VARCHAR(20)     NOT NULL,
    Role        NVARCHAR(50)    NOT NULL,

    CONSTRAINT PK_EmployeeRoles          PRIMARY KEY (Id),
    CONSTRAINT FK_EmployeeRoles_Employee FOREIGN KEY (EmployeeId) REFERENCES dbo.Employees(Id) ON DELETE CASCADE,
    CONSTRAINT UQ_EmployeeRoles          UNIQUE      (EmployeeId, Role),
    CONSTRAINT CK_EmployeeRoles_Role     CHECK       (Role IN ('employee', 'manager', 'app_owner', 'it_security', 'admin'))
);
GO

-- ------------------------------------------------------------
-- Applications
-- ------------------------------------------------------------
CREATE TABLE dbo.Applications (
    Id          VARCHAR(20)     NOT NULL,
    Name        NVARCHAR(200)   NOT NULL,
    Description NVARCHAR(MAX)   NOT NULL,
    OwnerId     VARCHAR(20)     NOT NULL,
    Status      NVARCHAR(20)    NOT NULL CONSTRAINT DF_Applications_Status  DEFAULT 'active',
    Category    NVARCHAR(100)   NOT NULL,
    CreatedDate DATE            NOT NULL CONSTRAINT DF_Applications_Created DEFAULT CAST(SYSUTCDATETIME() AS DATE),
    UpdatedAt   DATETIME2       NOT NULL CONSTRAINT DF_Applications_Updated DEFAULT SYSUTCDATETIME(),

    CONSTRAINT PK_Applications         PRIMARY KEY (Id),
    CONSTRAINT FK_Applications_Owner   FOREIGN KEY (OwnerId) REFERENCES dbo.Employees(Id),
    CONSTRAINT CK_Applications_Status  CHECK       (Status IN ('active', 'inactive'))
);
GO

-- ------------------------------------------------------------
-- AppRoles
-- ------------------------------------------------------------
CREATE TABLE dbo.AppRoles (
    Id              VARCHAR(20)     NOT NULL,
    ApplicationId   VARCHAR(20)     NOT NULL,
    Name            NVARCHAR(200)   NOT NULL,
    Description     NVARCHAR(MAX)   NOT NULL,
    Status          NVARCHAR(20)    NOT NULL CONSTRAINT DF_AppRoles_Status  DEFAULT 'active',
    UpdatedAt       DATETIME2       NOT NULL CONSTRAINT DF_AppRoles_Updated DEFAULT SYSUTCDATETIME(),

    CONSTRAINT PK_AppRoles            PRIMARY KEY (Id),
    CONSTRAINT FK_AppRoles_App        FOREIGN KEY (ApplicationId) REFERENCES dbo.Applications(Id),
    CONSTRAINT CK_AppRoles_Status     CHECK       (Status IN ('active', 'inactive'))
);
GO

-- ------------------------------------------------------------
-- AccessRequests
-- ------------------------------------------------------------
CREATE TABLE dbo.AccessRequests (
    Id                    VARCHAR(20)   NOT NULL,
    RequestorId           VARCHAR(20)   NOT NULL,
    ApplicationId         VARCHAR(20)   NOT NULL,
    RoleId                VARCHAR(20)   NOT NULL,
    BusinessJustification NVARCHAR(MAX) NOT NULL,
    RequestedDate         DATETIME2     NOT NULL CONSTRAINT DF_AccessRequests_Date    DEFAULT SYSUTCDATETIME(),
    Status                NVARCHAR(50)  NOT NULL CONSTRAINT DF_AccessRequests_Status  DEFAULT 'pending_manager',
    UpdatedAt             DATETIME2     NOT NULL CONSTRAINT DF_AccessRequests_Updated DEFAULT SYSUTCDATETIME(),

    CONSTRAINT PK_AccessRequests            PRIMARY KEY (Id),
    CONSTRAINT FK_AccessRequests_Requestor  FOREIGN KEY (RequestorId)   REFERENCES dbo.Employees(Id),
    CONSTRAINT FK_AccessRequests_App        FOREIGN KEY (ApplicationId) REFERENCES dbo.Applications(Id),
    CONSTRAINT FK_AccessRequests_Role       FOREIGN KEY (RoleId)        REFERENCES dbo.AppRoles(Id),
    CONSTRAINT CK_AccessRequests_Status     CHECK (Status IN (
        'pending_manager', 'pending_app_owner', 'pending_it_security',
        'approved', 'rejected', 'cancelled'
    ))
);
GO

-- ------------------------------------------------------------
-- ApprovalSteps  (normalises the approvals[] array)
-- ------------------------------------------------------------
CREATE TABLE dbo.ApprovalSteps (
    Id           INT           NOT NULL IDENTITY(1,1),
    RequestId    VARCHAR(20)   NOT NULL,
    Step         TINYINT       NOT NULL,          -- 1, 2, or 3
    ApproverRole NVARCHAR(50)  NOT NULL,
    ApproverId   VARCHAR(20)       NULL,
    Action       NVARCHAR(20)      NULL,          -- 'approved' | 'rejected' | NULL
    ActionDate   DATETIME2         NULL,
    Comments     NVARCHAR(MAX) NOT NULL CONSTRAINT DF_ApprovalSteps_Comments DEFAULT '',

    CONSTRAINT PK_ApprovalSteps           PRIMARY KEY (Id),
    CONSTRAINT FK_ApprovalSteps_Request   FOREIGN KEY (RequestId)  REFERENCES dbo.AccessRequests(Id) ON DELETE CASCADE,
    CONSTRAINT FK_ApprovalSteps_Approver  FOREIGN KEY (ApproverId) REFERENCES dbo.Employees(Id),
    CONSTRAINT UQ_ApprovalSteps           UNIQUE      (RequestId, Step),
    CONSTRAINT CK_ApprovalSteps_Step      CHECK (Step BETWEEN 1 AND 3),
    CONSTRAINT CK_ApprovalSteps_Role      CHECK (ApproverRole IN ('manager', 'app_owner', 'it_security')),
    CONSTRAINT CK_ApprovalSteps_Action    CHECK (Action IN ('approved', 'rejected') OR Action IS NULL)
);
GO


-- ============================================================
-- 4. SEED DATA
-- ============================================================

-- ------------------------------------------------------------
-- Employees
-- Insert top-level (no manager) first, then dependents
-- ------------------------------------------------------------

-- Top-level: no manager
INSERT INTO dbo.Employees (Id, FirstName, LastName, Email, Phone, Department, Title, ManagerId, Status, JoiningDate)
VALUES ('emp006', 'David', 'Hartman', 'david.hartman@investcorp.com', '+1-212-555-0106',
        'Executive', 'Chief Technology Officer', NULL, 'active', '2015-01-10');

-- Reports to emp006
INSERT INTO dbo.Employees (Id, FirstName, LastName, Email, Phone, Department, Title, ManagerId, Status, JoiningDate)
VALUES
    ('emp001', 'Sarah',   'Mitchell',  'sarah.mitchell@investcorp.com',   '+1-212-555-0101', 'IT Security', 'Head of IT Security',            'emp006', 'active', '2019-03-15'),
    ('emp002', 'Michael', 'Thompson',  'michael.thompson@investcorp.com',  '+1-212-555-0102', 'Technology',  'Technology Manager',             'emp006', 'active', '2018-06-01'),
    ('emp007', 'Lisa',    'Wang',      'lisa.wang@investcorp.com',         '+1-212-555-0107', 'Sales',       'Salesforce & Tableau App Owner', 'emp006', 'active', '2021-04-15');

-- Reports to emp002
INSERT INTO dbo.Employees (Id, FirstName, LastName, Email, Phone, Department, Title, ManagerId, Status, JoiningDate)
VALUES
    ('emp003', 'Jennifer', 'Patel',     'jennifer.patel@investcorp.com',   '+1-212-555-0103', 'Technology', 'Bloomberg Application Owner', 'emp002', 'active', '2020-09-01'),
    ('emp004', 'Robert',   'Chen',      'robert.chen@investcorp.com',      '+1-212-555-0104', 'Finance',    'Finance Analyst',             'emp002', 'active', '2024-01-15'),
    ('emp005', 'Amanda',   'Rodriguez', 'amanda.rodriguez@investcorp.com', '+1-212-555-0105', 'Sales',      'Sales Associate',             'emp002', 'active', '2024-02-01');

-- Reports to emp001
INSERT INTO dbo.Employees (Id, FirstName, LastName, Email, Phone, Department, Title, ManagerId, Status, JoiningDate)
VALUES
    ('emp008', 'James', 'Okafor', 'james.okafor@investcorp.com', '+1-212-555-0108', 'IT Security', 'IT Security Analyst', 'emp001', 'active', '2022-07-01');
GO

-- ------------------------------------------------------------
-- EmployeeRoles
-- ------------------------------------------------------------
INSERT INTO dbo.EmployeeRoles (EmployeeId, Role)
VALUES
    ('emp001', 'it_security'),
    ('emp001', 'admin'),
    ('emp002', 'manager'),
    ('emp003', 'app_owner'),
    ('emp003', 'employee'),
    ('emp004', 'employee'),
    ('emp005', 'employee'),
    ('emp006', 'manager'),
    ('emp006', 'admin'),
    ('emp007', 'app_owner'),
    ('emp007', 'employee'),
    ('emp008', 'it_security');
GO

-- ------------------------------------------------------------
-- Applications
-- ------------------------------------------------------------
INSERT INTO dbo.Applications (Id, Name, Description, OwnerId, Status, Category, CreatedDate)
VALUES
    ('app001', 'Bloomberg Terminal',
     'Professional financial data and analytics platform for market data, news, and trading',
     'emp003', 'active', 'Financial Data', '2023-01-01'),

    ('app002', 'Salesforce CRM',
     'Customer relationship management platform for sales and client management',
     'emp007', 'active', 'CRM', '2023-01-01'),

    ('app003', 'SAP Finance',
     'Enterprise resource planning system for financial management and reporting',
     'emp006', 'active', 'ERP', '2023-01-01'),

    ('app004', 'Microsoft Office 365',
     'Productivity suite including email, document management, and collaboration tools',
     'emp003', 'active', 'Productivity', '2023-01-01'),

    ('app005', 'Tableau Analytics',
     'Business intelligence and data visualization platform for reporting',
     'emp007', 'active', 'Analytics', '2023-01-01');
GO

-- ------------------------------------------------------------
-- AppRoles
-- ------------------------------------------------------------
INSERT INTO dbo.AppRoles (Id, ApplicationId, Name, Description, Status)
VALUES
    -- Bloomberg Terminal
    ('r001',  'app001', 'Read Only',            'View market data and reports without trading capabilities',         'active'),
    ('r002',  'app001', 'Standard User',        'Full access to Bloomberg data and standard analytics',             'active'),
    ('r003',  'app001', 'Power User',           'Advanced analytics, custom screens, and API access',               'active'),
    ('r004',  'app001', 'Administrator',        'Full administrative control including user management',            'active'),

    -- Salesforce CRM
    ('r005',  'app002', 'Sales Representative', 'Manage contacts, leads, and opportunities',                        'active'),
    ('r006',  'app002', 'Sales Manager',        'Team management, forecasting, and reporting',                      'active'),
    ('r007',  'app002', 'System Administrator', 'Full Salesforce administrative access',                            'active'),

    -- SAP Finance
    ('r008',  'app003', 'Viewer',               'Read-only access to financial reports',                            'active'),
    ('r009',  'app003', 'Accountant',           'Process transactions and maintain accounts',                       'active'),
    ('r010',  'app003', 'Finance Manager',      'Full financial management and approval authority',                 'active'),

    -- Microsoft Office 365
    ('r011',  'app004', 'E1 License',           'Basic Office apps and email (web only)',                           'active'),
    ('r012',  'app004', 'E3 License',           'Full Office suite with Teams, SharePoint, and compliance',         'active'),
    ('r013',  'app004', 'E5 License',           'E3 plus advanced security, compliance, and analytics',             'active'),

    -- Tableau Analytics
    ('r014',  'app005', 'Viewer',               'View and interact with published dashboards',                      'active'),
    ('r015',  'app005', 'Creator',              'Create and publish workbooks and dashboards',                      'active'),
    ('r016',  'app005', 'Administrator',        'Full server administration and user management',                   'active');
GO

-- ------------------------------------------------------------
-- AccessRequests
-- ------------------------------------------------------------
INSERT INTO dbo.AccessRequests (Id, RequestorId, ApplicationId, RoleId, BusinessJustification, RequestedDate, Status)
VALUES
    ('req001', 'emp004', 'app001', 'r002',
     'Need Bloomberg Terminal access for daily market analysis and financial modeling as part of my Finance Analyst role.',
     '2024-03-10T09:00:00Z', 'pending_manager'),

    ('req002', 'emp005', 'app002', 'r005',
     'Require Salesforce CRM access to manage client relationships and track sales pipeline as a new Sales Associate.',
     '2024-03-08T10:30:00Z', 'pending_app_owner'),

    ('req003', 'emp004', 'app003', 'r009',
     'Need SAP Finance access to process monthly financial transactions and maintain accounts for the Finance department.',
     '2024-03-05T08:00:00Z', 'approved'),

    ('req004', 'emp005', 'app005', 'r014',
     'Need Tableau Viewer access to review sales performance dashboards and share insights with the team.',
     '2024-03-12T11:00:00Z', 'approved'),

    ('req005', 'emp001', 'app001', 'r001',
     'Test Request for testing',
     '2026-04-21T12:30:56.279Z', 'pending_it_security');
GO

-- ------------------------------------------------------------
-- ApprovalSteps
-- ------------------------------------------------------------

-- req001  (pending_manager — no action yet on any step)
INSERT INTO dbo.ApprovalSteps (RequestId, Step, ApproverRole, ApproverId, Action, ActionDate, Comments)
VALUES
    ('req001', 1, 'manager',     NULL, NULL, NULL, ''),
    ('req001', 2, 'app_owner',   NULL, NULL, NULL, ''),
    ('req001', 3, 'it_security', NULL, NULL, NULL, '');

-- req002  (pending_app_owner — manager approved)
INSERT INTO dbo.ApprovalSteps (RequestId, Step, ApproverRole, ApproverId, Action, ActionDate, Comments)
VALUES
    ('req002', 1, 'manager',     'emp002', 'approved', '2024-03-09T14:00:00Z', 'Approved. Amanda needs CRM access for her sales role.'),
    ('req002', 2, 'app_owner',   NULL,     NULL,        NULL,                   ''),
    ('req002', 3, 'it_security', NULL,     NULL,        NULL,                   '');

-- req003  (approved — all three steps complete)
INSERT INTO dbo.ApprovalSteps (RequestId, Step, ApproverRole, ApproverId, Action, ActionDate, Comments)
VALUES
    ('req003', 1, 'manager',     'emp002', 'approved', '2024-03-06T09:00:00Z', 'Approved for finance role requirements.'),
    ('req003', 2, 'app_owner',   'emp006', 'approved', '2024-03-07T11:00:00Z', 'Accountant role is appropriate for this position.'),
    ('req003', 3, 'it_security', 'emp001', 'approved', '2024-03-08T10:00:00Z', 'Security review completed. Access granted.');

-- req004  (approved)
INSERT INTO dbo.ApprovalSteps (RequestId, Step, ApproverRole, ApproverId, Action, ActionDate, Comments)
VALUES
    ('req004', 1, 'manager',     'emp002', 'approved', '2024-03-13T09:00:00Z', 'Approved.'),
    ('req004', 2, 'app_owner',   'emp007', 'approved', '2024-03-14T10:00:00Z', 'Viewer access is standard for sales team.'),
    ('req004', 3, 'it_security', 'emp001', 'approved', '2026-04-21T12:29:38.411Z', '');

-- req005  (pending_it_security — manager and app_owner approved)
INSERT INTO dbo.ApprovalSteps (RequestId, Step, ApproverRole, ApproverId, Action, ActionDate, Comments)
VALUES
    ('req005', 1, 'manager',     'emp006', 'approved', '2026-04-21T12:31:32.662Z', ''),
    ('req005', 2, 'app_owner',   'emp003', 'approved', '2026-04-21T12:31:53.824Z', ''),
    ('req005', 3, 'it_security', NULL,     NULL,        NULL,                       '');
GO


-- ============================================================
-- 5. VERIFY  (row counts)
-- ============================================================
SELECT 'Employees'     AS [Table], COUNT(*) AS [Rows] FROM dbo.Employees
UNION ALL
SELECT 'EmployeeRoles',              COUNT(*)          FROM dbo.EmployeeRoles
UNION ALL
SELECT 'Applications',               COUNT(*)          FROM dbo.Applications
UNION ALL
SELECT 'AppRoles',                   COUNT(*)          FROM dbo.AppRoles
UNION ALL
SELECT 'AccessRequests',             COUNT(*)          FROM dbo.AccessRequests
UNION ALL
SELECT 'ApprovalSteps',              COUNT(*)          FROM dbo.ApprovalSteps;
GO

PRINT 'Setup complete. AI_Dev database is ready.';
GO
