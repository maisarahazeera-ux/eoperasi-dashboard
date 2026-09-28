using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Authorization;
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

    public AuthController(AppDbContext db, IConfiguration config, IEmailSender emailSender)
    {
        _db = db;
        _config = config;
        _emailSender = emailSender;
    }

    [HttpPost("login")]
    public async Task<ActionResult<LoginResponse>> Login(LoginRequest request)
    {
        var user = await _db.Users.FirstOrDefaultAsync(u => u.Username == request.Username);

        if (user == null || !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
        {
            return Unauthorized(new { message = "Invalid username or password" });
        }

        // Remember login times for "Login Terakhir" on the Profile page.
        user.PreviousLoginAt = user.LastLoginAt;
        user.LastLoginAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();

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

        var usernameTaken = await _db.Users.AnyAsync(u => u.Username == request.Username);
        if (usernameTaken)
        {
            return Conflict(new { message = "Username already taken" });
        }
        var emailTaken = await _db.Users.AnyAsync(u => u.Email == request.Email);
        if (emailTaken)
        {
            return Conflict(new { message = "Email already registered" });
        }

        var user = new User
        {
            Username = request.Username,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            Role = "staff",
            FullName = request.FullName,
            Email = request.Email,
        };

        _db.Users.Add(user);
        await _db.SaveChangesAsync();

        return Created(string.Empty, new { username = user.Username, role = user.Role });
    }

    [HttpPost("forgot-password")]
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
            var frontendUrl = FrontendUrlFromRequest() ?? _config["FrontendUrl"] ?? "http://localhost:8443";
            var resetLink = $"{frontendUrl}/?resetToken={Uri.EscapeDataString(rawToken)}";

            var body = $@"
                <p>Salam {HtmlEncode(user.FullName)},</p>
                <p>Klik pautan di bawah untuk menetapkan semula kata laluan anda. Pautan ini sah selama 1 jam sahaja.</p>
                <p><a href=""{resetLink}"">{resetLink}</a></p>
                <p>Jika anda tidak memohon penetapan semula kata laluan, sila abaikan emel ini.</p>
            ";
            await _emailSender.SendAsync(user.Email, "Tetapkan Semula Kata Laluan — e-Operasi", body);
        }

        return Ok(new { message = "If that email is registered, a reset link has been sent." });
    }

    [HttpPost("reset-password")]
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

        return Ok(new { message = "Password changed successfully." });
    }

    private string? FrontendUrlFromRequest()
    {
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
}
