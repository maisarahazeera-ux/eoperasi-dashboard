using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using EOperasiApi.Models;
using EOperasiApi.Services;

namespace EOperasiApi.Controllers;

/// <summary>
/// Log Aktiviti.
///   POST /api/activity/download  - any logged-in user: record a report download (sent by the page)
///   GET  /api/activity           - admin: read the log (newest first, filter + pages)
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ActivityController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ActivityLogger _activity;

    public ActivityController(AppDbContext db, ActivityLogger activity)
    {
        _db = db;
        _activity = activity;
    }

    public class DownloadRequest
    {
        public string Report { get; set; } = "";   // report title, e.g. "Demografi Guru"
        public string Format { get; set; } = "";   // pdf / excel / csv
        public string? Filters { get; set; }
        public int Rows { get; set; }
    }

    public class ActivityDto
    {
        public long Id { get; set; }
        public DateTime At { get; set; }
        public string Username { get; set; } = "";
        public string FullName { get; set; } = "";
        public string Action { get; set; } = "";
        public string Detail { get; set; } = "";
        public string? IpAddress { get; set; }
    }

    public class ActivityPage
    {
        public List<ActivityDto> Items { get; set; } = new();
        public int Total { get; set; }
    }

    private static readonly string[] Formats = { "pdf", "excel", "csv" };

    // Groups shown as filter buttons on the page.
    private static readonly Dictionary<string, string[]> Categories = new()
    {
        ["login"] = new[] { ActivityAction.Login, ActivityAction.LoginFailed },
        ["download"] = new[] { ActivityAction.ReportDownload },
        ["data"] = new[] { ActivityAction.DataImport },
        ["users"] = new[] { ActivityAction.UserApprove, ActivityAction.UserReject, ActivityAction.UserDeactivate, ActivityAction.UserActivate, ActivityAction.UserRole },
        ["account"] = new[] { ActivityAction.Register, ActivityAction.VerifyEmail, ActivityAction.PasswordChange, ActivityAction.PasswordReset },
    };

    [HttpPost("download")]
    public async Task<ActionResult> Download(DownloadRequest req)
    {
        var format = (req.Format ?? "").ToLowerInvariant();
        if (!Formats.Contains(format) || string.IsNullOrWhiteSpace(req.Report)) return BadRequest();

        var detail = $"{req.Report.Trim()} · {format.ToUpperInvariant()}";
        if (req.Rows > 0) detail += $" · {req.Rows} rows";
        if (!string.IsNullOrWhiteSpace(req.Filters)) detail += $" · {req.Filters.Trim()}";
        await _activity.LogAsync(ActivityAction.ReportDownload, detail);
        return NoContent();
    }

    /// <param name="category">login / download / data / users / account (empty = all)</param>
    /// <param name="q">search in name, username and detail</param>
    /// <param name="from">yyyy-mm-dd, Malaysia time</param>
    /// <param name="to">yyyy-mm-dd, Malaysia time (inclusive)</param>
    [HttpGet]
    [Authorize(Roles = "admin")]
    public async Task<ActionResult<ActivityPage>> List(
        [FromQuery] string? category, [FromQuery] string? q,
        [FromQuery] DateOnly? from, [FromQuery] DateOnly? to,
        [FromQuery] int page = 1, [FromQuery] int pageSize = 50)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 10, 200);

        var query = _db.ActivityLogs.AsNoTracking().AsQueryable();
        if (!string.IsNullOrEmpty(category) && Categories.TryGetValue(category, out var actions))
            query = query.Where(a => actions.Contains(a.Action));
        if (!string.IsNullOrWhiteSpace(q))
        {
            var term = $"%{q.Trim()}%";
            query = query.Where(a => EF.Functions.ILike(a.Username, term) || EF.Functions.ILike(a.FullName, term) || EF.Functions.ILike(a.Detail, term));
        }
        // Dates are picked in Malaysia time (UTC+8); stored times are UTC.
        if (from != null)
        {
            var start = from.Value.ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc).AddHours(-8);
            query = query.Where(a => a.At >= start);
        }
        if (to != null)
        {
            var end = to.Value.AddDays(1).ToDateTime(TimeOnly.MinValue, DateTimeKind.Utc).AddHours(-8);
            query = query.Where(a => a.At < end);
        }

        var total = await query.CountAsync();
        var items = await query
            .OrderByDescending(a => a.At).ThenByDescending(a => a.Id)
            .Skip((page - 1) * pageSize).Take(pageSize)
            .Select(a => new ActivityDto
            {
                Id = a.Id, At = a.At, Username = a.Username, FullName = a.FullName,
                Action = a.Action, Detail = a.Detail, IpAddress = a.IpAddress,
            })
            .ToListAsync();

        return Ok(new ActivityPage { Items = items, Total = total });
    }
}
