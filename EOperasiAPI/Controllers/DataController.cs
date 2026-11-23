using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using EOperasiApi.Models;
using EOperasiApi.Services;

namespace EOperasiApi.Controllers;

/// <summary>
/// SEPADU data updates (Kemas Kini Data).
///   GET  /api/data/info     - any logged-in user: date of the data currently shown
///   POST /api/data/preview  - admin: check the uploaded files, change nothing
///   POST /api/data/import   - admin: replace all teacher data with the uploaded files
///   GET  /api/data/history  - admin: past uploads
/// </summary>
[ApiController]
[Route("api/[controller]")]
[Authorize]
public class DataController : ControllerBase
{
    private const long MaxUploadBytes = 100 * 1024 * 1024; // the two SEPADU files are ~13 MB together
    private const int MaxFiles = 4;

    private readonly AppDbContext _db;
    private readonly ILogger<DataController> _log;
    private readonly ActivityLogger _activity;

    public DataController(AppDbContext db, ILogger<DataController> log, ActivityLogger activity)
    {
        _db = db;
        _log = log;
        _activity = activity;
    }

    // ---------------------------------------------------------------- DTOs

    public class DataInfoDto
    {
        /// <summary>Id of the latest upload; changes whenever new data is uploaded.</summary>
        public int? ImportId { get; set; }
        public DateOnly? DataDate { get; set; }
        public DateTime? ImportedAt { get; set; }
        public string? ImportedByName { get; set; }
        public int TeacherCount { get; set; }
    }

    public class TypeCount
    {
        public string SchoolType { get; set; } = "";
        public int Current { get; set; }
        public int Incoming { get; set; }
    }

    public class PreviewDto
    {
        public bool Ok { get; set; }
        public List<SepaduParser.FileSummary> Files { get; set; } = new();
        public List<SepaduParser.Issue> Errors { get; set; } = new();
        public List<SepaduParser.Issue> Warnings { get; set; } = new();
        public DateOnly? DetectedDataDate { get; set; }

        public int TeacherCount { get; set; }
        public int SchoolCount { get; set; }
        public int SubjectCount { get; set; }

        public int CurrentTeacherCount { get; set; }
        public DateOnly? CurrentDataDate { get; set; }
        /// <summary>In the new files but not in the current data.</summary>
        public int NewTeachers { get; set; }
        /// <summary>In the current data but not in the new files (retired, transferred out, ...).</summary>
        public int RemovedTeachers { get; set; }
        public List<TypeCount> ByType { get; set; } = new();
    }

    public class ImportResultDto
    {
        public PreviewDto Preview { get; set; } = new();
        public DataInfoDto? Info { get; set; }
    }

    public class HistoryDto
    {
        public int Id { get; set; }
        public DateOnly DataDate { get; set; }
        public DateTime ImportedAt { get; set; }
        public string ImportedBy { get; set; } = "";
        public string ImportedByName { get; set; } = "";
        public string FileNames { get; set; } = "";
        public int TeacherCount { get; set; }
        public int SchoolCount { get; set; }
        public int SubjectCount { get; set; }
    }

    // ---------------------------------------------------------------- endpoints

    [HttpGet("info")]
    public async Task<ActionResult<DataInfoDto>> Info()
    {
        var last = await _db.DataImports.OrderByDescending(d => d.ImportedAt).FirstOrDefaultAsync();
        return Ok(new DataInfoDto
        {
            ImportId = last?.Id,
            DataDate = last?.DataDate,
            ImportedAt = last?.ImportedAt,
            ImportedByName = last?.ImportedByName,
            TeacherCount = await _db.Teachers.CountAsync(),
        });
    }

    [HttpGet("history")]
    [Authorize(Roles = "admin")]
    public async Task<ActionResult<List<HistoryDto>>> History()
    {
        var list = await _db.DataImports
            .OrderByDescending(d => d.ImportedAt)
            .Take(20)
            .Select(d => new HistoryDto
            {
                Id = d.Id,
                DataDate = d.DataDate,
                ImportedAt = d.ImportedAt,
                ImportedBy = d.ImportedBy,
                ImportedByName = d.ImportedByName,
                FileNames = d.FileNames,
                TeacherCount = d.TeacherCount,
                SchoolCount = d.SchoolCount,
                SubjectCount = d.SubjectCount,
            })
            .ToListAsync();
        return Ok(list);
    }

    [HttpPost("preview")]
    [Authorize(Roles = "admin")]
    [RequestSizeLimit(MaxUploadBytes)]
    [RequestFormLimits(MultipartBodyLengthLimit = MaxUploadBytes)]
    public async Task<ActionResult<PreviewDto>> Preview([FromForm] List<IFormFile> files)
    {
        var (preview, _) = await ParseUpload(files);
        return Ok(preview);
    }

