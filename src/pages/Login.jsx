import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiRequest, authStorage } from "../api";
import { WEBSITE_URL } from "../config";
import logo from "../assets/images/logo.jpg";

const ADMIN_USERNAME = "Mizentechsolutions";
const ADMIN_PASSWORD = "Mizen123";
const ADMIN_EMAIL = "Mizentechsolutions@gmail.com";
const bootstrapAdmin = async () => {
  const data = await apiRequest("/auth/register", {
    method: "POST",
    body: JSON.stringify({
      role: "admin",
      fullName: ADMIN_USERNAME,
      email: ADMIN_EMAIL,
      phone: "+91 94809 49103",
      adminCode: "MIZEN-ADMIN",
      companySize: "100+ Employees",
      industry: "Technology Services",
      password: ADMIN_PASSWORD,
      confirmPassword: ADMIN_PASSWORD,
    }),
  });

  return data;
};

function Login() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    role: "employee",
    username: "",
    password: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (event) => {
    const { name, value } = event.currentTarget;
    setForm((current) => ({
      ...current,
      [name]: value,
    }));
    setError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const isFixedAdminLogin =
        form.username.trim().toLowerCase() === ADMIN_USERNAME.toLowerCase() &&
        form.password === ADMIN_PASSWORD;
      const loginPayload = {
        ...form,
        username: form.username.trim(),
        role: isFixedAdminLogin ? "admin" : form.role,
      };

      const data = await apiRequest("/auth/login", {
        method: "POST",
        body: JSON.stringify(loginPayload),
      });

      authStorage.setSession(data.token, data.user);
      navigate(data.user.role === "admin" ? "/admin" : data.user.role === "management" ? "/management" : "/employee");
    } catch (err) {
      const isFixedAdminLogin =
        form.username.trim().toLowerCase() === ADMIN_USERNAME.toLowerCase() &&
        form.password === ADMIN_PASSWORD;

      if (isFixedAdminLogin) {
        try {
          const data = await bootstrapAdmin();
          authStorage.setSession(data.token, data.user);
          navigate("/admin");
          return;
        } catch {
          authStorage.clearSession();
        }
      }

      setError(err.message || "Invalid username or password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        .login-page{
          min-height:100vh;
          background:
            radial-gradient(circle at 12% 18%, rgba(111,182,83,.2), transparent 25%),
            radial-gradient(circle at 88% 82%, rgba(23,67,111,.18), transparent 28%),
            linear-gradient(135deg, #edf5fb, #f5fbf2);
          display:flex;
          justify-content:center;
          align-items:center;
          padding:42px 18px;
        }

        .login-card{
          width:100%;
          max-width:1060px;
          background:#fff;
          border-radius:24px;
          overflow:hidden;
          box-shadow:0 24px 70px rgba(23,67,111,.14);
          border:1px solid rgba(255,255,255,.8);
          animation:fadeUp .8s ease;
        }

        @keyframes fadeUp{
          from{
            opacity:0;
            transform:translateY(40px);
          }
          to{
            opacity:1;
            transform:translateY(0);
          }
        }

        .login-left{
          background:linear-gradient(
            135deg,
            #17436f,
            #6fb653
          );
          color:#fff;
          padding:70px 44px;
          height:100%;
          display:flex;
          flex-direction:column;
          justify-content:center;
          position:relative;
          overflow:hidden;
        }

        .login-brand-lockup{
          align-items:center;
          display:flex;
          gap:12px;
          margin-bottom:32px;
          position:relative;
          z-index:1;
        }

        .login-brand-lockup img{
          background:#fff;
          border:3px solid rgba(255,255,255,.24);
          border-radius:14px;
          height:54px;
          object-fit:cover;
          width:54px;
        }

        .login-brand-lockup strong,
        .login-brand-lockup span{
          display:block;
        }

        .login-brand-lockup strong{font-size:1.05rem}
        .login-brand-lockup span{color:rgba(255,255,255,.72);font-size:.78rem}

        .login-left::before{
          content:"";
          position:absolute;
          width:180px;
          height:180px;
          border-radius:50%;
          background:rgba(255,255,255,.1);
          top:-60px;
          right:-60px;
        }

        .login-left::after{
          content:"";
          position:absolute;
          width:120px;
          height:120px;
          border-radius:50%;
          background:rgba(255,255,255,.08);
          left:-20px;
          bottom:-20px;
        }

        .login-badge{
          display:inline-block;
          width:max-content;
          padding:8px 18px;
          border-radius:30px;
          background:rgba(255,255,255,.2);
          margin-bottom:20px;
          font-size:13px;
          font-weight:600;
        }

        .login-left h1{
          font-size:clamp(2.4rem, 5vw, 3.5rem);
          font-weight:900;
          line-height:1;
          margin-bottom:20px;
        }

        .login-left p{
          line-height:1.8;
        }

        .login-benefits{
          display:grid;
          gap:13px;
          margin-top:28px;
          position:relative;
          z-index:1;
        }

        .login-benefits div{
          align-items:center;
          color:rgba(255,255,255,.88);
          display:flex;
          font-size:.88rem;
          gap:10px;
        }

        .login-benefits i{
          align-items:center;
          background:rgba(255,255,255,.15);
          border-radius:9px;
          display:flex;
          height:30px;
          justify-content:center;
          width:30px;
        }

        .login-right{
          padding:58px 52px;
          background:#fff;
        }

        .form-title{
          color:#17436f;
          font-size:2rem;
          font-weight:700;
          margin:0;
        }

        .login-form-head{
          margin-bottom:28px;
        }

        .login-form-head span{
          color:#6fb653;
          display:block;
          font-size:.75rem;
          font-weight:900;
          letter-spacing:.12em;
          margin-bottom:5px;
          text-transform:uppercase;
        }

        .login-form-head p{
          color:#74879a;
          margin:8px 0 0;
        }

        .login-form{
          display:grid;
          gap:20px;
        }

        .login-field{
          display:grid;
          gap:8px;
        }

        .login-field{
          margin-bottom:20px;
        }

        .login-field label{
          display:block;
          font-weight:600;
          color:#17436f;
        }

        .login-field input,
        .login-field select{
          width:100%;
          height:55px;
          border:1px solid #dbe4ee;
          border-radius:12px;
          padding:0 15px;
          transition:.3s;
          background:#fff;
          color:#17436f;
        }

        .login-role-pill{
          align-items:center;
          background:linear-gradient(135deg, #f4faf2, #eef7ff);
          border:1px solid #dbe4ee;
          border-radius:12px;
          color:#17436f;
          display:flex;
          font-weight:700;
          height:55px;
          padding:0 15px;
        }

        .login-role-options{
          display:grid;
          gap:12px;
          grid-template-columns:repeat(3, minmax(0,1fr));
        }

        .login-role-option{
          align-items:center;
          background:#f8fafc;
          border:1px solid #dbe4ee;
          border-radius:14px;
          color:#5d7288;
          display:flex;
          font-weight:800;
          gap:10px;
          min-height:54px;
          padding:10px 14px;
        }

        .login-role-option i{font-size:18px}

        .login-role-option.active{
          background:linear-gradient(135deg, #edf7ea, #eef6fc);
          border-color:#6fb653;
          box-shadow:0 8px 18px rgba(66,117,75,.1);
          color:#17436f;
        }

        .login-input-shell{position:relative}

        .login-input-shell > i{
          color:#6f8599;
          font-size:17px;
          left:17px;
          position:absolute;
          top:18px;
          z-index:1;
        }

        .login-field .login-input-shell input{
          padding-left:46px;
        }

        .login-field .login-input-shell input[type="password"],
        .login-field .login-input-shell input[type="text"]{
          padding-right:68px;
        }

        .login-field input:focus,
        .login-field select:focus{
          outline:none;
          border-color:#6fb653;
          box-shadow:0 0 0 4px rgba(111,182,83,.15);
        }

        .password-wrapper{
          position:relative;
        }

        .show-btn{
          position:absolute;
          right:15px;
          top:15px;
          background:none;
          border:none;
          color:#17436f;
          font-weight:600;
          cursor:pointer;
        }

        .login-btn{
          width:100%;
          border:none;
          padding:14px;
          border-radius:12px;
          color:white;
          font-weight:700;
          font-size:16px;
          background:linear-gradient(
            135deg,
            #17436f,
            #6fb653
          );
          transition:.3s;
        }

        .login-btn:hover{
          transform:translateY(-3px);
          box-shadow:0 12px 25px rgba(23,67,111,.25);
        }

        .login-btn:disabled{
          cursor:not-allowed;
          opacity:.72;
          transform:none;
        }

        .auth-error{
          background:#fff1f2;
          border:1px solid #fecdd3;
          border-radius:12px;
          color:#b42336;
          margin:0;
          padding:11px 13px;
          font-weight:600;
        }

        .register-link{
          text-align:center;
          margin-top:20px;
        }

        .register-link a{
          color:#6fb653;
          text-decoration:none;
          font-weight:600;
        }

        .register-link a:hover{
          color:#17436f;
        }

        .login-security-note{
          align-items:center;
          color:#8090a0;
          display:flex;
          font-size:.74rem;
          gap:7px;
          justify-content:center;
        }

        @media(max-width:768px){

          .login-left{
            display:none;
          }

          .login-right{
            padding:25px;
          }

          .form-title{
            text-align:center;
          }
        }
      `}</style>

      <div className="login-page">
        <div className="login-card">
          <div className="row g-0">

            <div className="col-md-5">
              <div className="login-left">

                <div className="login-brand-lockup">
                  <img src={logo} alt="Mizen Tech Solutions" />
                  <div><strong>Mizen Tech Solutions</strong><span>Human Resource Management System</span></div>
                </div>

                <div className="login-badge">
                  SECURE HRMS PORTAL
                </div>

                <h1>People.<br />Work. Growth.</h1>

                <p>
                  One organized workspace for employees, attendance, leave,
                  projects, and everyday HR operations.
                </p>

                <div className="login-benefits">
                  <div><i className="bi bi-shield-check"></i><span>Secure role-based access</span></div>
                  <div><i className="bi bi-calendar2-check"></i><span>Attendance and leave tracking</span></div>
                  <div><i className="bi bi-people"></i><span>Complete employee workspace</span></div>
                </div>

              </div>
            </div>

          <div className="col-md-7">
              <div className="login-right">

                <div className="login-form-head">
                  <span>Welcome back</span>
                  <h2 className="form-title">Sign in to HRMS</h2>
                  <p>Select your role and enter your account details.</p>
                </div>

                <form className="login-form" onSubmit={handleSubmit}>

                  <div className="login-field">
                    <label>Login As</label>
                    <div className="login-role-options" role="group" aria-label="Login role">
                      <button className={`login-role-option ${form.role === 'employee' ? 'active' : ''}`} name="role" onClick={handleChange} type="button" value="employee"><i className="bi bi-person-badge-fill"></i>Employee</button>
                      <button className={`login-role-option ${form.role === 'admin' ? 'active' : ''}`} name="role" onClick={handleChange} type="button" value="admin"><i className="bi bi-shield-lock-fill"></i>Admin</button>
                      <button className={`login-role-option ${form.role === 'management' ? 'active' : ''}`} name="role" onClick={handleChange} type="button" value="management"><i className="bi bi-bar-chart-fill"></i>Management</button>
                    </div>
                  </div>

                  <div className="login-field">
                    <label>Username</label>
                    <div className="login-input-shell">
                      <i className="bi bi-person-fill" aria-hidden="true"></i>
                      <input
                        type="text"
                        name="username"
                        placeholder="Email, employee ID, or name"
                        value={form.username}
                        onChange={handleChange}
                        required
                      />
                    </div>
                  </div>

                  <div className="password-wrapper">
                    <div className="login-field">
                      <label>Password</label>
                      <div className="login-input-shell">
                        <i className="bi bi-lock-fill" aria-hidden="true"></i>
                        <input
                          type={showPassword ? "text" : "password"}
                          name="password"
                          placeholder="Enter password"
                          value={form.password}
                          onChange={handleChange}
                          required
                        />
                        <button
                          type="button"
                          className="show-btn"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? "Hide" : "Show"}
                        </button>
                      </div>
                    </div>
                  </div>

                  {error && (
                    <p className="auth-error">
                      {error}
                    </p>
                  )}

                  <button
                    type="submit"
                    className="login-btn"
                    disabled={loading}
                  >
                    {loading ? "Signing in..." : "Sign In Securely"}
                  </button>

                  <div className="login-security-note"><i className="bi bi-lock-fill"></i>Your session is protected and role restricted.</div>

                  <div className="register-link">
                    Looking for a job?{" "}
                    <a href={`${WEBSITE_URL}/apply`}>
                      Apply Now
                    </a>
                  </div>

                </form>

              </div>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}

export default Login;
