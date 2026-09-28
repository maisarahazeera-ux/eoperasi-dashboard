namespace EOperasiApi.Models;

public class TeacherDto
{
    public int Id { get; set; }
    public string IcNumber { get; set; } = "";
    public string Name { get; set; } = "";
    public string Gender { get; set; } = "";
    public DateOnly? DateOfBirth { get; set; }
    public string? MaritalStatus { get; set; }
    public string? Race { get; set; }
    public string? Religion { get; set; }
    public string? Nationality { get; set; }
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public string? Address { get; set; }

    public string School { get; set; } = "";
    public string SchoolType { get; set; } = "";
    public string SchoolDistrict { get; set; } = "";

    public string? Position { get; set; }
    public string? GredHakiki { get; set; }
    public string? GredPenyandang { get; set; }
    public string? EmploymentStatus { get; set; }
    public string? ServiceStatus { get; set; }
    public DateOnly? FirstAppointmentDate { get; set; }
    public string? Qualification { get; set; }
    public string? Opsyen1 { get; set; }
    public string? Opsyen2 { get; set; }
    public bool Ikhtisas { get; set; }
    public string? StatusInduksi { get; set; }
    public string? SahPerkhidmatan { get; set; }
    public DateOnly? RetirementDate { get; set; }
    public string? TugasKhas { get; set; }
    public bool GuruCemerlang { get; set; }
    public string? GuruCemerlangBidang { get; set; }
    public bool KodJawatanDiisi { get; set; }

    public List<SubjectDto> Subjects { get; set; } = new();
}

public class SubjectDto
{
    public string Name { get; set; } = "";
    public int Hours { get; set; }
}