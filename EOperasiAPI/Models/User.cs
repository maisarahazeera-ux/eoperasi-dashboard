namespace EOperasiApi.Models;

public class User
{
    public int Id { get; set; }
    public string Username { get; set; } = "";
    public string PasswordHash { get; set; } = "";
    public string Role { get; set; } = "admin";
    public string FullName { get; set; } = "";
    public string Email { get; set; } = "";

    // Account status, see UserStatus below. Existing accounts are "active".
    public string Status { get; set; } = UserStatus.Active;
    public DateTime? CreatedAt { get; set; }
    public DateTime? StatusUpdatedAt { get; set; }
    public string? StatusUpdatedBy { get; set; }   // username of the admin, or "system"

    // Email verification (link sent after registering).
    public string? EmailVerifyTokenHash { get; set; }
    public DateTime? EmailVerifyExpiresAt { get; set; }

    // Work details, filled in by the user on the Profile page.
    public string? Jawatan { get; set; }
    public string? JabatanBahagian { get; set; }
    public string? Sektor { get; set; }

    // Profile photo file name inside the uploads/profile-photos folder (null = no photo).
    public string? ProfilePhotoFile { get; set; }

    // LastLoginAt = the current/most recent login; PreviousLoginAt = the one before it.
    // The Profile page shows PreviousLoginAt as "Login Terakhir".
    public DateTime? LastLoginAt { get; set; }
    public DateTime? PreviousLoginAt { get; set; }

    // Display preferences (saved per account, so they follow the user to any computer).
    // null = not chosen yet -> the frontend uses its default ("ms" / 100%).
    // TextSize is a percentage stored as text, e.g. "110".
    public string? PreferredLanguage { get; set; }
    public string? TextSize { get; set; }

    // Password reset
    public string? PasswordResetTokenHash { get; set; }
    public DateTime? PasswordResetExpiresAt { get; set; }
}

/// <summary>
/// unverified -> (clicks email link) -> active   (official @moe.gov.my email)
///                                   -> pending  (any other email; an admin must approve)
/// active <-> deactivated (by an admin). Only "active" accounts can log in.
/// </summary>
public static class UserStatus
{
    public const string Unverified = "unverified";
    public const string Pending = "pending";
    public const string Active = "active";
    public const string Deactivated = "deactivated";

    /// <summary>Official KPM email: @moe.gov.my or any subdomain such as @jpnjohor.moe.gov.my.</summary>
    public static bool IsOfficialEmail(string? email)
    {
        if (string.IsNullOrWhiteSpace(email)) return false;
        var at = email.Trim().LastIndexOf('@');
        if (at < 1 || at == email.Trim().Length - 1) return false;
        var domain = email.Trim()[(at + 1)..].ToLowerInvariant();
        return domain == "moe.gov.my" || domain.EndsWith(".moe.gov.my");
    }
}
