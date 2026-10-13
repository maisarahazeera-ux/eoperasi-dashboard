using System.Globalization;
using System.Net;

namespace EOperasiApi.Services;

/// <summary>
/// Bilingual (BM / English) account emails in the same style as the password-reset email.
/// HTML attributes use single quotes so the C# strings need no escaping.
/// </summary>
public static class EmailTemplates
{
    private static string E(string s) => WebUtility.HtmlEncode(s);

    private static string Expiry(DateTime utc) =>
        utc.AddHours(8).ToString("dd/MM/yyyy, h:mm tt", CultureInfo.InvariantCulture); // Malaysia time

    public const string VerifySubject = "e-Operasi: Pengesahan E-mel / Email Verification";
    public const string ApprovedSubject = "e-Operasi: Akaun Diluluskan / Account Approved";

    public static string VerifyEmail(string fullName, string username, string link, DateTime expiresUtc, bool needsApproval)
    {
        var name = E(string.IsNullOrWhiteSpace(fullName) ? username : fullName);
        var user = E(username);
        var url = E(link);
        var expiry = Expiry(expiresUtc);

        var approvalBm = needsApproval
            ? "<p style='margin:0 0 14px;'>Oleh kerana akaun ini didaftarkan dengan e-mel selain e-mel rasmi KPM (@moe.gov.my), akaun anda perlu <strong>diluluskan oleh pentadbir</strong> selepas pengesahan. Anda akan dimaklumkan melalui e-mel apabila akaun diluluskan.</p>"
            : "<p style='margin:0 0 14px;'>Selepas pengesahan, anda boleh terus log masuk ke sistem e-Operasi.</p>";
        var approvalEn = needsApproval
            ? " Because this account was registered with an email other than an official KPM email (@moe.gov.my), an administrator must approve it after verification. You will be notified by email once it is approved."
            : " After verifying, you can log in to e-Operasi straight away.";

        return Layout($@"
        <p style='margin:0 0 14px;'>Tuan/Puan <strong>{name}</strong>,</p>
        <p style='margin:0 0 14px;'>Terima kasih kerana mendaftar akaun e-Operasi (<strong>{user}</strong>). Sila sahkan alamat e-mel anda dengan menekan butang di bawah. Pautan ini sah sehingga <strong>{expiry}</strong> (waktu Malaysia).</p>
        {approvalBm}
        {Button(url, "Sahkan E-mel")}
        <p style='margin:0 0 6px;font-size:12px;color:#5B6576;'>Sekiranya butang di atas tidak berfungsi, sila salin dan tampal pautan berikut ke dalam pelayar web anda:</p>
        <p style='margin:0 0 20px;font-size:12px;word-break:break-all;'><a href='{url}' style='color:#2F62B5;'>{url}</a></p>
        <p style='margin:0 0 14px;'>Sekiranya anda tidak mendaftar akaun ini, sila abaikan e-mel ini.</p>",
            $"Thank you for registering an e-Operasi account (<strong>{user}</strong>). Please verify your email address using the button above. The link is valid until <strong>{expiry}</strong> (Malaysia time).{approvalEn} If you did not register this account, please ignore this email.");
    }

    public static string AccountApproved(string fullName, string username, string loginLink)
    {
        var name = E(string.IsNullOrWhiteSpace(fullName) ? username : fullName);
        var user = E(username);
        var url = E(loginLink);

        return Layout($@"
        <p style='margin:0 0 14px;'>Tuan/Puan <strong>{name}</strong>,</p>
        <p style='margin:0 0 14px;'>Akaun e-Operasi anda (<strong>{user}</strong>) telah <strong>diluluskan</strong> oleh pentadbir. Anda kini boleh log masuk ke sistem.</p>
        {Button(url, "Log Masuk")}",
            $"Your e-Operasi account (<strong>{user}</strong>) has been approved by an administrator. You can now log in.");
    }

    private static string Button(string url, string label) => $@"
        <p style='margin:0 0 22px;text-align:center;'>
          <a href='{url}' style='display:inline-block;padding:12px 28px;background:#2F62B5;color:#FFFFFF;text-decoration:none;font-weight:700;border-radius:999px;'>{label}</a>
        </p>";

    private static string Layout(string bodyBm, string bodyEn) => $@"
<div style='margin:0;padding:24px 12px;background:#EEF2F8;font-family:Segoe UI,Arial,sans-serif;color:#152033;'>
  <table role='presentation' width='100%' cellpadding='0' cellspacing='0' style='max-width:560px;margin:0 auto;background:#FFFFFF;border:1px solid #E3E8F0;border-radius:16px;'>
    <tr>
      <td style='padding:22px 28px;border-bottom:1px solid #E3E8F0;'>
        <div style='font-size:18px;font-weight:700;color:#1F4FA0;'>e-Operasi</div>
        <div style='font-size:12px;color:#5B6576;'>Pejabat Pendidikan Daerah Johor Bahru</div>
      </td>
    </tr>
    <tr>
      <td style='padding:26px 28px 8px;font-size:14px;line-height:1.65;'>
        {bodyBm}
        <p style='margin:0 0 4px;'>Sekian, terima kasih.</p>
        <p style='margin:0 0 20px;'><strong>Pentadbir Sistem e-Operasi</strong><br>Pejabat Pendidikan Daerah Johor Bahru</p>
      </td>
    </tr>
    <tr>
      <td style='padding:16px 28px 20px;border-top:1px solid #E3E8F0;font-size:12.5px;line-height:1.6;color:#5B6576;'>
        <p style='margin:0 0 8px;'><strong>English:</strong> {bodyEn}</p>
      </td>
    </tr>
    <tr>
      <td style='padding:14px 28px 20px;background:#F8FAFC;border-top:1px solid #E3E8F0;border-radius:0 0 16px 16px;font-size:11px;line-height:1.6;color:#748198;'>
        E-mel ini dijana secara automatik oleh sistem e-Operasi. Sila jangan balas e-mel ini.<br>
        This is an automated message. Please do not reply.<br>
        Pertanyaan / Enquiries: <a href='mailto:helpeoperasi@moe.gov.my' style='color:#2F62B5;'>helpeoperasi@moe.gov.my</a>
      </td>
    </tr>
  </table>
</div>";
}
