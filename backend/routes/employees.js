const express = require('express');
const { sql, getPool } = require('../db/connection');

const router = express.Router();

const mapEmployee = (row, roles) => ({
  id: row.Id,
  firstName: row.FirstName,
  lastName: row.LastName,
  email: row.Email,
  phone: row.Phone || '',
  department: row.Department,
  title: row.Title,
  managerId: row.ManagerId || null,
  status: row.Status,
  joiningDate: row.JoiningDate instanceof Date
    ? row.JoiningDate.toISOString().split('T')[0]
    : row.JoiningDate,
  systemRoles: roles
});

const buildRolesMap = (rolesRecordset) => {
  const map = {};
  for (const r of rolesRecordset) {
    if (!map[r.EmployeeId]) map[r.EmployeeId] = [];
    map[r.EmployeeId].push(r.Role);
  }
  return map;
};

// GET /api/employees[?status=active&role=manager]
router.get('/', async (req, res) => {
  try {
    const pool = await getPool();
    const { status, role } = req.query;

    const empReq = pool.request();
    let empQuery = 'SELECT * FROM dbo.Employees';
    if (status) {
      empQuery += ' WHERE Status = @status';
      empReq.input('status', sql.NVarChar, status);
    }
    empQuery += ' ORDER BY LastName, FirstName';

    const [empResult, rolesResult] = await Promise.all([
      empReq.query(empQuery),
      pool.request().query('SELECT EmployeeId, Role FROM dbo.EmployeeRoles')
    ]);

    const rolesMap = buildRolesMap(rolesResult.recordset);
    let employees = empResult.recordset.map(e => mapEmployee(e, rolesMap[e.Id] || []));
    if (role) employees = employees.filter(e => e.systemRoles.includes(role));

    res.json(employees);
  } catch (err) {
    console.error('[employees GET /]', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

// GET /api/employees/:id
router.get('/:id', async (req, res) => {
  try {
    const pool = await getPool();
    const [empResult, rolesResult] = await Promise.all([
      pool.request()
        .input('id', sql.VarChar, req.params.id)
        .query('SELECT * FROM dbo.Employees WHERE Id = @id'),
      pool.request()
        .input('id', sql.VarChar, req.params.id)
        .query('SELECT Role FROM dbo.EmployeeRoles WHERE EmployeeId = @id')
    ]);

    if (!empResult.recordset.length) return res.status(404).json({ error: 'Employee not found' });

    const roles = rolesResult.recordset.map(r => r.Role);
    res.json(mapEmployee(empResult.recordset[0], roles));
  } catch (err) {
    console.error('[employees GET /:id]', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

// POST /api/employees
router.post('/', async (req, res) => {
  try {
    const pool = await getPool();
    const { firstName, lastName, email, phone, department, title, managerId, systemRoles, status, joiningDate } = req.body;

    const maxResult = await pool.request().query(
      "SELECT ISNULL(MAX(CAST(REPLACE(Id, 'emp', '') AS INT)), 0) AS MaxNum FROM dbo.Employees"
    );
    const newId = 'emp' + String(maxResult.recordset[0].MaxNum + 1).padStart(3, '0');
    const resolvedRoles = systemRoles && systemRoles.length ? systemRoles : ['employee'];
    const resolvedDate = joiningDate || new Date().toISOString().split('T')[0];

    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      await new sql.Request(transaction)
        .input('id',          sql.VarChar,  newId)
        .input('firstName',   sql.NVarChar, firstName)
        .input('lastName',    sql.NVarChar, lastName)
        .input('email',       sql.NVarChar, email)
        .input('phone',       sql.NVarChar, phone || '')
        .input('department',  sql.NVarChar, department)
        .input('title',       sql.NVarChar, title)
        .input('managerId',   sql.VarChar,  managerId || null)
        .input('status',      sql.NVarChar, status || 'active')
        .input('joiningDate', sql.Date,     new Date(resolvedDate))
        .query(`INSERT INTO dbo.Employees
                  (Id, FirstName, LastName, Email, Phone, Department, Title, ManagerId, Status, JoiningDate)
                VALUES
                  (@id, @firstName, @lastName, @email, @phone, @department, @title, @managerId, @status, @joiningDate)`);

      for (const role of resolvedRoles) {
        await new sql.Request(transaction)
          .input('empId', sql.VarChar,  newId)
          .input('role',  sql.NVarChar, role)
          .query('INSERT INTO dbo.EmployeeRoles (EmployeeId, Role) VALUES (@empId, @role)');
      }
      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }

    res.status(201).json({
      id: newId, firstName, lastName, email,
      phone: phone || '', department, title,
      managerId: managerId || null,
      status: status || 'active',
      joiningDate: resolvedDate,
      systemRoles: resolvedRoles
    });
  } catch (err) {
    console.error('[employees POST /]', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

// PUT /api/employees/:id
router.put('/:id', async (req, res) => {
  try {
    const pool = await getPool();
    const id = req.params.id;
    const { firstName, lastName, email, phone, department, title, managerId, systemRoles, status, joiningDate } = req.body;

    const check = await pool.request()
      .input('id', sql.VarChar, id)
      .query('SELECT Id FROM dbo.Employees WHERE Id = @id');
    if (!check.recordset.length) return res.status(404).json({ error: 'Employee not found' });

    const resolvedRoles = systemRoles && systemRoles.length ? systemRoles : ['employee'];

    const transaction = new sql.Transaction(pool);
    await transaction.begin();
    try {
      await new sql.Request(transaction)
        .input('id',          sql.VarChar,  id)
        .input('firstName',   sql.NVarChar, firstName)
        .input('lastName',    sql.NVarChar, lastName)
        .input('email',       sql.NVarChar, email)
        .input('phone',       sql.NVarChar, phone || '')
        .input('department',  sql.NVarChar, department)
        .input('title',       sql.NVarChar, title)
        .input('managerId',   sql.VarChar,  managerId || null)
        .input('status',      sql.NVarChar, status || 'active')
        .input('joiningDate', sql.Date,     new Date(joiningDate))
        .query(`UPDATE dbo.Employees SET
                  FirstName   = @firstName,   LastName   = @lastName,
                  Email       = @email,       Phone      = @phone,
                  Department  = @department,  Title      = @title,
                  ManagerId   = @managerId,   Status     = @status,
                  JoiningDate = @joiningDate, UpdatedAt  = SYSUTCDATETIME()
                WHERE Id = @id`);

      await new sql.Request(transaction)
        .input('id', sql.VarChar, id)
        .query('DELETE FROM dbo.EmployeeRoles WHERE EmployeeId = @id');

      for (const role of resolvedRoles) {
        await new sql.Request(transaction)
          .input('empId', sql.VarChar,  id)
          .input('role',  sql.NVarChar, role)
          .query('INSERT INTO dbo.EmployeeRoles (EmployeeId, Role) VALUES (@empId, @role)');
      }
      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }

    res.json({
      id, firstName, lastName, email,
      phone: phone || '', department, title,
      managerId: managerId || null,
      status: status || 'active',
      joiningDate, systemRoles: resolvedRoles
    });
  } catch (err) {
    console.error('[employees PUT /:id]', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

// DELETE /api/employees/:id  — soft deactivate
router.delete('/:id', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.VarChar, req.params.id)
      .query("UPDATE dbo.Employees SET Status = 'inactive', UpdatedAt = SYSUTCDATETIME() WHERE Id = @id");
    if (result.rowsAffected[0] === 0) return res.status(404).json({ error: 'Employee not found' });
    res.json({ message: 'Employee deactivated successfully' });
  } catch (err) {
    console.error('[employees DELETE /:id]', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;
