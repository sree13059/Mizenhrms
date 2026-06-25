import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { apiRequest, authStorage } from '../api'
import logo from '../assets/images/logo.jpg'
import { WEBSITE_URL } from '../config'

const views = [
  ['overview', 'bi-grid-1x2-fill', 'Executive Overview'],
  ['onboarding', 'bi-person-plus-fill', 'Add Employee'],
  ['employees', 'bi-people-fill', 'Employees'],
  ['attendance', 'bi-clock-history', 'Attendance'],
  ['leaves', 'bi-calendar2-check-fill', 'Leaves'],
  ['hiring', 'bi-person-workspace', 'Hiring'],
  ['operations', 'bi-kanban-fill', 'Operations'],
  ['meetings', 'bi-camera-video-fill', 'Schedule Meeting'],
]

const emptyData = {
  summary: {}, employees: [], admins: [], applications: [], leaves: [],
  attendance: [], jobs: [], projects: [], departments: [], company: null,
  meetings: [],
}

const initialEmployeeForm = {
  fullName: '', email: '', phone: '', employeeId: '', department: '', designation: '',
  annualLeaveAllowance: 20, profilePhoto: '', experienceType: 'fresher', password: '', confirmPassword: '',
}

const initialMeetingForm = {
  title: '', message: '', meetingDate: '', meetingTime: '', durationMinutes: 30,
  meetingLink: '', audience: 'all',
}

const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024

const readFileAsDataUrl = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(reader.result)
  reader.onerror = reject
  reader.readAsDataURL(file)
})

const formatDate = (value) => value ? new Date(value).toLocaleDateString() : '—'
const formatTime = (value) => value ? new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'
const toDateInputValue = (value) => value ? new Date(value).toISOString().slice(0, 10) : ''
const isUpcomingMeeting = (meeting) => {
  const meetingStartsAt = new Date(`${toDateInputValue(meeting.meetingDate)}T${meeting.meetingTime || '00:00'}`)
  return meeting.status !== 'cancelled' && meetingStartsAt >= new Date()
}

const leaveDays = (leave) => {
  const from = new Date(leave.fromDate)
  const to = new Date(leave.toDate)
  return Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())
    ? 0
    : Math.max(1, Math.floor((to - from) / 86400000) + 1)
}

