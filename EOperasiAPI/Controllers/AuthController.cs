using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using EOperasiApi.Models;
using EOperasiApi.Services;

namespace EOperasiApi.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IConfiguration _config;
    private readonly IEmailSender _emailSender;
    private readonly ActivityLogger _activity;

    public AuthController(AppDbContext db, IConfiguration config, IEmailSender emailSender, ActivityLogger activity)
    {
        _db = db;
        _config = config;
        _emailSender = emailSender;
        _activity = activity;
    }

    [HttpPost("login")]
    [EnableRateLimiting("auth")]
    public async Task<ActionResult<LoginResponse>> Login(LoginRequest request)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Username == request.Username);

        if (user == null || !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
        {
            await _activity.LogAsync(ActivityAction.LoginFailed,
                user == null ? "Unknown username" : "Wrong password", request.Username ?? "", user?.FullName ?? "");
            return Unauthorized(new { message = "Invalid username or password" });
        }

        // Only active accounts may log in. "code" lets the Login page show the right message.
        if (user.Status != UserStatus.Active)
        {
            await _activity.LogAsync(ActivityAction.LoginFailed, $"Account {user.Status}", user.Username, user.FullName);
            return StatusCode(StatusCodes.Status403Forbidden, new { code = user.Status, message = user.Status switch
            {
                UserStatus.Unverified => "Please verify your email first.",
                UserStatus.Pending => "Your account is waiting for administrator approval.",
                _ => "This account has been deactivated.",
            } });
        }

        // Remember login times for "Login Terakhir" on the Profile page.
        user.PreviousLoginAt = user.LastLoginAt;
        user.LastLoginAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        await _activity.LogAsync(ActivityAction.Login, "", user.Username, user.FullName);

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_config["Jwt:Key"]!));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new List<Claim>
        {
            new Claim(ClaimTypes.Name, user.Username),
            new Claim(ClaimTypes.Role, user.Role),
        };

        var token = new JwtSecurityToken(
            issuer: _config["Jwt:Issuer"],
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(double.Parse(_config["Jwt:ExpiresInMinutes"]!)),
            signingCredentials: creds
        );

        return Ok(new LoginResponse
        {
            Token = new JwtSecurityTokenHandler().WriteToken(token),
            Username = user.Username,
            Role = user.Role,
            FullName = user.FullName
        });
    }

    [HttpPost("register")]
    [EnableRateLimiting("auth")]
    public async Task<ActionResult> Register(RegisterRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Username) || string.IsNullOrWhiteSpace(request.Password))
        {
            return BadRequest(new { message = "Username and password are required" });
        }
        if (string.IsNullOrWhiteSpace(request.FullName))
        {
            return BadRequest(new { message = "Full name is required" });
        }
        if (string.IsNullOrWhiteSpace(request.Email))
        {
            return BadRequest(new { message = "Email is required" });
        }
        if (string.IsNullOrWhiteSpace(request.Jawatan) || string.IsNullOrWhiteSpace(request.Sektor))
        {
            return BadRequest(new { message = "Position and sector are required" });
        }

        var email = request.Email.Trim();
        if (!IsValidEmail(email))
        {
            return BadRequest(new { code = "invalidEmail", message = "Invalid email address" });
        }
        if (request.Password.Length < 6)
        {
            return BadRequest(new { code = "passwordTooShort", message = "Password must be at least 6 characters" });
        }

        // An account that was never verified and whose link has expired doesn't
        // block the username/email forever: it is removed and can be registered again.
        var now = DateTime.UtcNow;
        var stale = await _db.Users
            .Where(u => u.Status == UserStatus.Unverified && u.EmailVerifyExpiresAt < now
                        && (u.Username == request.Username || u.Email.ToLower() == email.ToLower()))
            .ToListAsync();
        if (stale.Count > 0)
        {
            _db.Users.RemoveRange(stale);
            await _db.SaveChangesAsync();
        }

        var usernameTaken = await _db.Users.AnyAsync(u => u.Username == request.Username);
        if (usernameTaken)
        {
            return Conflict(new { message = "Username already taken" });
        }
        var emailTaken = await _db.Users.AnyAsync(u => u.Email.ToLower() == email.ToLower());
        if (emailTaken)
        {
            return Conflict(new { message = "Email already registered" });
        }

        var rawToken = GenerateSecureToken();
        var user = new User
        {
            Username = request.Username,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            Role = "staff",
            FullName = request.FullName,
            Email = email,
            Jawatan = CleanText(request.Jawatan, 150),
            JabatanBahagian = CleanText(request.JabatanBahagian, 150),
            Sektor = CleanText(request.Sektor, 150),
            Status = UserStatus.Unverified,
            CreatedAt = now,
            EmailVerifyTokenHash = HashToken(rawToken),
            EmailVerifyExpiresAt = now.AddHours(VerifyLinkHours),
        };

        _db.Users.Add(user);
        await _db.SaveChangesAsync();

        var emailSent = await SendVerificationEmail(user, rawToken);
        await _activity.LogAsync(ActivityAction.Register,
            $"{user.Email} · {(UserStatus.IsOfficialEmail(user.Email) ? "official email" : "other email")}", user.Username, user.FullName);

        return Created(string.Empty, new
        {
            username = user.Username,
            role = user.Role,
            status = user.Status,
            officialEmail = UserStatus.IsOfficialEmail(user.Email),
            emailSent,
        });
    }

    /// <summary>The link in the verification email lands here (via the frontend).</summary>
    [HttpPost("verify-email")]
    [EnableRateLimiting("auth")]
    public async Task<ActionResult> VerifyEmail(VerifyEmailRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Token))
            return BadRequest(new { code = "invalidOrExpired" });

        var tokenHash = HashToken(request.Token);
        var user = await _db.Users.FirstOrDefaultAsync(u => u.EmailVerifyTokenHash == tokenHash);
        if (user == null || user.Status != UserStatus.Unverified || user.EmailVerifyExpiresAt < DateTime.UtcNow)
            return BadRequest(new { code = "invalidOrExpired" });

        // Official KPM email -> can log in now. Anything else -> an admin approves first.
        user.Status = UserStatus.IsOfficialEmail(user.Email) ? UserStatus.Active : UserStatus.Pending;
        user.StatusUpdatedAt = DateTime.UtcNow;
        user.StatusUpdatedBy = "system";
        user.EmailVerifyTokenHash = null;
        user.EmailVerifyExpiresAt = null;
        await _db.SaveChangesAsync();
        await _activity.LogAsync(ActivityAction.VerifyEmail, $"Now {user.Status}", user.Username, user.FullName);

        return Ok(new { status = user.Status, username = user.Username });
    }

    /// <summary>Sends a new verification link. Same reply whether or not the account exists.</summary>
    [HttpPost("resend-verification")]
    [EnableRateLimiting("auth")]
    public async Task<ActionResult> ResendVerification(ResendVerificationRequest request)
    {
        var login = request.Login?.Trim() ?? "";
        if (login.Length > 0)
        {
            var user = await _db.Users.FirstOrDefaultAsync(u =>
                u.Status == UserStatus.Unverified && (u.Username == login || u.Email.ToLower() == login.ToLower()));
            if (user != null)
            {
                var rawToken = GenerateSecureToken();
                user.EmailVerifyTokenHash = HashToken(rawToken);
                user.EmailVerifyExpiresAt = DateTime.UtcNow.AddHours(VerifyLinkHours);
                await _db.SaveChangesAsync();
                await SendVerificationEmail(user, rawToken);
            }
        }
        return Ok(new { message = "If that account is waiting for verification, a new link has been sent." });
    }

    [HttpPost("forgot-password")]
    [EnableRateLimiting("auth")]
    public async Task<ActionResult> ForgotPassword(ForgotPasswordRequest request)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Email == request.Email);

        // Always return the same generic response whether or not the email
        // exists, so this endpoint can't be used to check which emails are
        // registered.
        if (user != null)
        {
            var rawToken = GenerateSecureToken();
            user.PasswordResetTokenHash = HashToken(rawToken);
            user.PasswordResetExpiresAt = DateTime.UtcNow.AddHours(1);
            await _db.SaveChangesAsync();

            // Send the link back to the address the user actually opened the
            // dashboard from (e.g. http://192.168.1.25:8443 on the office network),
            // falling back to FrontendUrl in appsettings.json.
            var frontendUrl = FrontendBase();
            var resetLink = $"{frontendUrl}/?resetToken={Uri.EscapeDataString(rawToken)}";

            // Expiry time shown to the user in Malaysia time (UTC+8).
            var expiresLocal = user.PasswordResetExpiresAt.Value.AddHours(8);
            var body = BuildResetEmail(user.FullName, user.Username, resetLink, expiresLocal);
            await _emailSender.SendAsync(
                user.Email,
                "e-Operasi: Permohonan Tetapan Semula Kata Laluan / Password Reset Request",
                body);
        }

        return Ok(new { message = "If that email is registered, a reset link has been sent." });
    }

    [HttpPost("reset-password")]
    [EnableRateLimiting("auth")]
    public async Task<ActionResult> ResetPassword(ResetPasswordRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Token) || string.IsNullOrWhiteSpace(request.NewPassword))
        {
            return BadRequest(new { message = "Token and new password are required" });
        }

        var tokenHash = HashToken(request.Token);
        var user = await _db.Users.FirstOrDefaultAsync(u => u.PasswordResetTokenHash == tokenHash);

        if (user == null || user.PasswordResetExpiresAt == null || user.PasswordResetExpiresAt < DateTime.UtcNow)
        {
            return BadRequest(new { message = "This reset link is invalid or has expired." });
        }

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
        user.PasswordResetTokenHash = null;
        user.PasswordResetExpiresAt = null;
        await _db.SaveChangesAsync();
        await _activity.LogAsync(ActivityAction.PasswordReset, "Via email link", user.Username, user.FullName);

        return Ok(new { message = "Password has been reset." });
    }

    [HttpPost("change-password")]
    [Authorize]
    public async Task<ActionResult> ChangePassword(ChangePasswordRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.CurrentPassword) || string.IsNullOrWhiteSpace(request.NewPassword))
        {
            return BadRequest(new { message = "Current and new password are required" });
        }

        var username = User.Identity?.Name;
        if (string.IsNullOrEmpty(username))
        {
            return Unauthorized();
        }

        var user = await _db.Users.FirstOrDefaultAsync(u => u.Username == username);
        if (user == null)
        {
            return Unauthorized();
        }

        if (!BCrypt.Net.BCrypt.Verify(request.CurrentPassword, user.PasswordHash))
        {
            return BadRequest(new { message = "Current password is incorrect" });
        }

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.NewPassword);
        await _db.SaveChangesAsync();
        await _activity.LogAsync(ActivityAction.PasswordChange, "", user.Username, user.FullName);

        return Ok(new { message = "Password changed successfully." });
    }

    private const int VerifyLinkHours = 24;

    private string FrontendBase() => FrontendUrlFromRequest() ?? _config["FrontendUrl"] ?? "http://localhost:8443";

    /// <summary>Returns false if the email couldn't be sent (the user can ask for a new link).</summary>
    private async Task<bool> SendVerificationEmail(User user, string rawToken)
    {
        var link = $"{FrontendBase()}/?verifyToken={Uri.EscapeDataString(rawToken)}";
        try
        {
            await _emailSender.SendAsync(user.Email, EmailTemplates.VerifySubject,
                EmailTemplates.VerifyEmail(user.FullName, user.Username, link, user.EmailVerifyExpiresAt!.Value,
                    needsApproval: !UserStatus.IsOfficialEmail(user.Email)));
            return true;
        }
        catch (Exception ex)
        {
            HttpContext.RequestServices.GetRequiredService<ILogger<AuthController>>()
                .LogError(ex, "Could not send verification email to {Email}", user.Email);
            return false;
        }
    }

    private static bool IsValidEmail(string email)
    {
        if (email.Length > 254 || email.Contains(' ')) return false;
        try
        {
            var addr = new System.Net.Mail.MailAddress(email);
            return addr.Address == email && addr.Host.Contains('.');
        }
        catch (FormatException)
        {
            return false;
        }
    }

    /// <summary>
    /// Development only: send links back to the address the user opened the dashboard
    /// from (e.g. http://192.168.1.25:8443). In production the Origin header could be
    /// faked to make email links point to another site, so FrontendUrl is always used.
    /// </summary>
    private string? FrontendUrlFromRequest()
    {
        if (!HttpContext.RequestServices.GetRequiredService<IWebHostEnvironment>().IsDevelopment()) return null;
        var origin = Request.Headers.Origin.ToString();
        if (Uri.TryCreate(origin, UriKind.Absolute, out var uri) && (uri.Port == 8443 || uri.Port == 5173))
            return $"{uri.Scheme}://{uri.Authority}";
        return null;
    }

    private static string GenerateSecureToken()
    {
        var bytes = RandomNumberGenerator.GetBytes(32);
        return Convert.ToBase64String(bytes).Replace("+", "-").Replace("/", "_").Replace("=", "");
    }

    private static string HashToken(string token)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(token));
        return Convert.ToHexString(bytes);
    }

    private static string HtmlEncode(string s) => System.Net.WebUtility.HtmlEncode(s);

    /// <summary>
    /// Formal bilingual (BM / English) password-reset email.
    /// HTML attributes use single quotes so the C# string needs no escaping.
    /// </summary>
    private static string BuildResetEmail(string fullName, string username, string resetLink, DateTime expiresLocal)
    {
        var name = HtmlEncode(string.IsNullOrWhiteSpace(fullName) ? username : fullName);
        var user = HtmlEncode(username);
        var link = HtmlEncode(resetLink);
        var expiry = expiresLocal.ToString("dd/MM/yyyy, h:mm tt", System.Globalization.CultureInfo.InvariantCulture);

        return $@"
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
        <p style='margin:0 0 14px;'>Tuan/Puan <strong>{name}</strong>,</p>
        <p style='margin:0 0 14px;'>Pihak kami telah menerima permohonan untuk menetapkan semula kata laluan bagi akaun e-Operasi anda (<strong>{user}</strong>).</p>
        <p style='margin:0 0 20px;'>Sila klik butang di bawah untuk menetapkan kata laluan baharu. Pautan ini sah sehingga <strong>{expiry}</strong> (waktu Malaysia) dan hanya boleh digunakan sekali.</p>
        <p style='margin:0 0 22px;text-align:center;'>
          <a href='{link}' style='display:inline-block;padding:12px 28px;background:#2F62B5;color:#FFFFFF;text-decoration:none;font-weight:700;border-radius:999px;'>Tetapkan Semula Kata Laluan</a>
        </p>
        <p style='margin:0 0 6px;font-size:12px;color:#5B6576;'>Sekiranya butang di atas tidak berfungsi, sila salin dan tampal pautan berikut ke dalam pelayar web anda:</p>
        <p style='margin:0 0 20px;font-size:12px;word-break:break-all;'><a href='{link}' style='color:#2F62B5;'>{link}</a></p>
        <p style='margin:0 0 14px;'>Sekiranya anda tidak membuat permohonan ini, sila abaikan e-mel ini. Kata laluan anda tidak akan berubah.</p>
        <p style='margin:0 0 4px;'>Sekian, terima kasih.</p>
        <p style='margin:0 0 20px;'><strong>Pentadbir Sistem e-Operasi</strong><br>Pejabat Pendidikan Daerah Johor Bahru</p>
      </td>
    </tr>
    <tr>
      <td style='padding:16px 28px 20px;border-top:1px solid #E3E8F0;font-size:12.5px;line-height:1.6;color:#5B6576;'>
        <p style='margin:0 0 8px;'><strong>English:</strong> We received a request to reset the password for your e-Operasi account (<strong>{user}</strong>). Use the button above to set a new password. The link is valid until <strong>{expiry}</strong> (Malaysia time) and can be used only once. If you did not make this request, please ignore this email; your password will not change.</p>
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

    // Trim, treat blank as null, and cap the length (same rule as ProfileController).
    private static string? CleanText(string? value, int maxLength)
    {
        var v = value?.Trim();
        if (string.IsNullOrEmpty(v)) return null;
        return v.Length > maxLength ? v[..maxLength] : v;
    }
}
