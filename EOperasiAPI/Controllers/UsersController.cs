using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using EOperasiApi.Models;
using EOperasiApi.Services;

namespace EOperasiApi.Controllers;

/// <summary>
/// Pengurusan Pengguna (admin only).
///   GET    /api/users                  - all accounts
///   GET    /api/users/pending-count    - number waiting for approval (badge in the menu)
///   POST   /api/users/{id}/approve     - pending -> active (emails the user)
///   POST   /api/users/{id}/reject      - removes a pending / unverified registration
///   POST   /api/users/{id}/deactivate  - active -> deactivated (can't log in)
///   POST   /api/users/{id}/activate    - deactivated -> active
///   PUT    /api/users/{id}/role        - { "role": "admin" | "staff" }
/// Admins can't deactivate or demote themselves, and the last active admin is protected.
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "admin")]
public class UsersController : ControllerBase
{
    private static readonly string[] Roles = { "admin", "staff" };

    private readonly AppDbContext _db;
    private readonly IEmailSender _email;
    private readonly IConfiguration _config;
    private readonly ILogger<UsersController> _log;
    private readonly ActivityLogger _activity;

    public UsersController(AppDbContext db, IEmailSender email, IConfiguration config, ILogger<UsersController> log, ActivityLogger activity)
    {
        _db = db;
        _email = email;
        _config = config;
        _log = log;
        _activity = activity;
    }

    private static string Who(User u) => $"{(string.IsNullOrWhiteSpace(u.FullName) ? u.Username : u.FullName)} (@{u.Username})";

    public class UserAdminDto
    {
        public int Id { get; set; }
        public string Username { get; set; } = "";
        public string FullName { get; set; } = "";
        public string Email { get; set; } = "";
        public bool OfficialEmail { get; set; }
        public string Role { get; set; } = "";
        public string Status { get; set; } = "";
        public string? Jawatan { get; set; }
        public string? JabatanBahagian { get; set; }
        public string? Sektor { get; set; }
        public DateTime? CreatedAt { get; set; }
        public DateTime? LastLoginAt { get; set; }
        public DateTime? StatusUpdatedAt { get; set; }
        public string? StatusUpdatedBy { get; set; }
        public bool IsSelf { get; set; }
    }

    public class RoleRequest
    {
        public string Role { get; set; } = "";
    }

    private string Me => User.Identity?.Name ?? "";

    private UserAdminDto ToDto(User u) => new()
    {
        Id = u.Id,
        Username = u.Username,
        FullName = u.FullName,
        Email = u.Email,
        OfficialEmail = UserStatus.IsOfficialEmail(u.Email),
        Role = u.Role,
        Status = u.Status,
        Jawatan = u.Jawatan,
        JabatanBahagian = u.JabatanBahagian,
        Sektor = u.Sektor,
        CreatedAt = u.CreatedAt,
        LastLoginAt = u.LastLoginAt,
        StatusUpdatedAt = u.StatusUpdatedAt,
        StatusUpdatedBy = u.StatusUpdatedBy,
        IsSelf = u.Username == Me,
    };

    [HttpGet]
    public async Task<ActionResult<List<UserAdminDto>>> List()
    {
        var users = await _db.Users.AsNoTracking().OrderBy(u => u.FullName).ToListAsync();
        return Ok(users.Select(ToDto).ToList());
    }

    [HttpGet("pending-count")]
    public async Task<ActionResult<object>> PendingCount() =>
        Ok(new { count = await _db.Users.CountAsync(u => u.Status == UserStatus.Pending) });

