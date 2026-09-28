namespace EOperasiApi.Models;

public class ProfileDto
{
    public string Username { get; set; } = "";
    public string FullName { get; set; } = "";
    public string Email { get; set; } = "";
    public string Role { get; set; } = "";
    public string? Jawatan { get; set; }
    public string? JabatanBahagian { get; set; }
    public string? Sektor { get; set; }
    public bool HasPhoto { get; set; }
    public DateTime? PreviousLoginAt { get; set; }
    public string? PreferredLanguage { get; set; }
    public string? TextSize { get; set; }
}

public class UpdateProfileRequest
{
    public string FullName { get; set; } = "";
    public string Email { get; set; } = "";
    public string? Jawatan { get; set; }
    public string? JabatanBahagian { get; set; }
    public string? Sektor { get; set; }
}

public class UpdatePreferencesRequest
{
    public string? PreferredLanguage { get; set; }
    public string? TextSize { get; set; }
}
