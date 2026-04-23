// SQL Server connection using Windows Authentication (Integrated Security)
// Driver: msnodesqlv8  — requires ODBC Driver 17 or 18 for SQL Server
//
// If you have ODBC Driver 18 instead of 17, change the Driver name below:
//   Driver={ODBC Driver 18 for SQL Server}
//
// To install ODBC Driver 17:
//   https://learn.microsoft.com/en-us/sql/connect/odbc/download-odbc-driver-for-sql-server

const sql = require('mssql/msnodesqlv8');

const config = {
  connectionString:
    'Driver={ODBC Driver 17 for SQL Server};' +
    'Server=AZUKDSQL03;' +
    'Database=AI_Dev;' +
    'Trusted_Connection=yes;'
};

let pool = null;

const getPool = async () => {
  if (pool) return pool;
  pool = await sql.connect(config);
  console.log('[DB] Connected to AZUKDSQL03 / AI_Dev via Windows Authentication');
  return pool;
};

const closePool = async () => {
  if (pool) {
    await pool.close();
    pool = null;
  }
};

module.exports = { sql, getPool, closePool };
