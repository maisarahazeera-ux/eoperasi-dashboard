namespace EOperasiApi.Models;

public class TeacherSubject
{
    public int TeacherId { get; set; }
    public Teacher Teacher { get; set; } = null!;

    public int SubjectId { get; set; }
    public Subject Subject { get; set; } = null!;

    public int Hours { get; set; }
}