    [HttpPost("{id:int}/approve")]
    public async Task<ActionResult<UserAdminDto>> Approve(int id)
    {
        var u = await _db.Users.FindAsync(id);
        if (u == null) return NotFound();
        if (u.Status != UserStatus.Pending) return Conflict(new { code = "notPending" });

        SetStatus(u, UserStatus.Active);
        await _db.SaveChangesAsync();
        await _activity.LogAsync(ActivityAction.UserApprove, Who(u));

        var loginLink = FrontendBase();
        try
        {
            await _email.SendAsync(u.Email, EmailTemplates.ApprovedSubject,
                EmailTemplates.AccountApproved(u.FullName, u.Username, loginLink));
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "Could not send approval email to {Email}", u.Email); // approval still stands
        }
        return Ok(ToDto(u));
    }

    [HttpPost("{id:int}/reject")]
    public async Task<ActionResult> Reject(int id)
    {
        var u = await _db.Users.FindAsync(id);
        if (u == null) return NotFound();
        // Only registrations that never became active can be removed; real accounts are deactivated instead.
        if (u.Status != UserStatus.Pending && u.Status != UserStatus.Unverified) return Conflict(new { code = "notPending" });

        _db.Users.Remove(u);
        await _db.SaveChangesAsync();
        await _activity.LogAsync(ActivityAction.UserReject, $"{Who(u)} · {u.Email}");
        _log.LogInformation("{Admin} rejected registration {Username}", Me, u.Username);
        return NoContent();
    }

    [HttpPost("{id:int}/deactivate")]
    public async Task<ActionResult<UserAdminDto>> Deactivate(int id)
    {
        var u = await _db.Users.FindAsync(id);
        if (u == null) return NotFound();
        if (u.Username == Me) return Conflict(new { code = "self" });
        if (u.Status != UserStatus.Active) return Conflict(new { code = "notActive" });
        if (u.Role == "admin" && await IsLastActiveAdmin(u.Id)) return Conflict(new { code = "lastAdmin" });

        SetStatus(u, UserStatus.Deactivated);
        await _db.SaveChangesAsync();
        await _activity.LogAsync(ActivityAction.UserDeactivate, Who(u));
        return Ok(ToDto(u));
    }

    [HttpPost("{id:int}/activate")]
    public async Task<ActionResult<UserAdminDto>> Activate(int id)
    {
        var u = await _db.Users.FindAsync(id);
        if (u == null) return NotFound();
        if (u.Status != UserStatus.Deactivated) return Conflict(new { code = "notDeactivated" });

        SetStatus(u, UserStatus.Active);
        await _db.SaveChangesAsync();
        await _activity.LogAsync(ActivityAction.UserActivate, Who(u));
        return Ok(ToDto(u));
    }

    [HttpPut("{id:int}/role")]
    public async Task<ActionResult<UserAdminDto>> SetRole(int id, RoleRequest request)
    {
        var role = request.Role?.Trim().ToLowerInvariant() ?? "";
        if (!Roles.Contains(role)) return BadRequest(new { code = "invalidRole" });

        var u = await _db.Users.FindAsync(id);
        if (u == null) return NotFound();
        if (u.Username == Me) return Conflict(new { code = "self" });
        if (u.Role == role) return Ok(ToDto(u));
        if (u.Role == "admin" && role != "admin" && await IsLastActiveAdmin(u.Id)) return Conflict(new { code = "lastAdmin" });

        var oldRole = u.Role;
        u.Role = role;
        u.StatusUpdatedAt = DateTime.UtcNow;
        u.StatusUpdatedBy = Me;
        await _db.SaveChangesAsync();
        await _activity.LogAsync(ActivityAction.UserRole, $"{Who(u)} · {oldRole} → {role}");
        _log.LogInformation("{Admin} changed role of {Username} to {Role}", Me, u.Username, role);
        return Ok(ToDto(u));
    }

    private void SetStatus(User u, string status)
    {
        u.Status = status;
        u.StatusUpdatedAt = DateTime.UtcNow;
        u.StatusUpdatedBy = Me;
        _log.LogInformation("{Admin} set {Username} to {Status}", Me, u.Username, status);
    }

    private async Task<bool> IsLastActiveAdmin(int userId) =>
        !await _db.Users.AnyAsync(x => x.Id != userId && x.Role == "admin" && x.Status == UserStatus.Active);

    // Same rule as AuthController: the request's Origin is trusted in Development only.
    private string FrontendBase()
    {
        var isDev = HttpContext.RequestServices.GetRequiredService<IWebHostEnvironment>().IsDevelopment();
        var origin = isDev ? Request.Headers.Origin.ToString() : "";
        if (Uri.TryCreate(origin, UriKind.Absolute, out var uri) && (uri.Port == 8443 || uri.Port == 5173))
            return $"{uri.Scheme}://{uri.Authority}";
        return _config["FrontendUrl"] ?? "http://localhost:8443";
    }
}
