using System.Net;
using System.Net.Mail;

namespace EOperasiApi.Services;

/// <summary>
/// Sends real email via SMTP when the Smtp:Host config is set. When it's not
/// configured (e.g. fresh local dev checkout with no mail credentials yet),
/// falls back to writing the email to the console so the flow is still
/// testable end-to-end without needing real SMTP access.
/// </summary>
public class SmtpEmailSender : IEmailSender
{
    private readonly IConfiguration _config;
    private readonly ILogger<SmtpEmailSender> _logger;

    public SmtpEmailSender(IConfiguration config, ILogger<SmtpEmailSender> logger)
    {
        _config = config;
        _logger = logger;
    }

    public async Task SendAsync(string toEmail, string subject, string bodyHtml)
    {
        var host = _config["Smtp:Host"];

        if (string.IsNullOrWhiteSpace(host))
        {
            // No SMTP configured — log it instead so local dev can still grab the link.
            _logger.LogWarning(
                "Smtp:Host is not configured — printing email instead of sending it.\n" +
                "To: {ToEmail}\nSubject: {Subject}\n{Body}",
                toEmail, subject, bodyHtml
            );
            Console.WriteLine("========== EMAIL (Smtp:Host not configured) ==========");
            Console.WriteLine($"To: {toEmail}");
            Console.WriteLine($"Subject: {subject}");
            Console.WriteLine(bodyHtml);
            Console.WriteLine("========================================================");
            return;
        }

        var port = int.Parse(_config["Smtp:Port"] ?? "587");
        var username = _config["Smtp:Username"] ?? "";
        var password = _config["Smtp:Password"] ?? "";
        var fromEmail = _config["Smtp:FromEmail"] ?? username;
        var fromName = _config["Smtp:FromName"] ?? "e-Operasi PPD Johor Bahru";
        var enableSsl = bool.Parse(_config["Smtp:EnableSsl"] ?? "true");

        using var client = new SmtpClient(host, port)
        {
            Credentials = new NetworkCredential(username, password),
            EnableSsl = enableSsl,
        };

        using var message = new MailMessage
        {
            From = new MailAddress(fromEmail, fromName),
            Subject = subject,
            Body = bodyHtml,
            IsBodyHtml = true,
        };
        message.To.Add(toEmail);

        await client.SendMailAsync(message);
    }
}
