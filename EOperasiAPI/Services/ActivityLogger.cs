using Microsoft.EntityFrameworkCore;
using EOperasiApi.Models;

namespace EOperasiApi.Services;

/// <summary>
/// Writes to Log Aktiviti. Uses its own database context, so saving a log line
/// never also saves half-finished changes of the caller. Never throws: a logging
/// problem must not stop the real action (login, upload, ...) from working.
/// </summary>
public class ActivityLogger
{
    private readonly DbContextOptions<AppDbContext> _options;
    private readonly IHttpContextAccessor _http;
    private readonly ILogger<ActivityLogger> _log;

    public ActivityLogger(DbContextOptions<AppDbContext> options, IHttpContextAccessor http, ILogger<ActivityLogger> log)
    {
        _options = options;
        _http = http;
        _log = log;
    }

    /// <param name="username">Defaults to the logged-in user.</param>
    public async Task LogAsync(string action, string detail, string? username = null, string? fullName = null)
    {
        try
        {
            var ctx = _http.HttpContext;
            username ??= ctx?.User.Identity?.Name ?? "";

            await using var db = new AppDbContext(_options);
            if (fullName == null && username.Length > 0)
                fullName = await db.Users.Where(u => u.Username == username).Select(u => u.FullName).FirstOrDefaultAsync();

            db.ActivityLogs.Add(new ActivityLog
            {
                At = DateTime.UtcNow,
                Username = Trunc(username, 100),
                FullName = Trunc(fullName ?? "", 200),
                Action = action,
                Detail = Trunc(detail, 1000),
                IpAddress = ctx?.Connection.RemoteIpAddress?.ToString(),
            });
            await db.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            _log.LogError(ex, "Could not write activity log ({Action})", action);
        }
    }

    private static string Trunc(string s, int max) => s.Length > max ? s[..max] : s;
}
