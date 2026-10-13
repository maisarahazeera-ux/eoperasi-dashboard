using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using EOperasiApi.Models;
using Microsoft.AspNetCore.Authorization;

namespace EOperasiApi.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class TeachersController : ControllerBase
{
    private readonly AppDbContext _db;

    public TeachersController(AppDbContext db)
    {
        _db = db;
    }

    [HttpGet]
    public async Task<ActionResult<List<TeacherDto>>> GetAll()
    {
        var teachers = await _db.Teachers
            .Include(t => t.School)
            .Include(t => t.TeacherSubjects)
                .ThenInclude(ts => ts.Subject)
            .Select(t => new TeacherDto
            {
                Id = t.Id,
                IcNumber = t.IcNumber,
                Name = t.Name,
                Gender = t.Gender,
                DateOfBirth = t.DateOfBirth,
                MaritalStatus = t.MaritalStatus,
                Race = t.Race,
                Religion = t.Religion,
                Nationality = t.Nationality,
                Phone = t.Phone,
                Email = t.Email,
                Address = t.Address,
                School = t.School.Name,
                SchoolCode = t.School.Code,
                SchoolType = t.School.Type,
                SchoolDistrict = t.School.District,
                Position = t.Position,
                GredHakiki = t.GredHakiki,
                GredPenyandang = t.GredPenyandang,
                EmploymentStatus = t.EmploymentStatus,
                ServiceStatus = t.ServiceStatus,
                FirstAppointmentDate = t.FirstAppointmentDate,
                TarikhLantikanJawatanSemasa = t.TarikhLantikanJawatanSemasa,
                TarikhKhidmatSekolahSemasa = t.TarikhKhidmatSekolahSemasa,
                Qualification = t.Qualification,
                Opsyen1 = t.Opsyen1,
                Opsyen2 = t.Opsyen2,
                Ikhtisas = t.Ikhtisas,
                StatusInduksi = t.StatusInduksi,
                SahPerkhidmatan = t.SahPerkhidmatan,
                RetirementDate = t.RetirementDate,
                TugasKhas = t.TugasKhas,
                GuruCemerlang = t.GuruCemerlang,
                GuruCemerlangBidang = t.GuruCemerlangBidang,
                KodJawatanDiisi = t.KodJawatanDiisi,
                Subjects = t.TeacherSubjects.Select(ts => new SubjectDto
                {
                    Name = ts.Subject.Name,
                    Hours = ts.Hours
                }).ToList()
            })
            .ToListAsync();

        return Ok(teachers);
    }
}