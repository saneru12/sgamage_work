const nodemailer = require("nodemailer");

let cachedTransporter = null;
let cachedKey = "";

function toBool(value) {
  return ["1", "true", "yes", "on"].includes(String(value || "").trim().toLowerCase());
}

function getMailConfig() {
  const host = String(process.env.MAIL_HOST || "").trim();
  const port = Number(process.env.MAIL_PORT || 587);
  const secure = toBool(process.env.MAIL_SECURE) || port === 465;
  const user = String(process.env.MAIL_USER || "").trim();
  const pass = String(process.env.MAIL_PASS || "").trim();
  const fromEmail = String(process.env.MAIL_FROM_EMAIL || user || "").trim();
  const fromName = String(process.env.MAIL_FROM_NAME || "S.Gamage Constructions").trim();
  const replyTo = String(process.env.MAIL_REPLY_TO || "").trim();

  return {
    host,
    port,
    secure,
    user,
    pass,
    fromEmail,
    fromName,
    replyTo
  };
}

function isMailerConfigured() {
  const cfg = getMailConfig();
  return Boolean(cfg.host && cfg.port && cfg.fromEmail && (!cfg.user || cfg.pass));
}

function getTransporter() {
  const cfg = getMailConfig();
  if (!isMailerConfigured()) {
    throw new Error("SMTP email is not configured. Set MAIL_HOST, MAIL_PORT, MAIL_FROM_EMAIL and auth details in backend/.env.");
  }

  const cacheKey = JSON.stringify({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    user: cfg.user,
    pass: cfg.pass,
    fromEmail: cfg.fromEmail,
    fromName: cfg.fromName,
    replyTo: cfg.replyTo
  });

  if (!cachedTransporter || cachedKey !== cacheKey) {
    const transportConfig = {
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure
    };

    if (cfg.user) {
      transportConfig.auth = {
        user: cfg.user,
        pass: cfg.pass
      };
    }

    cachedTransporter = nodemailer.createTransport(transportConfig);
    cachedKey = cacheKey;
  }

  return { transporter: cachedTransporter, config: cfg };
}

async function sendMail({ to, subject, html, text, replyTo }) {
  const { transporter, config } = getTransporter();
  const info = await transporter.sendMail({
    from: config.fromName ? `"${config.fromName}" <${config.fromEmail}>` : config.fromEmail,
    to,
    subject,
    html,
    text,
    replyTo: replyTo || config.replyTo || undefined
  });
  return info;
}

module.exports = {
  getMailConfig,
  getTransporter,
  isMailerConfigured,
  sendMail
};
