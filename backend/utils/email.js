const { sql } = require('../db/connection');

// ── Low-level sender ──────────────────────────────────────────────────────────
const sendMail = async (pool, to, subject, body) => {
  if (!to) return;
  try {
    await pool.request()
      .input('to',      sql.NVarChar, to)
      .input('subject', sql.NVarChar, subject)
      .input('body',    sql.NVarChar, body)
      .query(`EXEC msdb.dbo.sp_send_dbmail
                @recipients  = @to,
                @subject     = @subject,
                @body        = @body,
                @body_format = 'HTML'`);
    console.log(`[Email] Sent → ${to} | ${subject}`);
  } catch (err) {
    console.error(`[Email] Failed → ${to}:`, err.message);
  }
};

// ── Fetch all people involved in a request ────────────────────────────────────
const fetchContext = async (pool, requestorId, applicationId, roleId) => {
  const [reqResult, appResult, roleResult] = await Promise.all([
    pool.request()
      .input('id', sql.VarChar, requestorId)
      .query('SELECT Id, FirstName, LastName, Email, ManagerId FROM dbo.Employees WHERE Id = @id'),
    pool.request()
      .input('id', sql.VarChar, applicationId)
      .query('SELECT Id, Name, OwnerId FROM dbo.Applications WHERE Id = @id'),
    pool.request()
      .input('id', sql.VarChar, roleId)
      .query('SELECT Name FROM dbo.AppRoles WHERE Id = @id')
  ]);

  const requestor = reqResult.recordset[0] || null;
  const app       = appResult.recordset[0]  || null;
  const role      = roleResult.recordset[0] || null;

  let manager = null;
  if (requestor?.ManagerId) {
    const r = await pool.request()
      .input('id', sql.VarChar, requestor.ManagerId)
      .query('SELECT FirstName, LastName, Email FROM dbo.Employees WHERE Id = @id');
    manager = r.recordset[0] || null;
  }

  let appOwner = null;
  if (app?.OwnerId) {
    const r = await pool.request()
      .input('id', sql.VarChar, app.OwnerId)
      .query('SELECT FirstName, LastName, Email FROM dbo.Employees WHERE Id = @id');
    appOwner = r.recordset[0] || null;
  }

  const itResult = await pool.request().query(
    `SELECT e.Email FROM dbo.Employees e
       JOIN dbo.EmployeeRoles r ON e.Id = r.EmployeeId
      WHERE r.Role = 'it_security' AND e.Status = 'active'`
  );
  const itSecEmails = itResult.recordset.map(r => r.Email).join(';');

  return { requestor, app, role, manager, appOwner, itSecEmails };
};

// ── Shared HTML summary table ─────────────────────────────────────────────────
const summaryHtml = (requestor, app, role, justification) => `
  <table style="border-collapse:collapse;margin:10px 0;font-family:sans-serif;font-size:14px">
    <tr><td style="padding:4px 16px 4px 0;color:#555"><b>Requestor</b></td><td>${requestor.FirstName} ${requestor.LastName} (${requestor.Email})</td></tr>
    <tr><td style="padding:4px 16px 4px 0;color:#555"><b>Application</b></td><td>${app?.Name || '—'}</td></tr>
    <tr><td style="padding:4px 16px 4px 0;color:#555"><b>Role</b></td><td>${role?.Name || '—'}</td></tr>
    <tr><td style="padding:4px 16px 4px 0;color:#555"><b>Justification</b></td><td>${justification}</td></tr>
  </table>`;

const commentsHtml = (comments) =>
  comments ? `<p style="font-family:sans-serif;font-size:14px"><b>Comments:</b> ${comments}</p>` : '';

// ── Public helpers called from routes ─────────────────────────────────────────

