namespace EOperasiApi.Models;

public class School
{
    public int Id { get; set; }
    public string Code { get; set; } = "";   // KOD SEKOLAH, e.g. JBA1001
    public string Name { get; set; } = "";
    public string Type { get; set; } = "";
    public string District { get; set; } = "";

    public List<Teacher> Teachers { get; set; } = new();
}