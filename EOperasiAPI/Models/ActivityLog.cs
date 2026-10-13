namespace EOperasiApi.Models;

/// <summary>
/// One line in Log Aktiviti: who did what, and when. Written by ActivityLogger.
/// </summary>
public class ActivityLog
{
    public long Id { get; set; }
    public DateTime At { get; set; }              // UTC
    public string Username { get; set; } = "";    // who (or the username typed, for a failed login)
    public string FullName { get; set; } = "";
    public string Action { get; set; } = "";      // see ActivityAction
    public string Detail { get; set; } = "";      // short human-readable detail
    public string? IpAddress { get; set; }
}

/// <summary>Action codes. The Log Aktiviti page translates them.</summary>
public static class ActivityAction
{
    public const string Login = "login";
    public const string LoginFailed = "login_failed";
    public const string Register = "register";
    public const string VerifyEmail = "verify_email";
    public const string PasswordChange = "password_change";
    public const string PasswordReset = "password_reset";
    public const string DataImport = "data_import";
    public const string ReportDownload = "report_download";
    public const string UserApprove = "user_approve";
    public const string UserReject = "user_reject";
    public const string UserDeactivate = "user_deactivate";
    public const string UserActivate = "user_activate";
    public const string UserRole = "user_role";
}
