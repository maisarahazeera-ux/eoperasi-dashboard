namespace EOperasiApi.Models;

public class User
{
    public int Id { get; set; }
    public string Username { get; set; } = "";
    public string PasswordHash { get; set; } = "";
    public string Role { get; set; } = "admin";
    public string FullName { get; set; } = "";
    public string Email { get; set; } = "";

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