// Called after a new request is created — notifies the requestor's manager
const notifyNewRequest = async (pool, { requestorId, applicationId, roleId, businessJustification }) => {
  try {
    const ctx = await fetchContext(pool, requestorId, applicationId, roleId);
    if (!ctx.manager?.Email) return;

    await sendMail(
      pool,
      ctx.manager.Email,
      `Action Required: Access Request from ${ctx.requestor.FirstName} ${ctx.requestor.LastName}`,
      `<p style="font-family:sans-serif;font-size:14px">Dear ${ctx.manager.FirstName},</p>
       <p style="font-family:sans-serif;font-size:14px">
         <b>${ctx.requestor.FirstName} ${ctx.requestor.LastName}</b> has submitted an access request that requires your approval:
       </p>
       ${summaryHtml(ctx.requestor, ctx.app, ctx.role, businessJustification)}
       <p style="font-family:sans-serif;font-size:14px">Please log in to the <b>Investcorp Access Portal</b> to approve or reject this request.</p>`
    );
  } catch (err) {
    console.error('[Email] notifyNewRequest failed:', err.message);
  }
};

// Called after an approval action — notifies the next approver or the requestor
const notifyApprovalAction = async (pool, { requestorId, applicationId, roleId, businessJustification, newStatus, comments }) => {
  try {
    const ctx  = await fetchContext(pool, requestorId, applicationId, roleId);
    const sum  = summaryHtml(ctx.requestor, ctx.app, ctx.role, businessJustification);
    const cmts = commentsHtml(comments);

    if (newStatus === 'pending_app_owner' && ctx.appOwner?.Email) {
      await sendMail(
        pool,
        ctx.appOwner.Email,
        `Action Required: Access Request for ${ctx.app?.Name}`,
        `<p style="font-family:sans-serif;font-size:14px">Dear ${ctx.appOwner.FirstName},</p>
         <p style="font-family:sans-serif;font-size:14px">
           An access request approved by the manager now requires your approval:
         </p>
         ${sum}${cmts}
         <p style="font-family:sans-serif;font-size:14px">Please log in to the <b>Investcorp Access Portal</b> to approve or reject this request.</p>`
      );
    }

    if (newStatus === 'pending_it_security' && ctx.itSecEmails) {
      await sendMail(
        pool,
        ctx.itSecEmails,
        `Action Required: Access Request for ${ctx.app?.Name}`,
        `<p style="font-family:sans-serif;font-size:14px">Dear IT Security Team,</p>
         <p style="font-family:sans-serif;font-size:14px">
           An access request approved by the application owner now requires your final approval:
         </p>
         ${sum}${cmts}
         <p style="font-family:sans-serif;font-size:14px">Please log in to the <b>Investcorp Access Portal</b> to approve or reject this request.</p>`
      );
    }

    if (newStatus === 'approved') {
      await sendMail(
        pool,
        ctx.requestor.Email,
        `Your Access Request Has Been Approved — ${ctx.app?.Name}`,
        `<p style="font-family:sans-serif;font-size:14px">Dear ${ctx.requestor.FirstName},</p>
         <p style="font-family:sans-serif;font-size:14px">Your access request has been fully approved.</p>
         ${sum}${cmts}
         <p style="font-family:sans-serif;font-size:14px">
           You should now have access to the requested application and role.<br>
           If you encounter any issues, please contact IT support.
         </p>`
      );
    }

    if (newStatus === 'rejected') {
      await sendMail(
        pool,
        ctx.requestor.Email,
        `Your Access Request Has Been Rejected — ${ctx.app?.Name}`,
        `<p style="font-family:sans-serif;font-size:14px">Dear ${ctx.requestor.FirstName},</p>
         <p style="font-family:sans-serif;font-size:14px">Unfortunately, your access request has been rejected.</p>
         ${sum}${cmts}
         <p style="font-family:sans-serif;font-size:14px">
           If you have questions, please contact your manager or the application owner.
         </p>`
      );
    }
  } catch (err) {
    console.error('[Email] notifyApprovalAction failed:', err.message);
  }
};

module.exports = { notifyNewRequest, notifyApprovalAction };
