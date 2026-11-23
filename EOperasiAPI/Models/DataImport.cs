namespace EOperasiApi.Models;

/// <summary>
/// One row per SEPADU upload done through the Admin page. The newest row gives
/// the "Data SEPADU · dikemas kini ..." date shown on every dashboard page.
/// </summary>
public class DataImport
{
    public int Id { get; set; }

    /// <summary>Date the data was extracted from SEPADU (not the upload date).</summary>
    public DateOnly DataDate { get; set; }

    /// <summary>When the upload was done (UTC).</summary>
    public DateTime ImportedAt { get; set; }

    public string ImportedBy { get; set; } = "";      // username
    public string ImportedByName { get; set; } = "";  // full name at the time
    public string FileNames { get; set; } = "";

    public int TeacherCount { get; set; }
    public int SchoolCount { get; set; }
    public int SubjectCount { get; set; }
}
