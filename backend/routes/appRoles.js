const express = require('express');
const { sql, getPool } = require('../db/connection');

const router = express.Router();

const mapRole = (row) => ({
  id: row.Id,
  applicationId: row.ApplicationId,
  name: row.Name,
  description: row.Description,
  status: row.Status
});

// GET /api/app-roles[?applicationId=app001&status=active]
router.get('/', async (req, res) => {
  try {
    const pool = await getPool();
    const { applicationId, status } = req.query;
    const request = pool.request();
    const conditions = [];
    let query = 'SELECT * FROM dbo.AppRoles';

    if (applicationId) {
      conditions.push('ApplicationId = @applicationId');
      request.input('applicationId', sql.VarChar, applicationId);
    }
    if (status) {
      conditions.push('Status = @status');
      request.input('status', sql.NVarChar, status);
    }
    if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY ApplicationId, Name';

    const result = await request.query(query);
    res.json(result.recordset.map(mapRole));
  } catch (err) {
    console.error('[appRoles GET /]', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

// GET /api/app-roles/:id
router.get('/:id', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.VarChar, req.params.id)
      .query('SELECT * FROM dbo.AppRoles WHERE Id = @id');
    if (!result.recordset.length) return res.status(404).json({ error: 'Role not found' });
    res.json(mapRole(result.recordset[0]));
  } catch (err) {
    console.error('[appRoles GET /:id]', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

// POST /api/app-roles
router.post('/', async (req, res) => {
  try {
    const pool = await getPool();
    const { applicationId, name, description, status } = req.body;

    const maxResult = await pool.request().query(
      "SELECT ISNULL(MAX(CAST(REPLACE(Id, 'r', '') AS INT)), 0) AS MaxNum FROM dbo.AppRoles"
    );
    const newId = 'r' + String(maxResult.recordset[0].MaxNum + 1).padStart(3, '0');

    await pool.request()
      .input('id',            sql.VarChar,  newId)
      .input('applicationId', sql.VarChar,  applicationId)
      .input('name',          sql.NVarChar, name)
      .input('description',   sql.NVarChar, description)
      .input('status',        sql.NVarChar, status || 'active')
      .query(`INSERT INTO dbo.AppRoles (Id, ApplicationId, Name, Description, Status)
              VALUES (@id, @applicationId, @name, @description, @status)`);

    res.status(201).json({ id: newId, applicationId, name, description, status: status || 'active' });
  } catch (err) {
    console.error('[appRoles POST /]', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

// PUT /api/app-roles/:id
router.put('/:id', async (req, res) => {
  try {
    const pool = await getPool();
    const id = req.params.id;
    const { applicationId, name, description, status } = req.body;

    const result = await pool.request()
      .input('id',          sql.VarChar,  id)
      .input('name',        sql.NVarChar, name)
      .input('description', sql.NVarChar, description)
      .input('status',      sql.NVarChar, status || 'active')
      .query(`UPDATE dbo.AppRoles SET
                Name        = @name,
                Description = @description,
                Status      = @status,
                UpdatedAt   = SYSUTCDATETIME()
              WHERE Id = @id`);

    if (result.rowsAffected[0] === 0) return res.status(404).json({ error: 'Role not found' });
    res.json({ id, applicationId, name, description, status: status || 'active' });
  } catch (err) {
    console.error('[appRoles PUT /:id]', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

// DELETE /api/app-roles/:id  — soft deactivate
router.delete('/:id', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.VarChar, req.params.id)
      .query("UPDATE dbo.AppRoles SET Status = 'inactive', UpdatedAt = SYSUTCDATETIME() WHERE Id = @id");
    if (result.rowsAffected[0] === 0) return res.status(404).json({ error: 'Role not found' });
    res.json({ message: 'Role deactivated successfully' });
  } catch (err) {
    console.error('[appRoles DELETE /:id]', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;
