const express = require('express');
const { sql, getPool } = require('../db/connection');

const router = express.Router();

const mapApp = (row) => ({
  id: row.Id,
  name: row.Name,
  description: row.Description,
  ownerId: row.OwnerId,
  status: row.Status,
  category: row.Category,
  createdDate: row.CreatedDate instanceof Date
    ? row.CreatedDate.toISOString().split('T')[0]
    : row.CreatedDate
});

// GET /api/applications[?status=active]
router.get('/', async (req, res) => {
  try {
    const pool = await getPool();
    const { status } = req.query;
    const request = pool.request();
    let query = 'SELECT * FROM dbo.Applications';
    if (status) {
      query += ' WHERE Status = @status';
      request.input('status', sql.NVarChar, status);
    }
    query += ' ORDER BY Name';
    const result = await request.query(query);
    res.json(result.recordset.map(mapApp));
  } catch (err) {
    console.error('[applications GET /]', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

// GET /api/applications/:id
router.get('/:id', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.VarChar, req.params.id)
      .query('SELECT * FROM dbo.Applications WHERE Id = @id');
    if (!result.recordset.length) return res.status(404).json({ error: 'Application not found' });
    res.json(mapApp(result.recordset[0]));
  } catch (err) {
    console.error('[applications GET /:id]', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

// POST /api/applications
router.post('/', async (req, res) => {
  try {
    const pool = await getPool();
    const { name, description, ownerId, category, status } = req.body;

    const maxResult = await pool.request().query(
      "SELECT ISNULL(MAX(CAST(REPLACE(Id, 'app', '') AS INT)), 0) AS MaxNum FROM dbo.Applications"
    );
    const newId = 'app' + String(maxResult.recordset[0].MaxNum + 1).padStart(3, '0');
    const today = new Date().toISOString().split('T')[0];

    await pool.request()
      .input('id',          sql.VarChar,  newId)
      .input('name',        sql.NVarChar, name)
      .input('description', sql.NVarChar, description)
      .input('ownerId',     sql.VarChar,  ownerId)
      .input('category',    sql.NVarChar, category)
      .input('status',      sql.NVarChar, status || 'active')
      .input('createdDate', sql.Date,     new Date(today))
      .query(`INSERT INTO dbo.Applications (Id, Name, Description, OwnerId, Category, Status, CreatedDate)
              VALUES (@id, @name, @description, @ownerId, @category, @status, @createdDate)`);

    res.status(201).json({
      id: newId, name, description, ownerId, category,
      status: status || 'active', createdDate: today
    });
  } catch (err) {
    console.error('[applications POST /]', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

// PUT /api/applications/:id
router.put('/:id', async (req, res) => {
  try {
    const pool = await getPool();
    const id = req.params.id;
    const { name, description, ownerId, category, status, createdDate } = req.body;

    const result = await pool.request()
      .input('id',          sql.VarChar,  id)
      .input('name',        sql.NVarChar, name)
      .input('description', sql.NVarChar, description)
      .input('ownerId',     sql.VarChar,  ownerId)
      .input('category',    sql.NVarChar, category)
      .input('status',      sql.NVarChar, status || 'active')
      .query(`UPDATE dbo.Applications SET
                Name        = @name,     Description = @description,
                OwnerId     = @ownerId,  Category    = @category,
                Status      = @status,   UpdatedAt   = SYSUTCDATETIME()
              WHERE Id = @id`);

    if (result.rowsAffected[0] === 0) return res.status(404).json({ error: 'Application not found' });
    res.json({ id, name, description, ownerId, category, status: status || 'active', createdDate });
  } catch (err) {
    console.error('[applications PUT /:id]', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

// DELETE /api/applications/:id  — soft deactivate
router.delete('/:id', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.VarChar, req.params.id)
      .query("UPDATE dbo.Applications SET Status = 'inactive', UpdatedAt = SYSUTCDATETIME() WHERE Id = @id");
    if (result.rowsAffected[0] === 0) return res.status(404).json({ error: 'Application not found' });
    res.json({ message: 'Application deactivated successfully' });
  } catch (err) {
    console.error('[applications DELETE /:id]', err.message);
    res.status(500).json({ error: 'Database error' });
  }
});

module.exports = router;
