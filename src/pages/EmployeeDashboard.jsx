import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { apiRequest, authStorage, optionalApiRequest } from '../api'
import logo from '../assets/images/logo.jpg'
import { WEBSITE_URL } from '../config'

const sidebarItems = [
  ['overview', 'bi-grid-1x2-fill', 'Overview'],
  ['attendance', 'bi-clock-history', 'Attendance'],
  ['leaves', 'bi-calendar2-check-fill', 'Leaves'],
  ['meetings', 'bi-camera-video-fill', 'Meetings'],
  ['profile', 'bi-person-badge-fill', 'Edit Profile'],
  ['company', 'bi-building-fill', 'Company'],
]

const emptyLeaveForm = {
  type: 'casual',
  fromDate: '',
  toDate: '',
  reason: '',
}

const formatDate = (value) => (value ? new Date(value).toLocaleDateString() : 'Not added')
const formatTime = (value) => (value ? new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Pending')
const getWorkDate = () => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const values = parts.reduce((acc, part) => {
    if (part.type !== 'literal') acc[part.type] = part.value
    return acc
  }, {})
  return `${values.year}-${values.month}-${values.day}`
}
const getLeaveDays = (leave) => {
  const from = new Date(leave.fromDate)
  const to = new Date(leave.toDate)
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return 0
  return Math.max(1, Math.floor((to - from) / 86400000) + 1)
}

