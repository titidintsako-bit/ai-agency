"""
integrations/email.py

Email notification service using the Resend API.

Only sends if RESEND_API_KEY and ALERT_EMAIL_TO are configured in settings.
Gracefully skips (returns False, logs a warning) when not configured.

Used for:
    - Escalation alerts: email the agency team when a conversation needs human review,
      including the full conversation transcript for immediate context.

Usage:
    from integrations.email import send_escalation_alert

    sent = await send_escalation_alert(
        client_name="SmileCare Dental",
        reason="complaint",
        summary="Patient is angry about a billing error.",
        conversation_id="...",
        escalation_id="...",
        user_identifier="web-abc123",
        transcript=[{"role": "user", "content": "..."}, ...],
    )
"""

import logging

import httpx

from config.settings import get_settings

logger = logging.getLogger(__name__)


async def send_escalation_alert(
    client_name: str,
    reason: str,
    summary: str,
    conversation_id: str,
    escalation_id: str,
    user_identifier: str | None = None,
    transcript: list[dict] | None = None,
) -> bool:
    """
    Send an escalation alert email via Resend.

    Args:
        client_name:      Business name (e.g. "SmileCare Dental").
        reason:           Escalation category (complaint, emergency, etc.).
        summary:          AI-generated 1-2 sentence summary.
        conversation_id:  UUID of the escalated conversation.
        escalation_id:    UUID of the escalation record.
        user_identifier:  Anonymous user reference (phone, session token).
        transcript:       List of {"role": ..., "content": ...} message dicts.

    Returns:
        True if the email was sent successfully, False otherwise.
    """
    settings = get_settings()

    if not settings.resend_api_key or not settings.alert_email_to:
        logger.debug("Email notifications not configured — skipping escalation alert.")
        return False

    short_ref = escalation_id.replace("-", "")[:8].upper()

    # ── Build transcript HTML block ────────────────────────────────────────
    transcript_html = ""
    if transcript:
        rows = []
        for msg in transcript:
            if msg["role"] not in ("user", "assistant"):
                continue
            role_label = "Customer" if msg["role"] == "user" else "Agent"
            role_color = "#e6edf3" if msg["role"] == "user" else "#818cf8"
            content    = msg["content"].replace("<", "&lt;").replace(">", "&gt;")
            rows.append(
                f'<tr>'
                f'<td style="padding:6px 12px;white-space:nowrap;font-weight:600;color:{role_color};'
                f'vertical-align:top;font-size:13px;">{role_label}</td>'
                f'<td style="padding:6px 12px;color:#e6edf3;font-size:13px;line-height:1.5;">{content}</td>'
                f'</tr>'
            )
        if rows:
            transcript_html = (
                '<hr style="border:none;border-top:1px solid #30363d;margin:20px 0;"/>'
                '<p style="font-size:12px;font-weight:700;text-transform:uppercase;'
                'letter-spacing:0.08em;color:#6e7681;margin:0 0 12px;">Conversation Transcript</p>'
                '<table style="width:100%;border-collapse:collapse;background:#0d1117;'
                'border-radius:8px;overflow:hidden;">'
                + "".join(rows)
                + "</table>"
            )

    # ── Reason → human-readable label ─────────────────────────────────────
    reason_labels = {
        "complaint":          "Customer Complaint",
        "appointment_failed": "Booking Failed",
        "out_of_scope":       "Out of Scope",
        "explicit_request":   "Requested Human",
        "other":              "Other",
    }
    reason_label = reason_labels.get(reason, reason.replace("_", " ").title())

    # ── HTML email ─────────────────────────────────────────────────────────
    html = f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#0d1117;font-family:system-ui,-apple-system,sans-serif;">
  <div style="max-width:600px;margin:32px auto;border-radius:12px;overflow:hidden;
              border:1px solid #30363d;background:#161b22;">

    <!-- Header -->
    <div style="background:linear-gradient(135deg,#f85149,#da3633);padding:20px 24px;">
      <p style="margin:0;font-size:11px;font-weight:700;text-transform:uppercase;
                letter-spacing:0.1em;color:rgba(255,255,255,0.7);">
        Escalation Alert
      </p>
      <h1 style="margin:4px 0 0;font-size:20px;color:white;font-weight:700;">
        {client_name}
      </h1>
      <p style="margin:6px 0 0;font-size:13px;color:rgba(255,255,255,0.8);">
        Reference: <strong>{short_ref}</strong> &nbsp;·&nbsp; {reason_label}
      </p>
    </div>

    <!-- Body -->
    <div style="padding:24px;">
      <!-- Summary -->
      <div style="background:#0d1117;border:1px solid #30363d;border-left:3px solid #f85149;
                  border-radius:8px;padding:16px;margin-bottom:20px;">
        <p style="margin:0 0 4px;font-size:11px;font-weight:700;text-transform:uppercase;
                  letter-spacing:0.08em;color:#6e7681;">Summary</p>
        <p style="margin:0;font-size:14px;color:#e6edf3;line-height:1.6;">{summary}</p>
      </div>

      <!-- Meta grid -->
      <table style="width:100%;border-collapse:collapse;margin-bottom:4px;">
        <tr>
          <td style="padding:8px 12px;background:#0d1117;border:1px solid #21262d;
                     border-radius:6px;width:50%;vertical-align:top;">
            <p style="margin:0 0 2px;font-size:11px;font-weight:700;text-transform:uppercase;
                      letter-spacing:0.07em;color:#6e7681;">User</p>
            <p style="margin:0;font-size:13px;color:#e6edf3;">{user_identifier or "Anonymous"}</p>
          </td>
          <td style="padding:0 0 0 8px;vertical-align:top;">
            <div style="padding:8px 12px;background:#0d1117;border:1px solid #21262d;border-radius:6px;">
              <p style="margin:0 0 2px;font-size:11px;font-weight:700;text-transform:uppercase;
                        letter-spacing:0.07em;color:#6e7681;">Conversation ID</p>
              <p style="margin:0;font-size:11px;color:#8b949e;font-family:monospace;">{conversation_id}</p>
            </div>
          </td>
        </tr>
      </table>

      {transcript_html}
    </div>

    <!-- Footer -->
    <div style="padding:16px 24px;border-top:1px solid #21262d;background:#0d1526;">
      <p style="margin:0;font-size:12px;color:#6e7681;text-align:center;">
        AI Agency Platform &nbsp;·&nbsp; Escalation {short_ref}
      </p>
    </div>
  </div>
</body>
</html>"""

    # ── Send via Resend ────────────────────────────────────────────────────
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                "https://api.resend.com/emails",
                headers={
                    "Authorization": f"Bearer {settings.resend_api_key}",
                    "Content-Type":  "application/json",
                },
                json={
                    "from":    settings.alert_email_from,
                    "to":      [settings.alert_email_to],
                    "subject": f"[Escalation {short_ref}] {client_name} — {reason_label}",
                    "html":    html,
                },
            )

        if response.status_code in (200, 201):
            logger.info(
                f"Escalation alert sent | ref: {short_ref} | to: {settings.alert_email_to}"
            )
            return True
        else:
            logger.warning(
                f"Resend returned {response.status_code} for escalation {short_ref}: {response.text}"
            )
            return False

    except Exception as e:
        logger.error(f"Failed to send escalation alert email: {e}")
        return False
