namespace EOperasiApi.Models;

public class Subject
{
    public int Id { get; set; }
    public string Name { get; set; } = "";

    public List<TeacherSubject> TeacherSubjects { get; set; } = new();
}