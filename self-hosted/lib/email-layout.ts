// HorseUp email layout for the deal room. Licensed under AGPL-3.0-only.
// Mirrors the look of HorseUp's product emails (logo, Syne title, Inter body,
// teal call to action, warm background, white 600px card). Styles only; no secrets.

export const LOGO_URL = 'https://horseup.de/logo.png';
const TEXT = "margin: 0 0 16px; font-family: 'Inter', sans-serif; font-size: 16px; line-height: 1.6; color: #3A231B;";

export function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Escapes a link for an href. Only http(s) URLs are allowed. The URL is not
 * re-encoded: sign-in links already carry percent-encoded parameters. */
export function safeHref(url: string): string {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') throw new Error('Unsupported link in email');
  return escapeHtml(url);
}

/** Section HTML is trusted markup built by the helpers below; every value inside must already be escaped. */
export type Section = { html: string };
export const paragraph = (text: string): Section => ({ html: `<p style="${TEXT}">${escapeHtml(text)}</p>` });
export const heading = (text: string): Section => ({ html: `<p style="${TEXT} margin-top: 24px; font-weight: 600;">${escapeHtml(text)}</p>` });
export const label = (text: string): Section => ({ html: `<p style="${TEXT} margin-bottom: 4px;">${escapeHtml(text)}</p>` });
export const list = (items: string[]): Section => ({ html: `<ul style="${TEXT} padding-left: 20px;">${items.map(item => `<li style="margin: 0 0 4px;">${escapeHtml(item)}</li>`).join('')}</ul>` });
export const link = (text: string, url: string): Section => ({ html: `<p style="${TEXT}"><a href="${safeHref(url)}" style="color: #027C81; font-weight: 600;">${escapeHtml(text)}</a></p>` });
export const small = (html: string): Section => ({ html: `<p style="margin: 0 0 8px; font-family: 'Inter', sans-serif; font-size: 12px; line-height: 1.5; color: #9CA3AF; text-align: center;">${html}</p>` });

export function renderEmail(params: { title: string; sections: Section[]; cta?: { label: string; url: string }; afterCta?: Section[]; footerNote?: string }) {
  const title = escapeHtml(params.title);
  const cta = params.cta
    ? `<a href="${safeHref(params.cta.url)}" style="display: inline-block; background-color: #027C81; color: #ffffff; font-family: 'Inter', sans-serif; font-weight: 600; font-size: 16px; padding: 12px 32px; text-decoration: none; border-radius: 6px;">${escapeHtml(params.cta.label)}</a>`
    : '';
  const afterCta = params.afterCta?.length ? `<div style="margin-top: 32px; text-align: left;">${params.afterCta.map(s => s.html).join('')}</div>` : '';
  const footerNote = params.footerNote ? `<p style="padding: 20px 0 0; text-align: center; font-size: 12px; color: #9CA3AF;">${escapeHtml(params.footerNote)}</p>` : '';
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - HorseUp</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600&family=Syne:wght@700&display=swap" rel="stylesheet">
  <style>
    body { margin: 0; padding: 0; background-color: #F9F4F2; }
    table { border-spacing: 0; border-collapse: collapse; }
    td { padding: 0; }
    img { border: 0; }
    @media only screen and (max-width: 600px) {
      .container { width: 100% !important; border-radius: 0 !important; }
      .content { padding: 20px !important; }
    }
  </style>
</head>
<body style="background-color: #F9F4F2; font-family: 'Inter', sans-serif; color: #3A231B; margin: 0; padding: 0;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" class="container" width="600" border="0" cellspacing="0" cellpadding="0"
          style="max-width: 600px; margin: 0 auto; background-color: #FFFFFF; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
          <tr>
            <td align="center" style="padding: 40px 0 20px; text-align: center;">
              <a href="https://horseup.de" target="_blank">
                <img src="${LOGO_URL}" alt="HorseUp" width="120" style="display: block; margin: 0 auto; border: 0; outline: none; text-decoration: none; -ms-interpolation-mode: bicubic; width: 120px; max-width: 100%;">
              </a>
            </td>
          </tr>
          <tr>
            <td class="content" style="padding: 20px 40px 40px; text-align: center;">
              <h1 style="font-family: 'Syne', sans-serif; font-weight: 700; font-size: 24px; margin-bottom: 16px; color: #3A231B;">${title}</h1>
              <div style="margin-bottom: 32px; text-align: left;">
                ${params.sections.map(s => s.html).join('')}
              </div>
              ${cta}
              ${afterCta}
              ${footerNote}
            </td>
          </tr>
          <tr>
            <td style="padding: 20px; text-align: center; font-size: 12px; color: #9CA3AF; background-color: #f8fafc;">
              &copy; 2026 HorseUp. All rights reserved.<br>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
