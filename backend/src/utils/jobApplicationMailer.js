function escapeHTML(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatDateTime(value) {
  if (!value) return "";
  try {
    return new Intl.DateTimeFormat("en-LK", {
      dateStyle: "full",
      timeStyle: "short",
      timeZone: process.env.COMPANY_TIMEZONE || "Asia/Colombo"
    }).format(new Date(value));
  } catch {
    return String(value || "");
  }
}

function getDefaultSubject({ responseType, siteName, jobTitle }) {
  const company = siteName || "S.Gamage Constructions";
  const title = jobTitle || "your application";

  switch (responseType) {
    case "shortlist_update":
      return `${company} - Shortlisted for ${title}`;
    case "interview_invitation":
      return `${company} - Interview Invitation for ${title}`;
    case "request_more_info":
      return `${company} - Additional Information Needed for ${title}`;
    case "approval":
      return `${company} - Next Step for ${title}`;
    case "rejection":
      return `${company} - Update on ${title}`;
    case "internal_note":
      return `${company} - Internal Application Note`;
    default:
      return `${company} - Update on ${title}`;
  }
}

function getDefaultMessage({ responseType, candidateName, siteName, jobTitle }) {
  const name = candidateName || "Applicant";
  const company = siteName || "S.Gamage Constructions";
  const title = jobTitle || "the position";

  switch (responseType) {
    case "shortlist_update":
      return `Dear ${name},\n\nThank you for applying for the ${title} role. After reviewing your application, we are pleased to let you know that you have been shortlisted for the next stage.\n\nOur team will contact you again with the next step shortly.\n\nBest regards,\n${company}`;
    case "interview_invitation":
      return `Dear ${name},\n\nThank you for applying for the ${title} role. We would like to invite you to the next step of the hiring process. Please review the interview details below and reply if you need any clarification.\n\nBest regards,\n${company}`;
    case "request_more_info":
      return `Dear ${name},\n\nThank you for applying for the ${title} role. Before we move your application to the next stage, we need a little more information from you. Please reply to this email with the requested details when convenient.\n\nBest regards,\n${company}`;
    case "approval":
      return `Dear ${name},\n\nThank you for your interest in the ${title} role. We are happy to move your application to the next confirmed step. Please review the details below and contact us if you need anything clarified.\n\nBest regards,\n${company}`;
    case "rejection":
      return `Dear ${name},\n\nThank you for taking the time to apply for the ${title} role. After careful review, we will not be moving forward with your application at this stage. We appreciate your interest in ${company} and wish you all the best in your career.\n\nBest regards,\n${company}`;
    default:
      return `Dear ${name},\n\nThank you for applying for the ${title} role. This is an update from ${company} regarding your application.\n\nBest regards,\n${company}`;
  }
}

function buildInterviewRows(payload) {
  const rows = [];

  if (payload.interviewDateTime) {
    rows.push({
      label: "Interview date & time",
      value: formatDateTime(payload.interviewDateTime)
    });
  }

  if (payload.interviewEndTime) {
    rows.push({
      label: "Expected end time",
      value: formatDateTime(payload.interviewEndTime)
    });
  }

  if (payload.interviewMode) {
    rows.push({
      label: "Interview type",
      value: payload.interviewMode
    });
  }

  if (payload.interviewLocation) {
    rows.push({
      label: String(payload.interviewMode || "").toLowerCase() === "online" ? "Meeting details" : "Location",
      value: payload.interviewLocation
    });
  }

  if (payload.meetingLink) {
    rows.push({
      label: "Meeting link",
      value: payload.meetingLink
    });
  }

  return rows;
}

function buildJobApplicationEmail({ application, job, settings, payload }) {
  const siteName = String(settings?.siteName || "S.Gamage Constructions").trim() || "S.Gamage Constructions";
  const siteEmail = String(settings?.email || process.env.MAIL_REPLY_TO || "").trim();
  const sitePhone = String(settings?.phone || "").trim();
  const companyAddress = String(settings?.address || "Sri Lanka").trim();
  const candidateName = String(application?.fullName || "Applicant").trim();
  const jobTitle = String(job?.title || application?.jobId?.title || "your application").trim();
  const responseType = String(payload?.responseType || "custom_update").trim() || "custom_update";

  const subject = String(payload?.subject || "").trim() || getDefaultSubject({ responseType, siteName, jobTitle });
  const messageBody = String(payload?.message || "").trim() || getDefaultMessage({ responseType, candidateName, siteName, jobTitle });
  const note = String(payload?.note || "").trim();

  const interviewRows = buildInterviewRows(payload);
  const safeParagraphs = messageBody
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => `<p style="margin:0 0 14px; line-height:1.7; color:#0f172a;">${escapeHTML(part).replace(/\n/g, "<br />")}</p>`)
    .join("");

  const interviewHtml = interviewRows.length
    ? `
      <div style="margin:20px 0; padding:16px; border:1px solid #dbeafe; border-radius:16px; background:#eff6ff;">
        <div style="font-size:13px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:#1d4ed8; margin-bottom:10px;">Interview details</div>
        ${interviewRows.map((row) => `
          <div style="margin-bottom:10px;">
            <div style="font-size:12px; color:#475569;">${escapeHTML(row.label)}</div>
            <div style="font-size:15px; font-weight:600; color:#0f172a; word-break:break-word;">${escapeHTML(row.value)}</div>
          </div>
        `).join("")}
      </div>
    `
    : "";

  const noteHtml = note
    ? `
      <div style="margin:20px 0; padding:16px; border:1px dashed #cbd5e1; border-radius:16px; background:#f8fafc;">
        <div style="font-size:13px; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:#0f172a; margin-bottom:8px;">Additional note</div>
        <div style="font-size:14px; color:#334155; line-height:1.7; white-space:pre-line;">${escapeHTML(note)}</div>
      </div>
    `
    : "";

  const contactBits = [siteEmail, sitePhone, companyAddress].filter(Boolean);

  const html = `
    <div style="margin:0; padding:24px; background:#f8fafc; font-family:Arial, Helvetica, sans-serif; color:#0f172a;">
      <div style="max-width:720px; margin:0 auto; background:#ffffff; border:1px solid #e2e8f0; border-radius:20px; overflow:hidden;">
        <div style="padding:22px 24px; background:#0f172a; color:#ffffff;">
          <div style="font-size:12px; letter-spacing:.1em; text-transform:uppercase; opacity:.8;">Application update</div>
          <h1 style="margin:10px 0 0; font-size:24px; line-height:1.3;">${escapeHTML(siteName)}</h1>
          <div style="margin-top:8px; font-size:14px; opacity:.9;">Job role: ${escapeHTML(jobTitle)}</div>
        </div>
        <div style="padding:24px;">
          ${safeParagraphs}
          ${interviewHtml}
          ${noteHtml}
          <div style="margin-top:20px; padding-top:16px; border-top:1px solid #e2e8f0; font-size:13px; color:#475569; line-height:1.7;">
            ${contactBits.length ? `<div><strong>Contact us:</strong> ${escapeHTML(contactBits.join(" • "))}</div>` : ""}
            <div style="margin-top:8px;">This message was sent regarding your application for <strong>${escapeHTML(jobTitle)}</strong>.</div>
          </div>
        </div>
      </div>
    </div>
  `;

  const textSections = [
    messageBody,
    interviewRows.length ? "" : null,
    interviewRows.length ? "Interview details:" : null,
    ...interviewRows.map((row) => `${row.label}: ${row.value}`),
    note ? "" : null,
    note ? `Additional note: ${note}` : null,
    "",
    `Job role: ${jobTitle}`,
    contactBits.length ? `Contact us: ${contactBits.join(" | ")}` : null,
    `Best regards,\n${siteName}`
  ].filter((value) => value !== null);

  return {
    subject,
    html,
    text: textSections.join("\n"),
    messageBody,
    note,
    interviewSummary: interviewRows
  };
}

module.exports = {
  buildJobApplicationEmail,
  formatDateTime
};
