namespace EOperasiApi.Models;

public class LoginRequest
{
    public string Username { get; set; } = "";
    public string Password { get; set; } = "";
}

public class LoginResponse
{
    public string Token { get; set; } = "";
    public string Username { get; set; } = "";
    public string Role { get; set; } = "";
    public string FullName { get; set; } = "";
}

public class RegisterRequest
{
    public string Username { get; set; } = "";
    public string Password { get; set; } = "";
    public string FullName { get; set; } = "";
    public string Email { get; set; } = "";
}

public class ForgotPasswordRequest
{
    public string Email { get; set; } = "";
}

public class ResetPasswordRequest
{
    public string Token { get; set; } = "";
    public string NewPassword { get; set; } = "";
}

public class ChangePasswordRequest
{
    public string CurrentPassword { get; set; } = "";
    public string NewPassword { get; set; } = "";
}