function EmployeeDashboard() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const videoRef = useRef(null)
  const storedUser = authStorage.getUser()
  const token = authStorage.getToken()
  const storedRole = storedUser?.role
  const employeeId = searchParams.get('employeeId') || ''
  const isEmployee = Boolean(token && (storedRole === 'employee' || localStorage.getItem('mizenRole') === 'employee'))
  const isAdminPreview = Boolean(token && ['admin', 'management'].includes(storedRole) && employeeId)
  const hasDashboardAccess = isEmployee || isAdminPreview
  const [activeView, setActiveView] = useState('overview')
  const [user, setUser] = useState(isAdminPreview ? null : storedUser)
  const [company, setCompany] = useState(null)
  const [leaves, setLeaves] = useState([])
  const [attendance, setAttendance] = useState([])
  const [meetings, setMeetings] = useState([])
  const [profileForm, setProfileForm] = useState({
    fullName: storedUser?.fullName || '',
    phone: storedUser?.phone || '',
    employeeId: storedUser?.employeeId || '',
    department: storedUser?.department || '',
    designation: storedUser?.designation || '',
    address: storedUser?.address || '',
    bio: storedUser?.bio || '',
    skills: storedUser?.skills || '',
    linkedIn: storedUser?.linkedIn || '',
  })
  const [leaveForm, setLeaveForm] = useState(emptyLeaveForm)
  const [loading, setLoading] = useState(true)
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingLeave, setSavingLeave] = useState(false)
  const [savingAttendance, setSavingAttendance] = useState(false)
  const [cameraStream, setCameraStream] = useState(null)
  const [cameraAction, setCameraAction] = useState('')
  const [error, setError] = useState('')

  const fetchEmployeeData = useCallback(async () => {
    if (isAdminPreview) {
      let previewData
      try {
        previewData = await apiRequest(`/admin/employees/${employeeId}/dashboard`)
      } catch (previewError) {
        let storedPreview
        try {
          storedPreview = JSON.parse(localStorage.getItem('mizenManagementEmployeePreview') || 'null')
        } catch {
          storedPreview = null
        }
        if (storedRole !== 'management' || String(storedPreview?.employeeId || '') !== String(employeeId)) {
          throw previewError
        }
        previewData = storedPreview
      }
      return {
        nextUser: previewData.user,
        nextCompany: previewData.company || null,
        nextLeaves: previewData.leaves || [],
        nextAttendance: previewData.attendance || [],
        nextMeetings: [],
      }
    }

    const [profileData, companyData, leavesData, attendanceData, meetingsData] = await Promise.all([
      apiRequest('/auth/me'),
      apiRequest('/admin/company'),
      apiRequest('/admin/leaves'),
      apiRequest('/admin/attendance'),
      optionalApiRequest('/admin/meetings', { meetings: [] }),
    ])

    return {
      nextUser: profileData.user,
      nextCompany: companyData.company || null,
      nextLeaves: leavesData.leaves || [],
      nextAttendance: attendanceData.attendance || [],
      nextMeetings: meetingsData.meetings || [],
    }
  }, [employeeId, isAdminPreview, storedRole])

  const applyEmployeeData = ({ nextUser, nextCompany, nextLeaves, nextAttendance, nextMeetings }) => {
    setUser(nextUser)
    setCompany(nextCompany)
    setLeaves(nextLeaves)
    setAttendance(nextAttendance)
    setMeetings(nextMeetings || [])
    setProfileForm({
      fullName: nextUser.fullName || '',
      phone: nextUser.phone || '',
      employeeId: nextUser.employeeId || '',
      department: nextUser.department || '',
      designation: nextUser.designation || '',
      address: nextUser.address || '',
      bio: nextUser.bio || '',
      skills: nextUser.skills || '',
      linkedIn: nextUser.linkedIn || '',
    })
    setError('')
  }

  useEffect(() => {
    if (!hasDashboardAccess) return undefined

    let isActive = true

    fetchEmployeeData()
      .then((data) => {
        if (isActive) {
          applyEmployeeData(data)
        }
      })
      .catch((err) => {
        if (isActive) {
          setError(err.message || 'Failed to load employee dashboard')
        }
      })
      .finally(() => {
        if (isActive) {
          setLoading(false)
        }
      })

    return () => {
      isActive = false
    }
  }, [fetchEmployeeData, hasDashboardAccess])

  useEffect(() => {
    if (videoRef.current && cameraStream) {
      videoRef.current.srcObject = cameraStream
    }
  }, [cameraStream])

  useEffect(
    () => () => {
      cameraStream?.getTracks().forEach((track) => track.stop())
    },
    [cameraStream],
  )

  const activeAttendance = useMemo(
    () => attendance.find((entry) => entry.status === 'checked-in'),
    [attendance],
  )
  const todayAttendance = useMemo(
    () => attendance.find((entry) => entry.workDate === getWorkDate()),
    [attendance],
  )
  const pendingLeaves = useMemo(() => leaves.filter((leave) => leave.status === 'pending'), [leaves])
  const approvedLeaves = useMemo(() => leaves.filter((leave) => leave.status === 'approved'), [leaves])
  const annualLeaveAllowance = Number(user?.annualLeaveAllowance) || 20
  const usedLeaveDays = useMemo(() => approvedLeaves
    .filter((leave) => leave.type !== 'unpaid')
    .filter((leave) => new Date(leave.fromDate).getFullYear() === new Date().getFullYear())
    .reduce((total, leave) => total + getLeaveDays(leave), 0), [approvedLeaves])
  const pendingLeaveDays = useMemo(() => pendingLeaves
    .filter((leave) => leave.type !== 'unpaid')
    .filter((leave) => new Date(leave.fromDate).getFullYear() === new Date().getFullYear())
    .reduce((total, leave) => total + getLeaveDays(leave), 0), [pendingLeaves])
  const remainingLeaveDays = Math.max(0, annualLeaveAllowance - usedLeaveDays - pendingLeaveDays)
  const requestedLeaveDays = useMemo(() => {
    if (!leaveForm.fromDate || !leaveForm.toDate) return 0
    const from = new Date(leaveForm.fromDate)
    const to = new Date(leaveForm.toDate)
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) return 0
    return Math.max(1, Math.floor((to - from) / 86400000) + 1)
  }, [leaveForm.fromDate, leaveForm.toDate])

  const dashboardStats = [
    [
      'bi-clock-fill',
      'Attendance',
      activeAttendance ? 'Logged In' : (todayAttendance && todayAttendance.status === 'checked-out' ? 'Completed' : 'Logged Out'),
      activeAttendance ? 'Session active' : (todayAttendance && todayAttendance.status === 'checked-out' ? 'Done for today' : 'Ready to login'),
    ],
    ['bi-calendar2-check-fill', 'Leaves Remaining', remainingLeaveDays, `${annualLeaveAllowance} days per year`],
    ['bi-patch-check-fill', 'Leaves Used', usedLeaveDays, `${pendingLeaves.length} pending request${pendingLeaves.length === 1 ? '' : 's'}`],
    ['bi-person-check-fill', 'Employee ID', user?.employeeId || 'Not assigned', 'Current profile'],
  ]

  const handleProfileChange = (event) => {
    setProfileForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }))
  }

  const handleLeaveChange = (event) => {
    setLeaveForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }))
  }

  const handleProfileSave = async (event) => {
    event.preventDefault()
    if (isAdminPreview) return

    try {
      setSavingProfile(true)
      setError('')
      const data = await apiRequest('/auth/me', {
        method: 'PUT',
        body: JSON.stringify(profileForm),
      })
      setUser(data.user)
      authStorage.setSession(authStorage.getToken(), data.user)
      setActiveView('overview')
    } catch (err) {
      setError(err.message || 'Failed to update profile')
    } finally {
      setSavingProfile(false)
    }
  }

  const handleLeaveSubmit = async (event) => {
    event.preventDefault()
    if (isAdminPreview) return

    try {
      if (new Date(leaveForm.toDate) < new Date(leaveForm.fromDate)) {
        setError('Leave end date cannot be before start date')
        return
      }
      if (leaveForm.type !== 'unpaid' && requestedLeaveDays > remainingLeaveDays) {
        setError(`You requested ${requestedLeaveDays} leave day${requestedLeaveDays === 1 ? '' : 's'}, but only ${remainingLeaveDays} day${remainingLeaveDays === 1 ? '' : 's'} are available.`)
        return
      }
      setSavingLeave(true)
      setError('')
      await apiRequest('/admin/leaves', {
        method: 'POST',
        body: JSON.stringify(leaveForm),
      })
      setLeaveForm(emptyLeaveForm)
      applyEmployeeData(await fetchEmployeeData())
      setActiveView('leaves')
    } catch (err) {
      setError(err.message || 'Failed to submit leave request')
    } finally {
      setSavingLeave(false)
    }
  }

  const closeAttendanceCamera = () => {
    cameraStream?.getTracks().forEach((track) => track.stop())
    setCameraStream(null)
    setCameraAction('')
  }

  const openAttendanceCamera = async (action) => {
    if (isAdminPreview) return

    try {
      setError('')
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false,
      })
      setCameraAction(action)
      setCameraStream(stream)
    } catch (err) {
      setError(err.message || 'Camera access is required to mark attendance')
    }
  }

  const captureAttendancePhoto = async () => {
    if (!videoRef.current || !cameraAction) return

    const canvas = document.createElement('canvas')
    canvas.width = videoRef.current.videoWidth || 640
    canvas.height = videoRef.current.videoHeight || 480
    const context = canvas.getContext('2d')
    context.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height)
    const photo = canvas.toDataURL('image/jpeg', 0.82)

    closeAttendanceCamera()

    if (cameraAction === 'login') {
      await handleAttendanceLogin(photo)
    } else {
      await handleAttendanceLogout(photo)
    }
  }

  const handleAttendanceLogin = async (loginPhoto) => {
    try {
      setSavingAttendance(true)
      setError('')
      await apiRequest('/admin/attendance/login', {
        method: 'POST',
        body: JSON.stringify({ loginPhoto }),
      })
      applyEmployeeData(await fetchEmployeeData())
      setActiveView('attendance')
    } catch (err) {
      setError(err.message || 'Failed to record attendance login')
    } finally {
      setSavingAttendance(false)
    }
  }

  const handleAttendanceLogout = async (logoutPhoto) => {
    try {
      setSavingAttendance(true)
      setError('')
      await apiRequest('/admin/attendance/logout', {
        method: 'PUT',
        body: JSON.stringify({ logoutPhoto }),
      })
      applyEmployeeData(await fetchEmployeeData())
      setActiveView('attendance')
    } catch (err) {
      setError(err.message || 'Failed to record attendance logout')
    } finally {
      setSavingAttendance(false)
    }
  }

  const handleLogout = async () => {
    if (isAdminPreview) {
      navigate(storedUser?.role === 'management' ? '/management' : '/admin')
      return
    }

    try {
      await apiRequest('/auth/logout', { method: 'POST' })
    } catch {
      // Local logout should still complete even if the server cannot record it.
    } finally {
      authStorage.clearSession()
      navigate('/login')
    }
  }

  if (!hasDashboardAccess) {
    return (
      <main className="employee-locked">
        <section>
          <p className="eyebrow">Protected</p>
          <h1>Employee access required</h1>
          <p>Please login with an employee account to open the dashboard.</p>
          <Link className="primary-btn" to="/login">
            Go to Login
          </Link>
        </section>
      </main>
    )
  }

  return (
    <main className="employee-shell employee-dashboard-shell">
      <aside className="employee-sidebar">
        <a className="employee-brand" href={WEBSITE_URL}>
          <img src={logo} alt="Mizen Tech Solutions logo" />
          <span>
            <strong>Mizen</strong>
            <small>{isAdminPreview ? `${storedUser?.role === 'management' ? 'Management' : 'Admin'} Preview` : 'Employee'}</small>
          </span>
        </a>

        <div className="employee-mini-profile">
          <div className="employee-avatar">
            {(user?.fullName || 'E').slice(0, 1).toUpperCase()}
          </div>
          <strong>{user?.fullName || 'Employee'}</strong>
          <span>{user?.designation || 'Team Member'}</span>
        </div>

        <nav className="employee-nav" aria-label="Employee navigation">
          {sidebarItems.map(([id, icon, label]) => (
            <button
              className={activeView === id ? 'active' : undefined}
              key={id}
              onClick={() => setActiveView(id)}
              type="button"
            >
              <i className={`bi ${icon}`} aria-hidden="true"></i>
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <button className="employee-logout" onClick={handleLogout} type="button">
          <i className={`bi ${isAdminPreview ? 'bi-arrow-left' : 'bi-box-arrow-right'}`} aria-hidden="true"></i>
          {isAdminPreview ? `Back to ${storedUser?.role === 'management' ? 'Management' : 'Admin'}` : 'Logout'}
        </button>
      </aside>

      <section className="employee-workspace">
        {isAdminPreview && (
          <div className="employee-admin-preview-note">
            <i className="bi bi-eye-fill" aria-hidden="true"></i>
            <span>You are viewing this employee dashboard in preview mode. Employee actions are read-only.</span>
          </div>
        )}

        <div className="employee-dashboard-topbar">
          <button className="employee-corner-profile" onClick={() => setActiveView('profile')} type="button">
            {user?.profilePhoto ? (
              <img src={user.profilePhoto} alt="" />
            ) : (
              <span>{(user?.fullName || 'E').slice(0, 1).toUpperCase()}</span>
            )}
          </button>
        </div>

        {activeView === 'overview' && (
          <header className="employee-workspace-hero">
            <div>
              <p className="eyebrow">{activeView}</p>
              <h1>Welcome, {user?.fullName || 'Employee'}</h1>
              <p>{company?.description || 'Track attendance, request leave, and keep your employee details up to date.'}</p>
            </div>
            <button className="employee-edit-button" onClick={() => setActiveView('profile')} type="button">
              <i className={`bi ${isAdminPreview ? 'bi-person-vcard-fill' : 'bi-pencil-square'}`} aria-hidden="true"></i>
              {isAdminPreview ? 'View Profile' : 'Edit Profile'}
            </button>
          </header>
        )}

        {error && <p className="employee-error">{error}</p>}

        {activeView === 'overview' && (
          <>
            <div className="employee-stat-grid">
              {dashboardStats.map(([icon, label, value, detail]) => (
                <article className="employee-stat-card" key={label}>
                  <i className={`bi ${icon}`} aria-hidden="true"></i>
                  <span>{label}</span>
                  <strong>{value}</strong>
                  <p>{detail}</p>
                </article>
              ))}
            </div>

            <div className="employee-content-grid">
              <article className="employee-panel">
                <div className="panel-heading">
                  <h2>Today Attendance</h2>
                  <span>{activeAttendance ? 'Logged In' : (todayAttendance && todayAttendance.status === 'checked-out' ? 'Completed' : 'Logged Out')}</span>
                </div>
                <div className="attendance-action-card">
                  <i className={`bi ${activeAttendance ? 'bi-box-arrow-in-right' : 'bi-box-arrow-left'}`} aria-hidden="true"></i>
                  <div>
                    <strong>{todayAttendance ? formatTime(todayAttendance.loginAt) : 'No login yet'}</strong>
                    <span>Login time</span>
                  </div>
                  <div>
                    <strong>{todayAttendance ? formatTime(todayAttendance.logoutAt) : 'Pending'}</strong>
                    <span>Logout time</span>
                  </div>
                  {isAdminPreview ? (
                    <span className="employee-read-only-label">Read only</span>
                  ) : activeAttendance ? (
                    <button disabled={savingAttendance} onClick={() => openAttendanceCamera('logout')} type="button">Logout</button>
                  ) : todayAttendance && todayAttendance.status === 'checked-out' ? (
                    <button disabled type="button">Completed</button>
                  ) : (
                    <button disabled={savingAttendance} onClick={() => openAttendanceCamera('login')} type="button">Login</button>
                  )}
                </div>
              </article>

              <article className="employee-panel">
                <div className="panel-heading">
                  <h2>Latest Leaves</h2>
                  <span>{loading ? 'Loading' : `${leaves.length} Total`}</span>
                </div>
                <div className="employee-leave-list">
                  {leaves.slice(0, 4).map((leave) => (
                    <div className="employee-leave-row" key={leave._id}>
                      <i className="bi bi-calendar-event-fill" aria-hidden="true"></i>
                      <div>
                        <strong>{leave.type}</strong>
                        <span>{formatDate(leave.fromDate)} to {formatDate(leave.toDate)}</span>
                      </div>
                      <b>{leave.status}</b>
                    </div>
                  ))}
                  {!leaves.length && <p className="empty-state">Your leave requests will appear here.</p>}
                </div>
              </article>
            </div>
          </>
        )}

        {activeView === 'attendance' && (
          <article className="employee-panel">
            <div className="panel-heading">
              <h2>Attendance</h2>
              <span>{activeAttendance ? 'Active Session' : (todayAttendance && todayAttendance.status === 'checked-out' ? 'Completed' : 'Ready')}</span>
            </div>
            <div className="attendance-action-card">
              <i className="bi bi-clock-history" aria-hidden="true"></i>
              <div>
                <strong>{activeAttendance ? formatTime(activeAttendance.loginAt) : (todayAttendance && todayAttendance.status === 'checked-out' ? 'Checked out' : 'Start your day')}</strong>
                <span>{activeAttendance ? 'Current login' : (todayAttendance && todayAttendance.status === 'checked-out' ? 'Session completed' : 'Attendance login')}</span>
              </div>
              {isAdminPreview ? (
                <span className="employee-read-only-label">Read only</span>
              ) : activeAttendance ? (
                <button disabled={savingAttendance} onClick={() => openAttendanceCamera('logout')} type="button">Logout</button>
              ) : todayAttendance && todayAttendance.status === 'checked-out' ? (
                <button disabled type="button">Completed</button>
              ) : (
                <button disabled={savingAttendance} onClick={() => openAttendanceCamera('login')} type="button">Login</button>
              )}
            </div>
            <div className="attendance-table-wrap">
              <table className="attendance-history-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Login Time</th>
                    <th>Login Photo</th>
                    <th>Logout Time</th>
                    <th>Logout Photo</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {attendance.map((entry) => (
                    <tr key={entry._id}>
                      <td>{formatDate(entry.loginAt)}</td>
                      <td>{formatTime(entry.loginAt)}</td>
                      <td>
                        {entry.loginPhoto ? <img src={entry.loginPhoto} alt="" /> : <span>No photo</span>}
                      </td>
                      <td>{formatTime(entry.logoutAt)}</td>
                      <td>
                        {entry.logoutPhoto ? <img src={entry.logoutPhoto} alt="" /> : <span>Pending</span>}
                      </td>
                      <td><b>{entry.status}</b></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!attendance.length && <p className="empty-state">No attendance records yet.</p>}
            </div>
          </article>
        )}

        {activeView === 'leaves' && (
          <>
          <div className="employee-leave-balance-grid">
            <article><i className="bi bi-calendar2-week-fill"></i><span>Annual allowance</span><strong>{annualLeaveAllowance}</strong><small>days this year</small></article>
            <article><i className="bi bi-calendar2-check-fill"></i><span>Used leave</span><strong>{usedLeaveDays}</strong><small>approved days</small></article>
            <article className="remaining"><i className="bi bi-calendar2-heart-fill"></i><span>Remaining leave</span><strong>{remainingLeaveDays}</strong><small>{pendingLeaveDays} pending day{pendingLeaveDays === 1 ? '' : 's'} reserved</small></article>
          </div>
          <section className="admin-content-grid">
            <article className="employee-panel">
              <div className="panel-heading">
                <h2>{isAdminPreview ? 'Leave Access' : 'Request Leave'}</h2>
                <span>{isAdminPreview ? 'Read Only' : (savingLeave ? 'Submitting' : 'Employee')}</span>
              </div>
              {isAdminPreview ? (
                <p className="empty-state">Return to the admin dashboard to manage this employee's leave requests.</p>
              ) : (
                <form className="employee-profile-form" onSubmit={handleLeaveSubmit}>
                  <select name="type" value={leaveForm.type} onChange={handleLeaveChange}>
                    <option value="casual">Casual Leave</option>
                    <option value="sick">Sick Leave</option>
                    <option value="earned">Earned Leave</option>
                    <option value="unpaid">Unpaid Leave</option>
                    <option value="other">Other</option>
                  </select>
                  <label>
                    <span>From date</span>
                    <input name="fromDate" type="date" value={leaveForm.fromDate} onChange={handleLeaveChange} required />
                  </label>
                  <label>
                    <span>To date</span>
                    <input name="toDate" type="date" value={leaveForm.toDate} onChange={handleLeaveChange} required />
                  </label>
                  <textarea className="span-2" name="reason" placeholder="Reason" value={leaveForm.reason} onChange={handleLeaveChange} required></textarea>
                  {requestedLeaveDays > 0 && leaveForm.type !== 'unpaid' && (
                    <p className="leave-request-preview span-2">
                      Requesting {requestedLeaveDays} day{requestedLeaveDays === 1 ? '' : 's'} from {remainingLeaveDays} available.
                    </p>
                  )}
                  <button className="primary-btn span-2" disabled={savingLeave || (leaveForm.type !== 'unpaid' && requestedLeaveDays > remainingLeaveDays)} type="submit">
                    {savingLeave ? 'Submitting...' : 'Submit Leave'}
                  </button>
                </form>
              )}
            </article>

            <article className="employee-panel">
              <div className="panel-heading">
                <h2>Leave History</h2>
                <span>{leaves.length} Total</span>
              </div>
              <div className="employee-leave-list">
                {leaves.map((leave) => (
                  <div className="employee-leave-row" key={leave._id}>
                    <i className="bi bi-calendar-event-fill" aria-hidden="true"></i>
                    <div>
                      <strong>{leave.type}</strong>
                      <span>{formatDate(leave.fromDate)} to {formatDate(leave.toDate)}</span>
                      <small>{leave.reason}</small>
                    </div>
                    <b>{leave.status}</b>
                  </div>
                ))}
                {!leaves.length && <p className="empty-state">Submitted leave requests will appear here.</p>}
              </div>
            </article>
          </section>
          </>
        )}

        {activeView === 'meetings' && (
          <article className="employee-panel">
            <div className="panel-heading"><h2>Management Meetings</h2><span>{meetings.length} Messages</span></div>
            <div className="dashboard-meeting-grid employee-meeting-grid">
              {meetings.map((meeting) => (
                <article key={meeting._id}>
                  <div className="dashboard-meeting-date"><strong>{new Date(meeting.meetingDate).getDate()}</strong><span>{new Date(meeting.meetingDate).toLocaleString([], { month: 'short' })}</span></div>
                  <div><span className="meeting-recipient-badge">From Management</span><h3>{meeting.title}</h3><p>{meeting.message}</p><small><i className="bi bi-clock-fill"></i> {meeting.meetingTime} · {meeting.durationMinutes} minutes</small>{meeting.meetingLink && <a href={meeting.meetingLink} rel="noreferrer" target="_blank">Join meeting</a>}</div>
                </article>
              ))}
              {!meetings.length && <p className="empty-state">Management meeting messages will appear here.</p>}
            </div>
          </article>
        )}

        {activeView === 'profile' && (
          <article className="employee-panel">
            <div className="panel-heading">
              <h2>{isAdminPreview ? 'Employee Profile' : 'Edit Profile'}</h2>
              <span>{isAdminPreview ? 'Read Only' : (savingProfile ? 'Saving' : 'Editable')}</span>
            </div>
            <div className="employee-employment-summary">
              <div><span>Experience</span><strong>{user?.experienceType === 'experienced' ? `${user.experienceYears || 0} years` : 'Fresher'}</strong></div>
              <div><span>Previous company</span><strong>{user?.previousCompanyName || 'Not applicable'}</strong></div>
              <div><span>Annual leave</span><strong>{annualLeaveAllowance} days</strong></div>
              <div><span>Leave remaining</span><strong>{remainingLeaveDays} days</strong></div>
            </div>
            {user?.experienceType === 'experienced' && user.previousCompanyPayslips?.length > 0 && (
              <div className="employee-payslip-links">
                <span>Previous company payslips</span>
                {user.previousCompanyPayslips.map((payslip) => (
                  <a download={payslip.fileName || 'payslip'} href={payslip.data} key={payslip._id || payslip.fileName}>
                    <i className="bi bi-file-earmark-arrow-down-fill"></i>{payslip.label || payslip.fileName}
                  </a>
                ))}
              </div>
            )}
            <form className="employee-profile-form" onSubmit={handleProfileSave}>
              <input disabled={isAdminPreview} name="fullName" placeholder="Full name" value={profileForm.fullName} onChange={handleProfileChange} />
              <input disabled={isAdminPreview} name="phone" placeholder="Phone" value={profileForm.phone} onChange={handleProfileChange} />
              <input disabled={isAdminPreview} name="employeeId" placeholder="Employee ID" value={profileForm.employeeId} onChange={handleProfileChange} />
              <input disabled={isAdminPreview} name="department" placeholder="Department" value={profileForm.department} onChange={handleProfileChange} />
              <input disabled={isAdminPreview} name="designation" placeholder="Designation" value={profileForm.designation} onChange={handleProfileChange} />
              <input disabled={isAdminPreview} name="linkedIn" placeholder="LinkedIn URL" value={profileForm.linkedIn} onChange={handleProfileChange} />
              <input className="span-2" disabled={isAdminPreview} name="skills" placeholder="Skills, comma separated" value={profileForm.skills} onChange={handleProfileChange} />
              <textarea disabled={isAdminPreview} name="address" placeholder="Address" value={profileForm.address} onChange={handleProfileChange}></textarea>
              <textarea disabled={isAdminPreview} name="bio" placeholder="Short bio" value={profileForm.bio} onChange={handleProfileChange}></textarea>
              {!isAdminPreview && (
                <button className="primary-btn span-2" disabled={savingProfile} type="submit">
                  {savingProfile ? 'Saving Profile...' : 'Save Profile'}
                </button>
              )}
            </form>
          </article>
        )}

        {activeView === 'company' && (
          <article className="employee-panel company-preview">
            <div className="panel-heading">
              <h2>Company</h2>
              <span>{company?.industry || 'Technology'}</span>
            </div>
            <i className="bi bi-building-fill" aria-hidden="true"></i>
            <h3>{company?.name || 'Mizen Tech Solutions'}</h3>
            <p>{company?.description || 'Company details will appear here after admin updates them.'}</p>
            <div>
              <span>{company?.email || 'Mizentechsolutions@gmail.com'}</span>
              <span>{company?.phone || '+91 94809 49103'}</span>
              <span>{company?.website || 'Website not added'}</span>
            </div>
          </article>
        )}
      </section>

      {cameraAction && (
        <div className="attendance-camera-modal" role="dialog" aria-modal="true">
          <div className="attendance-camera-card">
            <div className="panel-heading">
              <h2>{cameraAction === 'login' ? 'Login Photo' : 'Logout Photo'}</h2>
              <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <video ref={videoRef} autoPlay muted playsInline></video>
            <div className="attendance-camera-actions">
              <button onClick={closeAttendanceCamera} type="button">Cancel</button>
              <button disabled={savingAttendance} onClick={captureAttendancePhoto} type="button">
                {savingAttendance ? 'Saving...' : 'Capture Photo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

export default EmployeeDashboard
