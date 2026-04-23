const express = require('express');
const cors = require('cors');

const employeesRouter = require('./routes/employees');
const applicationsRouter = require('./routes/applications');
const appRolesRouter = require('./routes/appRoles');
const accessRequestsRouter = require('./routes/accessRequests');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

app.use('/api/employees', employeesRouter);
app.use('/api/applications', applicationsRouter);
app.use('/api/app-roles', appRolesRouter);
app.use('/api/access-requests', accessRequestsRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Investcorp Access Portal backend running on http://localhost:${PORT}`);
});
