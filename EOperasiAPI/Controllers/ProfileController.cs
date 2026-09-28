using System.Net.Mail;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using EOperasiApi.Models;

namespace EOperasiApi.Controllers;

/// <summary>
/// The logged-in user's own profile: view it, edit name/email, and save
/// display preferences. Username and role can't be changed here.
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ProfileController : ControllerBase
{
    private static readonly string[] AllowedLanguages = { "ms", "en" };
    // Text size is a percentage chosen by the user with a slider.
    private const int MinTextSize = 80;
    private const int MaxTextSize = 130;

    // Profile photos: jpg/png/webp up to 2 MB, stored on disk (not in the database).
    private const long MaxPhotoBytes = 2 * 1024 * 1024;
    private static readonly Dictionary<string, string> PhotoTypes = new()
    {
        ["image/jpeg"] = ".jpg",
        ["image/png"] = ".png",
        ["image/webp"] = ".webp",
    };

    private readonly AppDbContext _db;
    private readonly string _photoDir;

    public ProfileController(AppDbContext db, IWebHostEnvironment env)
    {
        _db = db;
        _photoDir = Path.Combine(env.ContentRootPath, "uploads", "profile-photos");
    }

    private async Task<User?> CurrentUser()
    {
        var username = User.Identity?.Name;
        if (string.IsNullOrEmpty(username)) return null;
        return await _db.Users.FirstOrDefaultAsync(u => u.Username == username);
    }

    private static ProfileDto ToDto(User u) => new()
    {
        Username = u.Username,
        FullName = u.FullName,
        Email = u.Email,
        Role = u.Role,
        Jawatan = u.Jawatan,
        JabatanBahagian = u.JabatanBahagian,
        Sektor = u.Sektor,
        HasPhoto = !string.IsNullOrEmpty(u.ProfilePhotoFile),
        PreviousLoginAt = u.PreviousLoginAt,
        PreferredLanguage = u.PreferredLanguage,
        TextSize = u.TextSize,
    };

    [HttpGet]
    public async Task<ActionResult<ProfileDto>> Get()
    {
        var user = await CurrentUser();
        if (user == null) return Unauthorized();
        return Ok(ToDto(user));
    }

    [HttpPut]
    public async Task<ActionResult<ProfileDto>> Update(UpdateProfileRequest request)
    {
        var user = await CurrentUser();
        if (user == null) return Unauthorized();

        var fullName = request.FullName?.Trim() ?? "";
        var email = request.Email?.Trim() ?? "";

        if (string.IsNullOrWhiteSpace(fullName))
            return BadRequest(new { message = "Full name is required" });
        if (!IsValidEmail(email))
            return BadRequest(new { message = "A valid email is required" });

        var emailTaken = await _db.Users.AnyAsync(u => u.Email == email && u.Id != user.Id);
        if (emailTaken)
            return Conflict(new { message = "Email already registered" });

        user.FullName = fullName;
        user.Email = email;
        user.Jawatan = Clean(request.Jawatan, 150);
        user.JabatanBahagian = Clean(request.JabatanBahagian, 150);
        user.Sektor = Clean(request.Sektor, 150);
        await _db.SaveChangesAsync();
        return Ok(ToDto(user));
    }

    [HttpPut("preferences")]
    public async Task<ActionResult<ProfileDto>> UpdatePreferences(UpdatePreferencesRequest request)
    {
        var user = await CurrentUser();
        if (user == null) return Unauthorized();

        if (request.PreferredLanguage != null)
        {
            if (!AllowedLanguages.Contains(request.PreferredLanguage))
                return BadRequest(new { message = "Unsupported language" });
            user.PreferredLanguage = request.PreferredLanguage;
        }
        if (request.TextSize != null)
        {
            if (!int.TryParse(request.TextSize, out var pct) || pct < MinTextSize || pct > MaxTextSize)
                return BadRequest(new { message = $"Text size must be a number from {MinTextSize} to {MaxTextSize}" });
            user.TextSize = pct.ToString();
        }

        await _db.SaveChangesAsync();
        return Ok(ToDto(user));
    }

    [HttpGet("photo")]
    public async Task<IActionResult> GetPhoto()
    {
        var user = await CurrentUser();
        if (user == null) return Unauthorized();
        if (string.IsNullOrEmpty(user.ProfilePhotoFile)) return NotFound();

        var path = Path.Combine(_photoDir, user.ProfilePhotoFile);
        if (!System.IO.File.Exists(path)) return NotFound();

        var contentType = PhotoTypes.FirstOrDefault(kv => user.ProfilePhotoFile.EndsWith(kv.Value)).Key ?? "application/octet-stream";
        return PhysicalFile(path, contentType);
    }

    [HttpPost("photo")]
    [RequestSizeLimit(3 * 1024 * 1024)]
    public async Task<ActionResult<ProfileDto>> UploadPhoto(IFormFile file)
    {
        var user = await CurrentUser();
        if (user == null) return Unauthorized();

        if (file == null || file.Length == 0)
            return BadRequest(new { message = "No file uploaded" });
        if (file.Length > MaxPhotoBytes)
            return BadRequest(new { message = "Photo must be 2 MB or smaller" });
        if (!PhotoTypes.TryGetValue(file.ContentType, out var ext))
            return BadRequest(new { message = "Only JPG, PNG or WEBP images are allowed" });

        Directory.CreateDirectory(_photoDir);
        DeletePhotoFile(user);

        // File name is based on the user id, never on the uploaded name.
        var fileName = $"user-{user.Id}-{DateTime.UtcNow.Ticks}{ext}";
        await using (var stream = System.IO.File.Create(Path.Combine(_photoDir, fileName)))
        {
            await file.CopyToAsync(stream);
        }

        user.ProfilePhotoFile = fileName;
        await _db.SaveChangesAsync();
        return Ok(ToDto(user));
    }

    [HttpDelete("photo")]
    public async Task<ActionResult<ProfileDto>> DeletePhoto()
    {
        var user = await CurrentUser();
        if (user == null) return Unauthorized();

        DeletePhotoFile(user);
        user.ProfilePhotoFile = null;
        await _db.SaveChangesAsync();
        return Ok(ToDto(user));
    }

    private void DeletePhotoFile(User user)
    {
        if (string.IsNullOrEmpty(user.ProfilePhotoFile)) return;
        var path = Path.Combine(_photoDir, user.ProfilePhotoFile);
        if (System.IO.File.Exists(path)) System.IO.File.Delete(path);
    }

    private static string? Clean(string? value, int maxLength)
    {
        var v = value?.Trim();
        if (string.IsNullOrEmpty(v)) return null;
        return v.Length > maxLength ? v[..maxLength] : v;
    }

    private static bool IsValidEmail(string email)
    {
        if (string.IsNullOrWhiteSpace(email)) return false;
        try
        {
            var addr = new MailAddress(email);
            return addr.Address == email;
        }
        catch
        {
            return false;
        }
    }
}
