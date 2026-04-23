const express = require('express');
const { sql, getPool } = require('../db/connection');

const router = express.Router();

const mapStep = (row) => ({
  step: row.Step,
  approverRole: row.ApproverRole,
  approverId: row.ApproverId || null,
  action: row.Action || null,
  date: row.ActionDate instanceof Date ? row.ActionDate.toISOString() : row.ActionDate || null,
  comments: row.Comments || ''
});

const mapRequest = (row, steps) => ({
  id: row.Id,
  requestorId: row.RequestorId,
  applicationId: row.ApplicationId,
  roleId: row.RoleId,
  businessJustification: row.BusinessJustification,
  requestedDate: row.RequestedDate instanceof Date
    ? row.RequestedDate.toISOString()
    : row.RequestedDate,
  status: row.Status,
  approvals: steps
    .filter(s => s.RequestId === row.Id)
    .sort((a, b) => a.Step - b.Step)
    .map(mapStep)
});

// GET /api/access-requests[?requestorId=&status=&approverId=]
router.get('/', async (req, res) => {
  try {
    const pool = await getPool();
    const { requestorId, status, approverId } = req.query;

    const reqDbRequest = pool.request();
    const conditions = [];
    let reqQuery = 'SELECT * FROM dbo.AccessRequests';

    if (requestorId) {
      conditions.push('RequestorId = @requestorId');
      reqDbRequest.input('requestorId', sql.VarChar, requestorId);
    }
    if (status) {
      conditions.push('Status = @status');
      reqDbRequest.input('status', sql.NVarChar, status);
    }
    if (conditions.length) reqQuery += ' WHERE ' + conditions.join(' AND ');
    reqQuery += ' ORDER BY RequestedDate DESC';

    const [reqResult, stepsResult] = await Promise.all([
      reqDbRequest.query(reqQuery),
      pool.request().query('SELECT * FROM dbo.ApprovalSteps ORDER BY RequestId, Step')
    ]);

    let requests = reqResult.recordset.map(r => mapRequest(r, stepsResult.recordset));

    if (approverId) {
      const [approverResult, rolesResult] = await Promise.all([
        pool.request()
          .input('id', sql.VarChar, approverId)
          .query('SELECT Id FROM dbo.Employees WHERE Id = @id'),
        pool.request()
          .input('id', sql.VarChar, approverId)
          .query('SELECT Role FROM dbo.EmployeeRoles WHERE EmployeeId = @id')
      ]);

      if (!approverResult.recordset.length) {
        return res.status(404).json({ error: 'Approver not found' });
      }

      const approverRoles = rolesResult.recordset.map(r => r.Role);

      let reporteeIds = [];
      if (approverRoles.includes('manager')) {
        const reporteesResult = await pool.request()
          .input('managerId', sql.VarChar, approverId)
          .query('SELECT Id FROM dbo.Employees WHERE ManagerId = @managerId');
        reporteeIds = reporteesResult.recordset.map(r => r.Id);
      }

      let ownedAppIds = [];
      if (approverRoles.includes('app_owner')) {
        const appsResult = await pool.request()
          .input('ownerId', sql.VarChar, approverId)
          .query('SELECT Id FROM dbo.Applications WHERE OwnerId = @ownerId');
        ownedAppIds = appsResult.recordset.map(a => a.Id);
      }

      requests = requests.filter(r => {
        if (approverRoles.includes('manager') && r.status === 'pending_manager') {
          return reporteeIds.includes(r.requestorId);
        }
        if (approverRoles.includes('app_owner') && r.status === 'pending_app_owner') {
          return ownedAppIds.includes(r.applicationId);
        }
        if (approverRoles.includes('it_security') && r.status === 'pending_it_security') {
          return true;
        }
        return false;
      });
    }

    res.json(requests);
  } catch (err) {
    console.error('[accessRequests GET /]', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

// GET /api/access-requests/:id
router.get('/:id', async (req, res) => {
  try {
    const pool = await getPool();
    const [reqResult, stepsResult] = await Promise.all([
      pool.request()
        .input('id', sql.VarChar, req.params.id)
        .query('SELECT * FROM dbo.AccessRequests WHERE Id = @id'),
      pool.request()
        .input('id', sql.VarChar, req.params.id)
        .query('SELECT * FROM dbo.ApprovalSteps WHERE RequestId = @id ORDER BY Step')
    ]);

    if (!reqResult.recordset.length) return res.status(404).json({ error: 'Request not found' });

    const steps = stepsResult.recordset.map(s => ({ ...s, RequestId: req.params.id }));
    res.json(mapRequest(reqResult.recordset[0], steps));
  } catch (err) {
    console.error('[accessRequests GET /:id]', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

// POST /api/access-requests
router.post('/', async (req, res) => {
  try {
    const pool = await getPool();
    const { requestorId, applicationId, roleId, businessJustification } = req.body;

    const maxResult = await pool.request().query(
      "SELECT ISNULL(MAX(CAST(REPLACE(Id, 'req', '') AS INT)), 0) AS MaxNum FROM dbo.AccessRequests"
    );
    const newId = 'req' + String(maxResult.recordset[0].MaxNum + 1).padStart(3, '0');
    const now = new Date();

    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      await new sql.Request(transaction)
        .input('id',            sql.VarChar,   newId)
        .input('requestorId',   sql.VarChar,   requestorId)
        .input('applicationId', sql.VarChar,   applicationId)
        .input('roleId',        sql.VarChar,   roleId)
        .input('justification', sql.NVarChar,  businessJustification)
        .input('requestedDate', sql.DateTime2, now)
        .query(`INSERT INTO dbo.AccessRequests
                  (Id, RequestorId, ApplicationId, RoleId, BusinessJustification, RequestedDate, Status)
                VALUES
                  (@id, @requestorId, @applicationId, @roleId, @justification, @requestedDate, 'pending_manager')`);

      for (const s of [{ step: 1, role: 'manager' }, { step: 2, role: 'app_owner' }, { step: 3, role: 'it_security' }]) {
        await new sql.Request(transaction)
          .input('reqId', sql.VarChar,  newId)
          .input('step',  sql.TinyInt,  s.step)
          .input('role',  sql.NVarChar, s.role)
          .query(`INSERT INTO dbo.ApprovalSteps
                    (RequestId, Step, ApproverRole, ApproverId, Action, ActionDate, Comments)
                  VALUES (@reqId, @step, @role, NULL, NULL, NULL, '')`);
      }

      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }

    res.status(201).json({
      id: newId, requestorId, applicationId, roleId, businessJustification,
      requestedDate: now.toISOString(),
      status: 'pending_manager',
      approvals: [
        { step: 1, approverRole: 'manager',     approverId: null, action: null, date: null, comments: '' },
        { step: 2, approverRole: 'app_owner',   approverId: null, action: null, date: null, comments: '' },
        { step: 3, approverRole: 'it_security', approverId: null, action: null, date: null, comments: '' }
      ]
    });
  } catch (err) {
    console.error('[accessRequests POST /]', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

// POST /api/access-requests/:id/approve
router.post('/:id/approve', async (req, res) => {
  try {
    const { approverId, action, comments } = req.body;

    if (!['approved', 'rejected'].includes(action)) {
      return res.status(400).json({ error: 'Action must be "approved" or "rejected"' });
    }

    const pool = await getPool();

    const reqResult = await pool.request()
      .input('id', sql.VarChar, req.params.id)
      .query('SELECT * FROM dbo.AccessRequests WHERE Id = @id');
    if (!reqResult.recordset.length) return res.status(404).json({ error: 'Request not found' });

    const dbReq = reqResult.recordset[0];

    const approverCheck = await pool.request()
      .input('id', sql.VarChar, approverId)
      .query('SELECT Id FROM dbo.Employees WHERE Id = @id');
    if (!approverCheck.recordset.length) return res.status(404).json({ error: 'Approver not found' });

    const stepMap = { pending_manager: 1, pending_app_owner: 2, pending_it_security: 3 };
    const stepNum = stepMap[dbReq.Status];
    if (!stepNum) return res.status(400).json({ error: 'Request is not in a state that can be actioned' });

    const nextStatusMap = {
      pending_manager:     'pending_app_owner',
      pending_app_owner:   'pending_it_security',
      pending_it_security: 'approved'
    };
    const newStatus = action === 'rejected' ? 'rejected' : nextStatusMap[dbReq.Status];
    const now = new Date();

    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      await new sql.Request(transaction)
        .input('reqId',      sql.VarChar,   req.params.id)
        .input('step',       sql.TinyInt,   stepNum)
        .input('approverId', sql.VarChar,   approverId)
        .input('action',     sql.NVarChar,  action)
        .input('actionDate', sql.DateTime2, now)
        .input('comments',   sql.NVarChar,  comments || '')
        .query(`UPDATE dbo.ApprovalSteps SET
                  ApproverId = @approverId, Action = @action,
                  ActionDate = @actionDate, Comments = @comments
                WHERE RequestId = @reqId AND Step = @step`);

      await new sql.Request(transaction)
        .input('id',     sql.VarChar,  req.params.id)
        .input('status', sql.NVarChar, newStatus)
        .query('UPDATE dbo.AccessRequests SET Status = @status, UpdatedAt = SYSUTCDATETIME() WHERE Id = @id');

      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }

    const [updatedReq, updatedSteps] = await Promise.all([
      pool.request().input('id', sql.VarChar, req.params.id).query('SELECT * FROM dbo.AccessRequests WHERE Id = @id'),
      pool.request().input('id', sql.VarChar, req.params.id).query('SELECT * FROM dbo.ApprovalSteps WHERE RequestId = @id ORDER BY Step')
    ]);

    const steps = updatedSteps.recordset.map(s => ({ ...s, RequestId: req.params.id }));
    res.json(mapRequest(updatedReq.recordset[0], steps));
  } catch (err) {
    console.error('[accessRequests POST /:id/approve]', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

// PATCH /api/access-requests/:id/cancel
router.patch('/:id/cancel', async (req, res) => {
  try {
    const pool = await getPool();

    const reqResult = await pool.request()
      .input('id', sql.VarChar, req.params.id)
      .query('SELECT Status FROM dbo.AccessRequests WHERE Id = @id');
    if (!reqResult.recordset.length) return res.status(404).json({ error: 'Request not found' });

    const currentStatus = reqResult.recordset[0].Status;
    if (!['pending_manager', 'rejected'].includes(currentStatus)) {
      return res.status(400).json({ error: 'Only pending or rejected requests can be cancelled' });
    }

    await pool.request()
      .input('id', sql.VarChar, req.params.id)
      .query("UPDATE dbo.AccessRequests SET Status = 'cancelled', UpdatedAt = SYSUTCDATETIME() WHERE Id = @id");

    const [updatedReq, updatedSteps] = await Promise.all([
      pool.request().input('id', sql.VarChar, req.params.id).query('SELECT * FROM dbo.AccessRequests WHERE Id = @id'),
      pool.request().input('id', sql.VarChar, req.params.id).query('SELECT * FROM dbo.ApprovalSteps WHERE RequestId = @id ORDER BY Step')
    ]);

    const steps = updatedSteps.recordset.map(s => ({ ...s, RequestId: req.params.id }));
    res.json(mapRequest(updatedReq.recordset[0], steps));
  } catch (err) {
    console.error('[accessRequests PATCH /:id/cancel]', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;