function ManagementDashboard() {
  const navigate = useNavigate()
  const user = authStorage.getUser()
  const token = authStorage.getToken()
  const isManagement = Boolean(token && user?.role === 'management')
  const [activeView, setActiveView] = useState('overview')
  const [data, setData] = useState(emptyData)
  const [loading, setLoading] = useState(isManagement)
  const [error, setError] = useState('')
  const [employeeForm, setEmployeeForm] = useState(initialEmployeeForm)
  const [meetingForm, setMeetingForm] = useState(initialMeetingForm)
  const [editingMeetingId, setEditingMeetingId] = useState('')
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const [noticeView, setNoticeView] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    if (!isManagement) return undefined
    let active = true

    apiRequest('/admin/management-overview')
      .then((response) => {
        if (active) setData({ ...emptyData, ...response })
      })
      .catch((requestError) => {
        if (active) setError(requestError.message || 'Failed to load management data')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => { active = false }
  }, [isManagement])

  const approvedLeaveDays = useMemo(() => data.leaves
    .filter((leave) => leave.status === 'approved')
    .reduce((total, leave) => total + leaveDays(leave), 0), [data.leaves])
  const nextEmployeeId = useMemo(() => {
    const highest = data.employees.reduce((current, employee) => {
      const match = String(employee.employeeId || '').match(/^EMP(\d+)$/i)
      return match ? Math.max(current, Number(match[1])) : current
    }, 0)
    return `EMP${String(highest + 1).padStart(3, '0')}`
  }, [data.employees])

  const refreshOverview = async () => {
    const response = await apiRequest('/admin/management-overview')
    setData({ ...emptyData, ...response })
  }

  const showNotice = (message, view = activeView) => {
    setNotice(message)
    setNoticeView(view)
  }

  const handleViewChange = (view) => {
    setActiveView(view)
    setNotice('')
    setNoticeView('')
    setSidebarOpen(false)
  }

  const handleRefreshData = async () => {
    try {
      setLoading(true)
      setError('')
      await refreshOverview()
    } catch (requestError) {
      setError(requestError.message || 'Failed to refresh management data')
    } finally {
      setLoading(false)
    }
  }

  const handleEmployeeChange = (event) => {
    const { name, value } = event.currentTarget
    setEmployeeForm((current) => ({
      ...current,
      [name]: name === 'phone' ? value.replace(/\D/g, '').slice(0, 10) : name === 'employeeId' ? value.toUpperCase() : value,
    }))
    setNotice('')
  }

  const handleEmployeePhoto = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      setError('Employee photo must be 10 MB or smaller')
      return
    }
    const profilePhoto = await readFileAsDataUrl(file)
    setEmployeeForm((current) => ({ ...current, profilePhoto }))
  }

  const handleCreateEmployee = async (event) => {
    event.preventDefault()
    try {
      setSaving(true)
      setError('')
      setNotice('')
      await apiRequest('/admin/employees', {
        method: 'POST',
        body: JSON.stringify({ ...employeeForm, employeeId: employeeForm.employeeId || nextEmployeeId }),
      })
      setEmployeeForm(initialEmployeeForm)
      showNotice('Employee credentials and HR profile created successfully.', 'onboarding')
      await refreshOverview()
    } catch (requestError) {
      setError(requestError.message || 'Failed to create employee')
    } finally {
      setSaving(false)
    }
  }

  const handleMeetingChange = (event) => {
    const { name, value } = event.currentTarget
    setMeetingForm((current) => ({ ...current, [name]: value }))
    setNotice('')
  }

  const handleScheduleMeeting = async (event) => {
    event.preventDefault()
    try {
      setSaving(true)
      setError('')
      const response = await apiRequest(editingMeetingId ? `/admin/meetings/${editingMeetingId}` : '/admin/meetings', {
        method: editingMeetingId ? 'PUT' : 'POST',
        body: JSON.stringify(meetingForm),
      })
      setMeetingForm(initialMeetingForm)
      setEditingMeetingId('')
      showNotice(response.message || (editingMeetingId ? 'Meeting updated successfully.' : 'Meeting scheduled and message sent.'), 'meetings')
      await refreshOverview()
    } catch (requestError) {
      setError(requestError.message || 'Failed to schedule meeting')
    } finally {
      setSaving(false)
    }
  }

  const handleLogout = () => {
    authStorage.clearSession()
    navigate('/login')
  }

  const handleEditMeeting = (meeting) => {
    if (!isUpcomingMeeting(meeting)) return
    setEditingMeetingId(meeting._id)
    setMeetingForm({
      title: meeting.title || '',
      message: meeting.message || '',
      meetingDate: toDateInputValue(meeting.meetingDate),
      meetingTime: meeting.meetingTime || '',
      durationMinutes: meeting.durationMinutes || 30,
      meetingLink: meeting.meetingLink || '',
      audience: meeting.audience || 'all',
    })
    handleViewChange('meetings')
  }

  const handleCancelMeetingEdit = () => {
    setEditingMeetingId('')
    setMeetingForm(initialMeetingForm)
  }

  const handleOpenEmployeeDashboard = (employee) => {
    const employeeKey = String(employee._id || employee.id)
    const belongsToEmployee = (entry) => String(entry.employee?._id || entry.employee?.id || entry.employee) === employeeKey
    const stripAttendancePhoto = (entry) => ({
      ...entry,
      loginPhoto: '',
      logoutPhoto: '',
    })
    const preview = {
      employeeId: employeeKey,
      user: { ...employee, id: employee._id || employee.id },
      company: data.company || null,
      leaves: data.leaves.filter(belongsToEmployee),
      attendance: data.attendance.filter(belongsToEmployee).map(stripAttendancePhoto),
    }
    try {
      localStorage.setItem('mizenManagementEmployeePreview', JSON.stringify(preview))
    } catch {
      localStorage.setItem('mizenManagementEmployeePreview', JSON.stringify({
        ...preview,
        user: { ...preview.user, profilePhoto: '' },
      }))
    }
    navigate(`/employee?employeeId=${encodeURIComponent(employee._id || employee.id)}`)
  }

  const handleEmployeeCardKeyDown = (event, employee) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      handleOpenEmployeeDashboard(employee)
    }
  }

  if (!isManagement) {
    return (
      <main className="management-access-page">
        <i className="bi bi-shield-lock-fill"></i>
        <h1>Management access required</h1>
        <p>Sign in with an authorized management account to view company data.</p>
        <button onClick={() => navigate('/login')} type="button">Go to Login</button>
      </main>
    )
  }

  const summaryCards = [
    ['bi-people-fill', 'Employees', data.summary.employees || 0, 'Total workforce'],
    ['bi-person-check-fill', 'Present Today', data.summary.presentToday || 0, 'Attendance recorded'],
    ['bi-calendar2-minus-fill', 'Pending Leaves', data.summary.pendingLeaves || 0, `${approvedLeaveDays} approved days`],
    ['bi-file-earmark-person-fill', 'Applications', data.summary.applications || 0, `${data.summary.shortlisted || 0} shortlisted`],
    ['bi-briefcase-fill', 'Open Jobs', data.summary.openJobs || 0, 'Active recruitment'],
    ['bi-kanban-fill', 'Active Projects', data.summary.activeProjects || 0, 'Current operations'],
  ]
  const totalAnnualLeaves = data.employees.reduce((total, employee) => total + (Number(employee.annualLeaveAllowance) || 20), 0)
  const hrDataCards = [
    ['bi-building-fill', 'Departments', data.departments.length, 'Active company groups'],
    ['bi-calendar2-heart-fill', 'Leave Capacity', totalAnnualLeaves, 'Annual employee days'],
    ['bi-hourglass-split', 'Pending Leaves', data.summary.pendingLeaves || 0, 'Needs HR attention'],
  ]
  const adminDataCards = [
    ['bi-shield-check', 'Admins', data.summary.admins || data.admins.length, 'HRMS control users'],
    ['bi-person-workspace', 'Hiring Pipeline', data.applications.length, 'Candidate records'],
    ['bi-megaphone-fill', 'Meetings', data.meetings.length, 'Scheduled messages'],
  ]
  const adminAttendance = data.attendance.filter((entry) => entry.employee?.role === 'admin')
  const latestAdminAttendance = adminAttendance.slice(0, 5)

  return (
    <div className={`management-dashboard ${sidebarOpen ? 'menu-open' : ''}`}>
      <aside className="management-sidebar">
        <button
          aria-expanded={sidebarOpen}
          aria-label="Toggle management menu"
          className="management-menu-toggle"
          onClick={() => setSidebarOpen((current) => !current)}
          type="button"
        >
          <span></span>
          <span></span>
          <span></span>
        </button>
        <a className="management-brand" href={WEBSITE_URL}>
          <img src={logo} alt="Mizen Tech Solutions" />
          <div><strong>Mizen</strong><span>Management Suite</span></div>
        </a>
        <div className="management-user-card">
          <i className="bi bi-person-badge-fill"></i>
          <div><strong>{user.fullName}</strong><span>Executive access</span></div>
        </div>
        <nav>
          {views.map(([key, icon, label]) => (
            <button className={activeView === key ? 'active' : ''} key={key} onClick={() => handleViewChange(key)} type="button">
              <i className={`bi ${icon}`}></i><span>{label}</span>
            </button>
          ))}
        </nav>
        <button className="management-logout" onClick={handleLogout} type="button"><i className="bi bi-box-arrow-right"></i>Logout</button>
      </aside>

      <main className="management-workspace">
        <header className="management-header">
          <div><span>Management intelligence</span><h1>{views.find(([key]) => key === activeView)?.[2]}</h1><p>{data.company?.name || 'Mizen Tech Solutions'} · Live HRMS data</p></div>
          <button disabled={loading} onClick={handleRefreshData} type="button"><i className="bi bi-arrow-clockwise"></i>Refresh Data</button>
        </header>

        {error && <div className="management-error"><i className="bi bi-exclamation-triangle-fill"></i>{error}</div>}
        {notice && noticeView === activeView && <div className="management-success"><i className="bi bi-check-circle-fill"></i>{notice}</div>}
        {loading && <div className="management-loading"><span></span><p>Preparing management insights...</p></div>}

        {!loading && activeView === 'overview' && (
          <>
            <section className="management-stat-grid">
              {summaryCards.map(([icon, label, value, detail]) => <article key={label}><i className={`bi ${icon}`}></i><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>)}
            </section>
            <section className="management-two-column">
              <article className="management-panel">
                <div className="management-panel-heading"><div><span>Today</span><h2>Attendance Snapshot</h2></div><button onClick={() => handleViewChange('attendance')} type="button">View all</button></div>
                <div className="management-list">
                  {data.attendance.slice(0, 6).map((entry) => <div key={entry._id}><div className="management-avatar">{(entry.employee?.fullName || 'E')[0]}</div><div><strong>{entry.employee?.fullName || 'Employee'}</strong><span>{entry.employee?.role === 'admin' ? 'Admin attendance' : entry.employee?.employeeId || 'No ID'} · {entry.workDate}</span></div><em>{formatTime(entry.loginAt)}–{formatTime(entry.logoutAt)}</em></div>)}
                  {!data.attendance.length && <p className="management-empty">No attendance records available.</p>}
                </div>
              </article>
              <article className="management-panel">
                <div className="management-panel-heading"><div><span>HR queue</span><h2>Pending Leave Requests</h2></div><button onClick={() => handleViewChange('leaves')} type="button">View all</button></div>
                <div className="management-list">
                  {data.leaves.filter((leave) => leave.status === 'pending').slice(0, 6).map((leave) => <div key={leave._id}><div className="management-avatar leave"><i className="bi bi-calendar-event"></i></div><div><strong>{leave.employee?.fullName || 'Employee'}</strong><span>{leave.type} · {formatDate(leave.fromDate)} to {formatDate(leave.toDate)}</span></div><em>{leaveDays(leave)} day{leaveDays(leave) === 1 ? '' : 's'}</em></div>)}
                  {!data.leaves.some((leave) => leave.status === 'pending') && <p className="management-empty">No pending leave requests.</p>}
                </div>
              </article>
            </section>
            <section className="management-insight-grid">
              <article className="management-panel management-data-panel">
                <div className="management-panel-heading"><div><span>HR Data</span><h2>People Operations</h2></div><b>{data.employees.length} profiles</b></div>
                <div className="management-data-card-grid">
                  {hrDataCards.map(([icon, label, value, detail]) => <div key={label}><i className={`bi ${icon}`}></i><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>)}
                </div>
              </article>
              <article className="management-panel management-data-panel">
                <div className="management-panel-heading"><div><span>Admin Data</span><h2>Governance</h2></div><b>{data.admins.length} admins</b></div>
                <div className="management-admin-list">
                  {data.admins.slice(0, 4).map((admin) => <div key={admin._id}><i className="bi bi-shield-check"></i><div><strong>{admin.fullName}</strong><span>{admin.designation || 'HR/Admin'} · {admin.email}</span></div></div>)}
                  {!data.admins.length && <p className="management-empty">Admin profiles will appear here.</p>}
                </div>
              </article>
              <article className="management-panel management-data-panel management-admin-attendance-panel">
                <div className="management-panel-heading"><div><span>Admin Attendance</span><h2>HR Presence</h2></div><b>{adminAttendance.length} logs</b></div>
                <div className="management-admin-attendance-list">
                  {latestAdminAttendance.map((entry) => <div key={entry._id}><i className={`bi ${entry.status === 'checked-in' ? 'bi-person-check-fill' : 'bi-person-badge-fill'}`}></i><div><strong>{entry.employee?.fullName || 'Admin'}</strong><span>{formatDate(entry.loginAt)} · {formatTime(entry.loginAt)} to {formatTime(entry.logoutAt)}</span></div><em className={`management-status ${entry.status}`}>{entry.status}</em></div>)}
                  {!latestAdminAttendance.length && <p className="management-empty">Admin attendance records will appear here.</p>}
                </div>
              </article>
              <article className="management-panel management-data-panel">
                <div className="management-panel-heading"><div><span>Company Pulse</span><h2>Executive Snapshot</h2></div><b>Live</b></div>
                <div className="management-data-card-grid compact">
                  {adminDataCards.map(([icon, label, value, detail]) => <div key={label}><i className={`bi ${icon}`}></i><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>)}
                </div>
              </article>
            </section>
          </>
        )}

        {!loading && activeView === 'onboarding' && (
          <section className="management-two-column management-onboarding-layout">
            <article className="management-panel">
              <div className="management-panel-heading"><div><span>Employee credentials</span><h2>Create Employee and HR Profile</h2></div><b>{nextEmployeeId}</b></div>
              <form className="management-form" onSubmit={handleCreateEmployee}>
                <label className="management-photo-upload">
                  {employeeForm.profilePhoto ? <img src={employeeForm.profilePhoto} alt="Employee preview" /> : <i className="bi bi-camera-fill"></i>}
                  <div><strong>{employeeForm.profilePhoto ? 'Photo selected' : 'Upload employee photo'}</strong><span>JPG/PNG up to 10 MB</span></div>
                  <input accept="image/*" onChange={handleEmployeePhoto} required={!employeeForm.profilePhoto} type="file" />
                </label>
                <div className="management-form-grid">
                  <label><span>Full name *</span><input name="fullName" placeholder="Employee full name" value={employeeForm.fullName} onChange={handleEmployeeChange} required /></label>
                  <label><span>Employee ID *</span><input minLength="6" name="employeeId" pattern="EMP[0-9]{3,}" value={employeeForm.employeeId || nextEmployeeId} onChange={handleEmployeeChange} required /></label>
                  <label><span>Email *</span><input name="email" placeholder="name@company.com" type="email" value={employeeForm.email} onChange={handleEmployeeChange} required /></label>
                  <label><span>10-digit phone *</span><input inputMode="numeric" maxLength="10" minLength="10" name="phone" pattern="[0-9]{10}" placeholder="9876543210" value={employeeForm.phone} onChange={handleEmployeeChange} required /></label>
                  <label><span>Department</span><input name="department" placeholder="Engineering" value={employeeForm.department} onChange={handleEmployeeChange} /></label>
                  <label><span>Designation</span><input name="designation" placeholder="Software Engineer" value={employeeForm.designation} onChange={handleEmployeeChange} /></label>
                  <label><span>Annual leaves</span><input max="365" min="1" name="annualLeaveAllowance" type="number" value={employeeForm.annualLeaveAllowance} onChange={handleEmployeeChange} /></label>
                  <label><span>Experience</span><select name="experienceType" value={employeeForm.experienceType} onChange={handleEmployeeChange}><option value="fresher">Fresher</option><option value="experienced" disabled>Experienced — complete from Admin</option></select></label>
                  <label><span>Password *</span><input minLength="6" name="password" placeholder="Employee password" type="password" value={employeeForm.password} onChange={handleEmployeeChange} required /></label>
                  <label><span>Confirm password *</span><input minLength="6" name="confirmPassword" placeholder="Repeat password" type="password" value={employeeForm.confirmPassword} onChange={handleEmployeeChange} required /></label>
                </div>
                <button className="management-primary-action" disabled={saving} type="submit"><i className="bi bi-person-check-fill"></i>{saving ? 'Creating profile...' : 'Create Employee Credentials'}</button>
              </form>
            </article>
            <article className="management-panel management-onboarding-guide">
              <i className="bi bi-shield-check"></i><h2>Professional onboarding</h2><p>The employee account is stored in MongoDB and becomes immediately visible in both Admin and Management dashboards.</p>
              <ul><li>Employee ID follows the EMP001 format</li><li>Phone number is restricted to exactly 10 digits</li><li>Default annual leave allowance is 20 days</li><li>Employee signs in using their ID and password</li></ul>
            </article>
          </section>
        )}

        {!loading && activeView === 'employees' && (
          <section className="management-panel">
            <div className="management-panel-heading"><div><span>Workforce</span><h2>Complete Employee Directory</h2></div><b>{data.employees.length} employees</b></div>
            <div className="management-employee-grid">
              {data.employees.map((employee) => {
                const currentYear = new Date().getFullYear()
                const employeeLeaves = data.leaves.filter((leave) => leave.status === 'approved' && new Date(leave.fromDate).getFullYear() === currentYear && String(leave.employee?._id || leave.employee) === String(employee._id))
                const used = employeeLeaves.reduce((total, leave) => total + leaveDays(leave), 0)
                const annual = employee.annualLeaveAllowance || 20
                return <article
                  aria-label={`Open ${employee.fullName}'s dashboard`}
                  className="management-employee-card"
                  key={employee._id}
                  onClick={() => handleOpenEmployeeDashboard(employee)}
                  onKeyDown={(event) => handleEmployeeCardKeyDown(event, employee)}
                  role="button"
                  tabIndex="0"
                >
                  <div className="management-employee-head">{employee.profilePhoto ? <img src={employee.profilePhoto} alt="" /> : <span>{(employee.fullName || 'E')[0]}</span>}<div><strong>{employee.fullName}</strong><small>{employee.employeeId || 'No employee ID'}</small></div></div>
                  <dl><div><dt>Role</dt><dd>{employee.designation || 'Team member'}</dd></div><div><dt>Department</dt><dd>{employee.department || 'Unassigned'}</dd></div><div><dt>Email</dt><dd>{employee.email}</dd></div><div><dt>Phone</dt><dd>{employee.phone}</dd></div><div><dt>Experience</dt><dd>{employee.experienceType === 'experienced' ? `${employee.experienceYears || 0} years` : 'Fresher'}</dd></div><div><dt>Leave balance</dt><dd>{Math.max(0, annual - used)} / {annual} days</dd></div></dl>
                  {employee.previousCompanyName && <p><i className="bi bi-building"></i>Previously at {employee.previousCompanyName}</p>}
                </article>
              })}
            </div>
          </section>
        )}

        {!loading && activeView === 'attendance' && (
          <section className="management-panel">
            <div className="management-panel-heading"><div><span>Work logs</span><h2>Attendance Records</h2></div><b>{data.attendance.length} records</b></div>
            <div className="management-admin-attendance-strip">
              {latestAdminAttendance.map((entry) => <article key={entry._id}><i className={`bi ${entry.status === 'checked-in' ? 'bi-person-check-fill' : 'bi-person-badge-fill'}`}></i><div><span>Admin</span><strong>{entry.employee?.fullName || 'Admin'}</strong><small>{formatDate(entry.loginAt)} · {formatTime(entry.loginAt)} to {formatTime(entry.logoutAt)}</small></div><em className={`management-status ${entry.status}`}>{entry.status}</em></article>)}
              {!latestAdminAttendance.length && <p className="management-empty">No admin attendance records yet.</p>}
            </div>
            <div className="management-table-wrap"><table><thead><tr><th>Employee / Admin</th><th>Date</th><th>Login</th><th>Logout</th><th>Hours</th><th>Status</th></tr></thead><tbody>{data.attendance.map((entry) => <tr key={entry._id}><td><strong>{entry.employee?.fullName || 'Team member'}</strong><small>{entry.employee?.role === 'admin' ? 'Administrator' : entry.employee?.employeeId}</small></td><td>{entry.workDate}</td><td>{formatTime(entry.loginAt)}</td><td>{formatTime(entry.logoutAt)}</td><td>{entry.totalHours ?? '—'}</td><td><span className={`management-status ${entry.status}`}>{entry.status}</span></td></tr>)}</tbody></table></div>
          </section>
        )}

        {!loading && activeView === 'leaves' && (
          <section className="management-panel">
            <div className="management-panel-heading"><div><span>Time off</span><h2>All Leave Requests</h2></div><b>{data.leaves.length} requests</b></div>
            <div className="management-table-wrap"><table><thead><tr><th>Employee</th><th>Type</th><th>Period</th><th>Days</th><th>Reason</th><th>Status</th></tr></thead><tbody>{data.leaves.map((leave) => <tr key={leave._id}><td><strong>{leave.employee?.fullName || 'Employee'}</strong><small>{leave.employee?.employeeId}</small></td><td>{leave.type}</td><td>{formatDate(leave.fromDate)} – {formatDate(leave.toDate)}</td><td>{leaveDays(leave)}</td><td>{leave.reason || '—'}</td><td><span className={`management-status ${leave.status}`}>{leave.status}</span></td></tr>)}</tbody></table></div>
          </section>
        )}

        {!loading && activeView === 'hiring' && (
          <section className="management-two-column">
            <article className="management-panel"><div className="management-panel-heading"><div><span>Talent pipeline</span><h2>Job Applications</h2></div><b>{data.applications.length}</b></div><div className="management-list hiring">{data.applications.map((application) => <div key={application._id}><div className="management-avatar">{(application.fullName || 'C')[0]}</div><div><strong>{application.fullName}</strong><span>{application.jobTitle} · {application.email}</span></div><em className={`management-status ${application.status}`}>{application.status}</em></div>)}</div></article>
            <article className="management-panel"><div className="management-panel-heading"><div><span>Openings</span><h2>Job Positions</h2></div><b>{data.jobs.length}</b></div><div className="management-list hiring">{data.jobs.map((job) => <div key={job._id}><div className="management-avatar job"><i className="bi bi-briefcase-fill"></i></div><div><strong>{job.title}</strong><span>{job.department} · {job.location}</span></div><em className={`management-status ${job.status}`}>{job.status}</em></div>)}</div></article>
          </section>
        )}

        {!loading && activeView === 'operations' && (
          <section className="management-two-column">
            <article className="management-panel"><div className="management-panel-heading"><div><span>Delivery</span><h2>Projects</h2></div><b>{data.projects.length}</b></div><div className="management-project-grid">{data.projects.map((project) => <div key={project._id}><strong>{project.name}</strong><span>{project.client || 'Internal project'}</span><div><i style={{ width: `${project.progress || 0}%` }}></i></div><small>{project.progress || 0}% · {project.status}</small></div>)}</div></article>
            <article className="management-panel"><div className="management-panel-heading"><div><span>Organization</span><h2>Departments and HR</h2></div><b>{data.departments.length} departments</b></div><div className="management-list">{data.departments.map((department) => <div key={department._id}><div className="management-avatar dept"><i className="bi bi-diagram-3-fill"></i></div><div><strong>{department.name}</strong><span>{department.description || 'Company department'}</span></div></div>)}{data.admins.map((admin) => <div key={admin._id}><div className="management-avatar admin"><i className="bi bi-shield-check"></i></div><div><strong>{admin.fullName}</strong><span>HR/Admin · {admin.email}</span></div></div>)}</div></article>
          </section>
        )}

        {!loading && activeView === 'meetings' && (
          <section className="management-two-column">
            <article className="management-panel">
              <div className="management-panel-heading"><div><span>Communication</span><h2>{editingMeetingId ? 'Edit Meeting' : 'Schedule a Meeting'}</h2></div><b>{editingMeetingId ? 'Editing' : 'Management'}</b></div>
              <form className="management-form" onSubmit={handleScheduleMeeting}>
                <div className="meeting-audience-choice">
                  {[['all', 'bi-people-fill', 'Admin + Employees'], ['admin', 'bi-shield-fill-check', 'Admins'], ['employee', 'bi-person-badge-fill', 'Employees']].map(([value, icon, label]) => <button className={meetingForm.audience === value ? 'active' : ''} name="audience" onClick={handleMeetingChange} type="button" value={value} key={value}><i className={`bi ${icon}`}></i>{label}</button>)}
                </div>
                <div className="management-form-grid">
                  <label className="span-2"><span>Meeting title *</span><input name="title" placeholder="Monthly HR review" value={meetingForm.title} onChange={handleMeetingChange} required /></label>
                  <label><span>Date *</span><input name="meetingDate" type="date" value={meetingForm.meetingDate} onChange={handleMeetingChange} required /></label>
                  <label><span>Time *</span><input name="meetingTime" type="time" value={meetingForm.meetingTime} onChange={handleMeetingChange} required /></label>
                  <label><span>Duration</span><select name="durationMinutes" value={meetingForm.durationMinutes} onChange={handleMeetingChange}><option value="30">30 minutes</option><option value="45">45 minutes</option><option value="60">1 hour</option><option value="90">1.5 hours</option></select></label>
                  <label><span>Meeting link</span><input name="meetingLink" placeholder="https://meet.google.com/..." type="url" value={meetingForm.meetingLink} onChange={handleMeetingChange} /></label>
                  <label className="span-2"><span>Message to recipients *</span><textarea name="message" placeholder="Add agenda, preparation notes, and meeting instructions" value={meetingForm.message} onChange={handleMeetingChange} required></textarea></label>
                </div>
                <button className="management-primary-action" disabled={saving} type="submit"><i className={`bi ${editingMeetingId ? 'bi-check2-circle' : 'bi-send-fill'}`}></i>{saving ? 'Saving...' : editingMeetingId ? 'Update Meeting' : 'Schedule and Send Message'}</button>
                {editingMeetingId && <button className="management-secondary-action" onClick={handleCancelMeetingEdit} type="button">Cancel Edit</button>}
              </form>
            </article>
            <article className="management-panel">
              <div className="management-panel-heading"><div><span>Calendar</span><h2>Scheduled Meetings</h2></div><b>{data.meetings.length}</b></div>
              <div className="management-meeting-list">
                {data.meetings.map((meeting) => <article key={meeting._id}><div className="meeting-date-tile"><strong>{new Date(meeting.meetingDate).getDate()}</strong><span>{new Date(meeting.meetingDate).toLocaleString([], { month: 'short' })}</span></div><div><strong>{meeting.title}</strong><span>{meeting.meetingTime} · {meeting.durationMinutes} minutes · {meeting.audience === 'all' ? 'Everyone' : meeting.audience}</span><p>{meeting.message}</p>{meeting.meetingLink && <a href={meeting.meetingLink} rel="noreferrer" target="_blank">Open meeting link</a>}{isUpcomingMeeting(meeting) && <button className="meeting-edit-button" onClick={() => handleEditMeeting(meeting)} type="button"><i className="bi bi-pencil-square"></i>Edit</button>}</div></article>)}
                {!data.meetings.length && <p className="management-empty">No meetings scheduled yet.</p>}
              </div>
            </article>
          </section>
        )}
      </main>
    </div>
  )
}

export default ManagementDashboard