    [HttpPost("import")]
    [Authorize(Roles = "admin")]
    [RequestSizeLimit(MaxUploadBytes)]
    [RequestFormLimits(MultipartBodyLengthLimit = MaxUploadBytes)]
    public async Task<ActionResult<ImportResultDto>> Import([FromForm] List<IFormFile> files, [FromForm] string? dataDate)
    {
        var (preview, parsed) = await ParseUpload(files);
        if (!preview.Ok || parsed == null)
            return BadRequest(new ImportResultDto { Preview = preview });

        // The date the admin picked; otherwise the one in the file name.
        DateOnly? date = DateOnly.TryParse(dataDate, out var d) ? d : parsed.DetectedDataDate;
        if (date == null)
        {
            preview.Ok = false;
            preview.Errors.Add(new SepaduParser.Issue { Code = "noDataDate" });
            return BadRequest(new ImportResultDto { Preview = preview });
        }
        if (date > DateOnly.FromDateTime(DateTime.UtcNow.AddDays(1)))
        {
            preview.Ok = false;
            preview.Errors.Add(new SepaduParser.Issue { Code = "futureDataDate" });
            return BadRequest(new ImportResultDto { Preview = preview });
        }

        var username = User.Identity?.Name ?? "";
        var fullName = await _db.Users.Where(u => u.Username == username).Select(u => u.FullName).FirstOrDefaultAsync() ?? username;

        // All or nothing: if anything fails, the old data stays as it was.
        var started = DateTime.UtcNow;
        await using var tx = await _db.Database.BeginTransactionAsync();
        await _db.Database.ExecuteSqlRawAsync(
            """TRUNCATE TABLE "TeacherSubjects", "Teachers", "Subjects", "Schools" RESTART IDENTITY CASCADE;""");

        _db.ChangeTracker.AutoDetectChangesEnabled = false;
        _db.Schools.AddRange(parsed.Schools);
        _db.Subjects.AddRange(parsed.Subjects);
        _db.Teachers.AddRange(parsed.Teachers);
        var record = new DataImport
        {
            DataDate = date.Value,
            ImportedAt = DateTime.UtcNow,
            ImportedBy = username,
            ImportedByName = fullName,
            FileNames = string.Join(", ", files.Select(f => Path.GetFileName(f.FileName))),
            TeacherCount = parsed.Teachers.Count,
            SchoolCount = parsed.Schools.Count,
            SubjectCount = parsed.Subjects.Count,
        };
        _db.DataImports.Add(record);
        await _db.SaveChangesAsync();
        await tx.CommitAsync();
        _db.ChangeTracker.AutoDetectChangesEnabled = true;

        await _activity.LogAsync(ActivityAction.DataImport,
            $"Data {date:yyyy-MM-dd} · {parsed.Teachers.Count} teachers · {record.FileNames}", username, fullName);
        _log.LogInformation("SEPADU import by {User}: {Teachers} teachers, data date {Date}, {Ms} ms",
            username, parsed.Teachers.Count, date, (DateTime.UtcNow - started).TotalMilliseconds);

        return Ok(new ImportResultDto
        {
            Preview = preview,
            Info = new DataInfoDto
            {
                ImportId = record.Id,
                DataDate = date,
                ImportedAt = record.ImportedAt,
                ImportedByName = fullName,
                TeacherCount = parsed.Teachers.Count,
            },
        });
    }

    // ---------------------------------------------------------------- shared by preview + import

    private async Task<(PreviewDto, SepaduParser.Result?)> ParseUpload(List<IFormFile> files)
    {
        var preview = new PreviewDto();
        if (files == null || files.Count == 0)
        {
            preview.Errors.Add(new SepaduParser.Issue { Code = "noFiles" });
            return (preview, null);
        }
        if (files.Count > MaxFiles)
        {
            preview.Errors.Add(new SepaduParser.Issue { Code = "tooManyFiles", Count = MaxFiles });
            return (preview, null);
        }

        // Read into memory first: the parser needs seekable streams for .xlsx (zip).
        var inputs = new List<(string, Stream)>();
        foreach (var f in files)
        {
            var ms = new MemoryStream();
            await f.CopyToAsync(ms);
            ms.Position = 0;
            inputs.Add((Path.GetFileName(f.FileName), ms));
        }

        SepaduParser.Result parsed;
        try
        {
            parsed = SepaduParser.Parse(inputs);
        }
        finally
        {
            foreach (var (_, s) in inputs) s.Dispose();
        }

        preview.Files = parsed.Files;
        preview.Errors = parsed.Errors;
        preview.Warnings = parsed.Warnings;
        preview.DetectedDataDate = parsed.DetectedDataDate;
        preview.TeacherCount = parsed.Teachers.Count;
        preview.SchoolCount = parsed.Schools.Count;
        preview.SubjectCount = parsed.Subjects.Count;

        // Compare with what is in the database now.
        var current = await _db.Teachers
            .Select(t => new { t.IcNumber, Type = t.School.Type })
            .ToListAsync();
        var currentIcs = current.Select(c => c.IcNumber).ToHashSet();
        var incomingIcs = parsed.Teachers.Select(t => t.IcNumber).ToHashSet();

        preview.CurrentTeacherCount = current.Count;
        preview.CurrentDataDate = await _db.DataImports.OrderByDescending(x => x.ImportedAt).Select(x => (DateOnly?)x.DataDate).FirstOrDefaultAsync();
        preview.NewTeachers = incomingIcs.Count(ic => !currentIcs.Contains(ic));
        preview.RemovedTeachers = currentIcs.Count(ic => !incomingIcs.Contains(ic));

        var currentByType = current.GroupBy(c => c.Type).ToDictionary(g => g.Key, g => g.Count());
        var incomingByType = parsed.Teachers.GroupBy(t => t.School.Type).ToDictionary(g => g.Key, g => g.Count());
        preview.ByType = currentByType.Keys.Union(incomingByType.Keys)
            .OrderBy(k => k)
            .Select(k => new TypeCount
            {
                SchoolType = k,
                Current = currentByType.GetValueOrDefault(k),
                Incoming = incomingByType.GetValueOrDefault(k),
            })
            .ToList();

        // A school type that exists now but is missing from the upload would be wiped out.
        var droppedTypes = preview.ByType.Where(t => t.Current > 0 && t.Incoming == 0).Select(t => t.SchoolType).ToList();
        if (droppedTypes.Count > 0 && parsed.Errors.Count == 0)
            preview.Warnings.Insert(0, new SepaduParser.Issue
            {
                Code = "schoolTypeMissing",
                Count = droppedTypes.Count,
                Details = droppedTypes,
            });

        preview.Ok = parsed.Ok;
        return (preview, parsed.Ok ? parsed : null);
    }
}
