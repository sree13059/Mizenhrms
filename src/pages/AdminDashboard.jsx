import { Link, useNavigate } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { apiRequest, authStorage, optionalApiRequest } from '../api'
import logo from '../assets/images/logo.jpg'
import { WEBSITE_URL } from '../config'

const sidebarItems = [
  ['dashboard', 'bi-grid-1x2-fill', 'Dashboard'],
  ['registers', 'bi-people-fill', 'Registers'],
  ['employee-register', 'bi-person-plus-fill', 'Employee Register'],
  ['employees', 'bi-person-badge-fill', 'Employees'],
  ['leaves', 'bi-calendar2-check-fill', 'Leaves'],
  ['attendance', 'bi-clock-history', 'Attendance'],
  ['meetings', 'bi-camera-video-fill', 'Meetings'],
  ['jobs', 'bi-briefcase-fill', 'Jobs'],
  ['applications', 'bi-file-earmark-person-fill', 'Applications'],
  ['projects', 'bi-kanban-fill', 'Projects'],
  ['company', 'bi-building-fill', 'Company Data'],
  ['departments', 'bi-diagram-3-fill', 'Departments'],
  ['services', 'bi-layers-fill', 'Services'],
  ['reports', 'bi-graph-up-arrow', 'Reports'],
  ['settings', 'bi-gear-fill', 'Settings'],
]

const emptySummary = {
  totalRegisters: 0,
  employees: 0,
  admins: 0,
  openJobs: 0,
  activeProjects: 0,
  completedProjects: 0,
  jobApplications: 0,
  pendingLeaves: 0,
  todayAttendance: 0,
}

const getErrorMessage = (error) => error?.message || 'Request failed'
const emptyServiceForm = {
  title: '',
  badge: '',
  image: '',
  front: '',
  back: '',
  details: '',
  status: 'active',
  order: 0,
}

const emptyEmployeeForm = {
  fullName: '',
  email: '',
  phone: '',
  employeeId: '',
  department: '',
  designation: '',
  profilePhoto: '',
  annualLeaveAllowance: 20,
  experienceType: 'fresher',
  experienceYears: '',
  previousCompanyName: '',
  previousDesignation: '',
  previousCompanyFrom: '',
  previousCompanyTo: '',
  previousCompanyDetails: '',
  previousCompanyPayslips: [null, null, null],
  password: '',
  confirmPassword: '',
}

const emptyEmployeeEditForm = {
  fullName: '',
  email: '',
  phone: '',
  employeeId: '',
  department: '',
  designation: '',
  profilePhoto: '',
  annualLeaveAllowance: 20,
  experienceType: 'fresher',
  experienceYears: '',
  previousCompanyName: '',
  previousDesignation: '',
  previousCompanyFrom: '',
  previousCompanyTo: '',
  previousCompanyDetails: '',
  previousCompanyPayslips: [null, null, null],
  password: '',
  confirmPassword: '',
}

const emptyRegisterForm = {
  role: 'employee',
  fullName: '',
  email: '',
  phone: '',
  employeeId: '',
  department: '',
  designation: '',
  adminCode: '',
  companySize: '',
  industry: '',
  password: '',
  confirmPassword: '',
}

const emptyApplicationForm = {
  fullName: '',
  email: '',
  phone: '',
  jobTitle: '',
  experience: '',
  portfolio: '',
  coverLetter: '',
  status: 'new',
}

const readFileAsDataUrl = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

const formatDate = (value) => (value ? new Date(value).toLocaleDateString() : 'Not added')
const formatTime = (value) => (value ? new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Pending')
const getLeaveDays = (leave) => {
  const from = new Date(leave.fromDate)
  const to = new Date(leave.toDate)
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return 0
  return Math.max(1, Math.floor((to - from) / 86400000) + 1)
}
const getEmployeeLeaveBalance = (employee, leaves) => {
  const employeeId = String(employee._id || employee.id)
  const currentYear = new Date().getFullYear()
  const used = leaves
    .filter((leave) => (
      leave.status === 'approved'
      && new Date(leave.fromDate).getFullYear() === currentYear
      && String(leave.employee?._id || leave.employee?.id || leave.employee) === employeeId
    ))
    .reduce((total, leave) => total + getLeaveDays(leave), 0)
  const annual = Number(employee.annualLeaveAllowance) || 20
  return { annual, used, remaining: Math.max(0, annual - used) }
}
const payslipLabels = ['Latest month', 'Previous month', 'Third month']
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024
const getReviewMessage = (application) =>
  `${application.fullName || 'Candidate'} moved to review. Please check the application details before the next step.`

function AdminDashboard() {
  const navigate = useNavigate()
  const storedUser = authStorage.getUser()
  const token = authStorage.getToken()
  const hasFixedFallbackToken = token === 'mizen-fixed-admin'
  const isAdmin = token && !hasFixedFallbackToken && (storedUser?.role === 'admin' || localStorage.getItem('mizenRole') === 'admin')

  const [activeView, setActiveView] = useState('dashboard')
  const [adminUser, setAdminUser] = useState(storedUser)
  const [summary, setSummary] = useState(emptySummary)
  const [registers, setRegisters] = useState([])
  const [employees, setEmployees] = useState([])
  const [jobs, setJobs] = useState([])
  const [applications, setApplications] = useState([])
  const [leaves, setLeaves] = useState([])
  const [attendance, setAttendance] = useState([])
  const [meetings, setMeetings] = useState([])
  const [projects, setProjects] = useState([])
  const [departments, setDepartments] = useState([])
  const [services, setServices] = useState([])
  const [company, setCompany] = useState(null)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(Boolean(isAdmin))
  const [savingProfilePhoto, setSavingProfilePhoto] = useState(false)
  const [savingAdminAttendance, setSavingAdminAttendance] = useState(false)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [error, setError] = useState('')
  const [applicationNotice, setApplicationNotice] = useState('')
  const [notifyingApplicationId, setNotifyingApplicationId] = useState('')
  const [editingRegisterId, setEditingRegisterId] = useState('')
  const [registerForm, setRegisterForm] = useState(emptyRegisterForm)
  const [editingApplicationId, setEditingApplicationId] = useState('')
  const [applicationForm, setApplicationForm] = useState(emptyApplicationForm)
  const [employeeForm, setEmployeeForm] = useState(emptyEmployeeForm)
  const [employeeEditForm, setEmployeeEditForm] = useState(emptyEmployeeEditForm)
  const [editingEmployeeId, setEditingEmployeeId] = useState('')
  const [creatingEmployee, setCreatingEmployee] = useState(false)
  const [employeeNotice, setEmployeeNotice] = useState('')
  const [jobForm, setJobForm] = useState({
    title: '',
    department: '',
    location: '',
    type: 'Full Time',
    salary: '',
    experience: '',
    skills: '',
    openings: 1,
    description: '',
    applicationEmail: 'Mizentechsolutions@gmail.com',
  })
  const [projectForm, setProjectForm] = useState({
    name: '',
    client: '',
    status: 'active',
    progress: 0,
    budget: '',
    deadline: '',
    description: '',
  })
  const [companyForm, setCompanyForm] = useState({
    name: 'Mizen Tech Solutions',
    email: 'Mizentechsolutions@gmail.com',
    phone: '+91 94809 49103',
    address: '',
    website: '',
    industry: 'Technology Services',
    description: '',
  })
  const [departmentForm, setDepartmentForm] = useState({
    name: '',
    description: '',
  })
  const [editingDepartmentId, setEditingDepartmentId] = useState('')
  const [serviceForm, setServiceForm] = useState(emptyServiceForm)
  const [editingServiceId, setEditingServiceId] = useState('')

  const fetchAdminData = async () => {
    const requests = [
      ['summary', 'Summary', apiRequest('/admin/summary')],
      ['registers', 'Registers', apiRequest('/admin/users')],
      ['employees', 'Employees', apiRequest('/admin/employees')],
      ['jobs', 'Jobs', apiRequest('/admin/jobs')],
      ['applications', 'Applications', apiRequest('/admin/applications')],
      ['leaves', 'Leaves', apiRequest('/admin/leaves')],
      ['attendance', 'Attendance', apiRequest('/admin/attendance')],
      ['meetings', 'Meetings', optionalApiRequest('/admin/meetings', { meetings: [] })],
      ['projects', 'Projects', apiRequest('/admin/projects')],
      ['departments', 'Departments', apiRequest('/admin/departments')],
      ['services', 'Services', apiRequest('/admin/services')],
      ['company', 'Company', apiRequest('/admin/company')],
    ]

    const results = await Promise.allSettled(requests.map(([, , request]) => request))
    const failed = []
    const data = {
      summary: emptySummary,
      registers: [],
      employees: [],
      jobs: [],
      applications: [],
      leaves: [],
      attendance: [],
      meetings: [],
      projects: [],
      departments: [],
      services: [],
      company: null,
      error: '',
    }

    results.forEach((result, index) => {
      const [key, label] = requests[index]

      if (result.status === 'rejected') {
        failed.push(`${label}: ${getErrorMessage(result.reason)}`)
        return
      }

      const value = result.value

      if (key === 'summary') data.summary = value.summary || emptySummary
      if (key === 'registers') data.registers = value.users || []
      if (key === 'employees') data.employees = value.employees || []
      if (key === 'jobs') data.jobs = value.jobs || []
      if (key === 'applications') data.applications = value.applications || []
      if (key === 'leaves') data.leaves = value.leaves || []
      if (key === 'attendance') data.attendance = value.attendance || []
      if (key === 'meetings') data.meetings = value.meetings || []
      if (key === 'projects') data.projects = value.projects || []
      if (key === 'departments') data.departments = value.departments || []
      if (key === 'services') data.services = value.services || []
      if (key === 'company') data.company = value.company || null
    })

    if (failed.length === requests.length) {
      throw new Error(failed[0] || 'Failed to load admin dashboard')
    }

    data.error = failed.length ? `Some dashboard data could not load. ${failed.join('; ')}` : ''
    return data
  }

  const applyAdminData = (data) => {
    setSummary(data.summary)
    setRegisters(data.registers)
    setEmployees(data.employees)
    setJobs(data.jobs)
    setApplications(data.applications)
    setLeaves(data.leaves)
    setAttendance(data.attendance)
    setMeetings(data.meetings)
    setProjects(data.projects)
    setDepartments(data.departments)
    setServices(data.services)
    setCompany(data.company)
    if (data.company) {
      setCompanyForm({
        name: data.company.name || '',
        email: data.company.email || '',
        phone: data.company.phone || '',
        address: data.company.address || '',
        website: data.company.website || '',
        industry: data.company.industry || '',
        description: data.company.description || '',
      })
    }
  }

  const loadAdminData = async () => {
    try {
      setLoading(true)
      setError('')

      const data = await fetchAdminData()
      applyAdminData(data)
      setError(data.error)
    } catch (err) {
      setError(err.message || 'Failed to load admin dashboard')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (hasFixedFallbackToken) {
      authStorage.clearSession()
      navigate('/login')
      return undefined
    }

    if (!isAdmin) return undefined

    let isActive = true

    fetchAdminData()
      .then((data) => {
        if (isActive) {
          applyAdminData(data)
          setError(data.error)
        }
      })
      .catch((err) => {
        if (isActive) {
          setError(err.message || 'Failed to load admin dashboard')
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
  }, [hasFixedFallbackToken, isAdmin, navigate])

  const filteredRegisters = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return registers

    return registers.filter((item) =>
      [item.fullName, item.email, item.phone, item.role, item.department, item.designation, item.employeeId]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(query)),
    )
  }, [registers, search])

  const registerDepartmentCounts = useMemo(() => {
    const counts = registers.reduce((acc, item) => {
      const department = item.department || item.industry || 'Unassigned'
      acc[department] = (acc[department] || 0) + 1
      return acc
    }, {})

    return counts
  }, [registers])

  const nextEmployeeId = useMemo(() => {
    const highestId = employees.reduce((highest, employee) => {
      const match = String(employee.employeeId || '').match(/^EMP(\d+)$/i)
      return match ? Math.max(highest, Number(match[1])) : highest
    }, 0)
    return `EMP${String(highestId + 1).padStart(3, '0')}`
  }, [employees])
  const activeAdminAttendance = useMemo(() => attendance.find((entry) => (
    entry.status === 'checked-in'
    && String(entry.employee?._id || entry.employee?.id || entry.employee) === String(adminUser?.id || adminUser?._id)
  )), [adminUser, attendance])

  const handleLogout = () => {
    authStorage.clearSession()
    navigate('/login')
  }

  const handleAdminAttendance = async () => {
    try {
      setSavingAdminAttendance(true)
      setError('')
      await apiRequest(activeAdminAttendance ? '/admin/attendance/logout' : '/admin/attendance/login', {
        method: activeAdminAttendance ? 'PUT' : 'POST',
        body: JSON.stringify({}),
      })
      await loadAdminData()
    } catch (requestError) {
      setError(requestError.message || 'Failed to update admin attendance')
    } finally {
      setSavingAdminAttendance(false)
    }
  }

  const handleJobChange = (event) => {
    setJobForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }))
  }

  const handleProjectChange = (event) => {
    setProjectForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }))
  }

  const handleCompanyChange = (event) => {
    setCompanyForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }))
  }

  const handleDepartmentChange = (event) => {
    setDepartmentForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }))
  }

  const handleRegisterChange = (event) => {
    setRegisterForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }))
  }

  const handleEmployeeChange = (event) => {
    const { name, value } = event.currentTarget
    setEmployeeForm((current) => ({
      ...current,
      [name]: name === 'employeeId' ? value.toUpperCase() : name === 'phone' ? value.replace(/\D/g, '').slice(0, 10) : value,
      ...(name === 'experienceType' && value === 'fresher'
        ? {
            experienceYears: '',
            previousCompanyName: '',
            previousDesignation: '',
            previousCompanyFrom: '',
            previousCompanyTo: '',
            previousCompanyDetails: '',
            previousCompanyPayslips: [null, null, null],
          }
        : {}),
    }))
    setEmployeeNotice('')
  }

  const handleEmployeeEditChange = (event) => {
    const { name, value } = event.currentTarget
    setEmployeeEditForm((current) => ({
      ...current,
      [name]: name === 'employeeId' ? value.toUpperCase() : name === 'phone' ? value.replace(/\D/g, '').slice(0, 10) : value,
    }))
  }

  const handleEmployeePhoto = async (event, editing = false) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      setError('Employee photo must be 10 MB or smaller')
      event.target.value = ''
      return
    }

    try {
      const profilePhoto = await readFileAsDataUrl(file)
      const update = (current) => ({ ...current, profilePhoto })
      if (editing) setEmployeeEditForm(update)
      else setEmployeeForm(update)
      setError('')
    } catch {
      setError('Unable to read the employee photo')
    }
  }

  const handlePayslipUpload = async (event, index, editing = false) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (file.size > 700 * 1024) {
      setError('Each payslip must be 700 KB or smaller')
      event.target.value = ''
      return
    }

    try {
      const data = await readFileAsDataUrl(file)
      const update = (current) => {
        const previousCompanyPayslips = [...current.previousCompanyPayslips]
        previousCompanyPayslips[index] = {
          label: payslipLabels[index],
          fileName: file.name,
          mimeType: file.type,
          data,
        }
        return { ...current, previousCompanyPayslips }
      }
      if (editing) setEmployeeEditForm(update)
      else setEmployeeForm(update)
      setError('')
    } catch {
      setError('Unable to read the selected payslip')
    }
  }

  const handleApplicationEditChange = (event) => {
    setApplicationForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }))
  }

  const handleServiceChange = (event) => {
    setServiceForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }))
  }

  const handleProfilePhotoSelect = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      setError('Profile photo must be 10 MB or smaller')
      return
    }

    try {
      setSavingProfilePhoto(true)
      setError('')
      const profilePhoto = await readFileAsDataUrl(file)
      const data = await apiRequest('/auth/me', {
        method: 'PUT',
        body: JSON.stringify({ profilePhoto }),
      })
      setAdminUser(data.user)
      authStorage.setSession(authStorage.getToken(), data.user)
      setProfileMenuOpen(false)
    } catch (err) {
      setError(err.message || 'Failed to update profile photo')
    } finally {
      setSavingProfilePhoto(false)
    }
  }

  const handleEditApplication = (application) => {
    setEditingApplicationId(application._id)
    setApplicationNotice('')
    setApplicationForm({
      fullName: application.fullName || '',
      email: application.email || '',
      phone: application.phone || '',
      jobTitle: application.jobTitle || '',
      experience: application.experience || '',
      portfolio: application.portfolio || '',
      coverLetter: application.coverLetter || '',
      status: application.status || 'new',
    })
    setActiveView('applications')
  }

  const handleCancelApplicationEdit = () => {
    setEditingApplicationId('')
    setApplicationForm(emptyApplicationForm)
  }

  const handleSaveApplication = async (event) => {
    event.preventDefault()
    if (!editingApplicationId) return

    try {
      setError('')
      setApplicationNotice('')
      await apiRequest(`/admin/applications/${editingApplicationId}`, {
        method: 'PUT',
        body: JSON.stringify(applicationForm),
      })
      handleCancelApplicationEdit()
      await loadAdminData()
      setApplicationNotice('Application updated successfully.')
    } catch (err) {
      setError(err.message || 'Failed to update application')
    }
  }

  const handleEditRegister = (user) => {
    setEditingRegisterId(user._id)
    setRegisterForm({
      role: user.role || 'employee',
      fullName: user.fullName || '',
      email: user.email || '',
      phone: user.phone || '',
      employeeId: user.employeeId || '',
      department: user.department || '',
      designation: user.designation || '',
      adminCode: user.adminCode || '',
      companySize: user.companySize || '',
      industry: user.industry || '',
      password: '',
      confirmPassword: '',
    })
    setActiveView('registers')
  }

  const handleCancelRegisterEdit = () => {
    setEditingRegisterId('')
    setRegisterForm(emptyRegisterForm)
  }

  const handleSaveRegister = async (event) => {
    event.preventDefault()
    if (!editingRegisterId) return

    try {
      setError('')
      await apiRequest(`/admin/users/${editingRegisterId}`, {
        method: 'PUT',
        body: JSON.stringify(registerForm),
      })
      handleCancelRegisterEdit()
      await loadAdminData()
    } catch (err) {
      setError(err.message || 'Failed to update register')
    }
  }

  const handleDeleteRegister = async (userId) => {
    if (!window.confirm('Delete this register?')) return

    try {
      setError('')
      await apiRequest(`/admin/users/${userId}`, {
        method: 'DELETE',
      })
      if (editingRegisterId === userId) {
        handleCancelRegisterEdit()
      }
      await loadAdminData()
    } catch (err) {
      setError(err.message || 'Failed to delete register')
    }
  }

  const handleDeleteApplication = async (applicationId) => {
    if (!window.confirm('Delete this application?')) return

    try {
      setError('')
      setApplicationNotice('')
      await apiRequest(`/admin/applications/${applicationId}`, {
        method: 'DELETE',
      })
      if (editingApplicationId === applicationId) {
        handleCancelApplicationEdit()
      }
      await loadAdminData()
      setApplicationNotice('Application deleted successfully.')
    } catch (err) {
      if (String(err.message || '').includes('404')) {
        setApplications((current) => current.filter((application) => application._id !== applicationId))
        if (editingApplicationId === applicationId) {
          handleCancelApplicationEdit()
        }
        setApplicationNotice('Application removed from this dashboard. Deploy the backend DELETE route to delete it permanently from the database.')
        return
      }

      setError(err.message || 'Failed to delete application')
    }
  }

  const handleApplicationStatus = async (application, status) => {
    try {
      setError('')
      setApplicationNotice('')
      const data = await apiRequest(`/admin/applications/${application._id}`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      })
      await loadAdminData()
      const updatedApplication = data.application || { ...application, status }

      if (status === 'reviewing') {
        setApplicationNotice(getReviewMessage(updatedApplication))
      }

      if (status === 'shortlisted') {
        setApplicationNotice(data.emailNotification?.sent
          ? `${updatedApplication.fullName || 'Candidate'} was shortlisted and the email was sent to ${updatedApplication.email}.`
          : `${updatedApplication.fullName || 'Candidate'} was shortlisted. Email not sent: ${data.emailNotification?.reason || 'SMTP is not configured'}.`)
      }

      if (status === 'rejected') {
        setApplicationNotice(data.emailNotification?.sent
          ? `${updatedApplication.fullName || 'Candidate'} was rejected and the email was sent to ${updatedApplication.email}.`
          : `${updatedApplication.fullName || 'Candidate'} was rejected. Email not sent: ${data.emailNotification?.reason || 'SMTP is not configured'}.`)
      }
    } catch (err) {
      setError(err.message || 'Failed to update application')
    }
  }

  const handleApplicationEmailRetry = async (application) => {
    try {
      setError('')
      setApplicationNotice('')
      setNotifyingApplicationId(application._id)
      const data = await apiRequest(`/admin/applications/${application._id}/notify`, {
        method: 'POST',
      })

      setApplicationNotice(data.emailNotification?.sent
        ? `Email sent to ${application.email}.`
        : `Email not sent: ${data.emailNotification?.reason || 'SMTP delivery failed'}.`)
    } catch (err) {
      setApplicationNotice(`Email not sent: ${err.message || 'SMTP delivery failed'}.`)
    } finally {
      setNotifyingApplicationId('')
    }
  }

  const handleLeaveStatus = async (leaveId, status) => {
    try {
      setError('')
      await apiRequest(`/admin/leaves/${leaveId}`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      })
      await loadAdminData()
    } catch (err) {
      setError(err.message || 'Failed to update leave request')
    }
  }

  const handleCreateEmployee = async (event) => {
    event.preventDefault()

    try {
      setCreatingEmployee(true)
      setError('')
      setEmployeeNotice('')
      await apiRequest('/admin/employees', {
        method: 'POST',
        body: JSON.stringify({
          ...employeeForm,
          employeeId: employeeForm.employeeId || nextEmployeeId,
          previousCompanyPayslips: employeeForm.previousCompanyPayslips.filter(Boolean),
        }),
      })
      setEmployeeForm({ ...emptyEmployeeForm, previousCompanyPayslips: [null, null, null] })
      setEmployeeNotice(`${employeeForm.fullName} was registered successfully.`)
      await loadAdminData()
    } catch (err) {
      setError(err.message || 'Failed to register employee')
    } finally {
      setCreatingEmployee(false)
    }
  }

  const handleEditEmployee = (employee) => {
    setEditingEmployeeId(employee._id)
    setEmployeeEditForm({
      fullName: employee.fullName || '',
      email: employee.email || '',
      phone: employee.phone || '',
      employeeId: employee.employeeId || '',
      department: employee.department || '',
      designation: employee.designation || '',
      profilePhoto: employee.profilePhoto || '',
      annualLeaveAllowance: employee.annualLeaveAllowance || 20,
      experienceType: employee.experienceType || 'fresher',
      experienceYears: employee.experienceYears || '',
      previousCompanyName: employee.previousCompanyName || '',
      previousDesignation: employee.previousDesignation || '',
      previousCompanyFrom: employee.previousCompanyFrom?.slice(0, 10) || '',
      previousCompanyTo: employee.previousCompanyTo?.slice(0, 10) || '',
      previousCompanyDetails: employee.previousCompanyDetails || '',
      previousCompanyPayslips: [0, 1, 2].map((index) => employee.previousCompanyPayslips?.[index] || null),
      password: '',
      confirmPassword: '',
    })
    setActiveView('employees')
  }

  const handleOpenEmployeeDashboard = (employee) => {
    navigate(`/employee?employeeId=${encodeURIComponent(employee._id)}`)
  }

  const handleEmployeeCardKeyDown = (event, employee) => {
    if (event.target !== event.currentTarget) return

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      handleOpenEmployeeDashboard(employee)
    }
  }

  const handleCancelEmployeeEdit = () => {
    setEditingEmployeeId('')
    setEmployeeEditForm(emptyEmployeeEditForm)
  }

  const handleSaveEmployee = async (event) => {
    event.preventDefault()
    if (!editingEmployeeId) return

    try {
      setError('')
      await apiRequest(`/admin/employees/${editingEmployeeId}`, {
        method: 'PUT',
        body: JSON.stringify(employeeEditForm),
      })
      handleCancelEmployeeEdit()
      await loadAdminData()
    } catch (err) {
      setError(err.message || 'Failed to update employee')
    }
  }

  const handleDeleteEmployee = async (employeeId) => {
    if (!window.confirm('Delete this employee?')) return

    try {
      setError('')
      await apiRequest(`/admin/employees/${employeeId}`, {
        method: 'DELETE',
      })
      if (editingEmployeeId === employeeId) {
        handleCancelEmployeeEdit()
      }
      await loadAdminData()
    } catch (err) {
      setError(err.message || 'Failed to delete employee')
    }
  }

  const handleCreateDepartment = async (event) => {
    event.preventDefault()

    try {
      setError('')
      await apiRequest(editingDepartmentId ? `/admin/departments/${editingDepartmentId}` : '/admin/departments', {
        method: editingDepartmentId ? 'PUT' : 'POST',
        body: JSON.stringify(departmentForm),
      })
      setDepartmentForm({ name: '', description: '' })
      setEditingDepartmentId('')
      await loadAdminData()
    } catch (err) {
      setError(err.message || 'Failed to save department')
    }
  }

  const handleEditDepartment = (department) => {
    if (department.derived || String(department._id).startsWith('derived-')) return
    setEditingDepartmentId(department._id)
    setDepartmentForm({
      name: department.name || '',
      description: department.description || '',
    })
    setActiveView('departments')
  }

  const handleCancelDepartmentEdit = () => {
    setEditingDepartmentId('')
    setDepartmentForm({ name: '', description: '' })
  }

  const handleDeleteDepartment = async (departmentId) => {
    if (String(departmentId).startsWith('derived-')) return

    try {
      setError('')
      await apiRequest(`/admin/departments/${departmentId}`, {
        method: 'DELETE',
      })
      await loadAdminData()
    } catch (err) {
      setError(err.message || 'Failed to delete department')
    }
  }

  const handleEditService = (service) => {
    setEditingServiceId(service._id)
    setServiceForm({
      title: service.title || '',
      badge: service.badge || '',
      image: service.image || '',
      front: service.front || '',
      back: service.back || '',
      details: (service.details || []).join(', '),
      status: service.status || 'active',
      order: service.order || 0,
    })
    setActiveView('services')
  }

  const handleCancelServiceEdit = () => {
    setEditingServiceId('')
    setServiceForm(emptyServiceForm)
  }

  const handleSaveService = async (event) => {
    event.preventDefault()

    try {
      setError('')
      await apiRequest(editingServiceId ? `/admin/services/${editingServiceId}` : '/admin/services', {
        method: editingServiceId ? 'PUT' : 'POST',
        body: JSON.stringify({
          ...serviceForm,
          order: Number(serviceForm.order) || 0,
        }),
      })
      handleCancelServiceEdit()
      await loadAdminData()
    } catch (err) {
      setError(err.message || 'Failed to save service')
    }
  }

  const handleDeleteService = async (serviceId) => {
    try {
      setError('')
      await apiRequest(`/admin/services/${serviceId}`, {
        method: 'DELETE',
      })
      if (editingServiceId === serviceId) {
        handleCancelServiceEdit()
      }
      await loadAdminData()
    } catch (err) {
      setError(err.message || 'Failed to delete service')
    }
  }

  const handleCreateJob = async (event) => {
    event.preventDefault()

    try {
      setError('')
      await apiRequest('/admin/jobs', {
        method: 'POST',
        body: JSON.stringify({
          ...jobForm,
          openings: Number(jobForm.openings) || 1,
        }),
      })
      setJobForm({
        title: '',
        department: '',
          location: '',
          type: 'Full Time',
          salary: '',
          experience: '',
          skills: '',
          openings: 1,
          description: '',
          applicationEmail: 'Mizentechsolutions@gmail.com',
        })
      await loadAdminData()
      setActiveView('jobs')
    } catch (err) {
      setError(err.message || 'Failed to create job')
    }
  }

  const handleCreateProject = async (event) => {
    event.preventDefault()

    try {
      setError('')
      await apiRequest('/admin/projects', {
        method: 'POST',
        body: JSON.stringify({
          ...projectForm,
          progress: Number(projectForm.progress) || 0,
        }),
      })
      setProjectForm({
        name: '',
        client: '',
        status: 'active',
        progress: 0,
        budget: '',
        deadline: '',
        description: '',
      })
      await loadAdminData()
      setActiveView('projects')
    } catch (err) {
      setError(err.message || 'Failed to create project')
    }
  }

  const handleUpdateCompany = async (event) => {
    event.preventDefault()

    try {
      setError('')
      const data = await apiRequest('/admin/company', {
        method: 'PUT',
        body: JSON.stringify(companyForm),
      })
      setCompany(data.company)
    } catch (err) {
      setError(err.message || 'Failed to update company data')
    }
  }

  if (!isAdmin) {
    return (
      <main className="admin-locked">
        <section>
          <p className="eyebrow">Protected</p>
          <h1>Admin access required</h1>
          <p>Please login with admin credentials to open the dashboard.</p>
          <Link className="primary-btn" to="/login">
            Go to Login
          </Link>
        </section>
      </main>
    )
  }

  const stats = [
    ['Total Registers', summary.totalRegisters, loading ? 'Loading current data' : 'All registered accounts'],
    ['Employees', summary.employees, 'Employee registrations'],
    ['Admins', summary.admins, 'Admin accounts'],
    ['Pending Leaves', summary.pendingLeaves ?? leaves.filter((leave) => leave.status === 'pending').length, 'Employee leave requests'],
    ['Today Attendance', summary.todayAttendance ?? attendance.length, 'Attendance records today'],
    ['Open Jobs', summary.openJobs, 'Active job postings'],
    ['Applications', summary.jobApplications || applications.length, 'Career form submissions'],
    ['Active Projects', summary.activeProjects, 'Planning, active, or review'],
    ['Completed Projects', summary.completedProjects, 'Delivered projects'],
  ]

  return (
    <main className="admin-shell">
      <aside className="admin-sidebar">
        <a className="admin-brand" href={WEBSITE_URL}>
          <img src={logo} alt="Mizen Tech Solutions logo" />
          <span>
            <strong>Mizen</strong>
            <small>Admin Panel</small>
          </span>
        </a>

        <nav className="admin-nav" aria-label="Admin navigation">
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

      </aside>

      <section className="admin-main">
        <header className="admin-topbar">
          <div>
            <p className="eyebrow">{activeView}</p>
            <h1>Admin Dashboard</h1>
          </div>
          <div className="dashboard-top-actions">
            <div className="admin-search">
              <i className="bi bi-search" aria-hidden="true"></i>
              <input
                type="search"
                placeholder="Search registers"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <div className="dashboard-profile-menu">
              <button
                className="dashboard-avatar-button"
                type="button"
                aria-expanded={profileMenuOpen}
                onClick={() => setProfileMenuOpen((current) => !current)}
              >
                {adminUser?.profilePhoto ? (
                  <img src={adminUser.profilePhoto} alt="" />
                ) : (
                  <span>{(adminUser?.fullName || 'A').slice(0, 1).toUpperCase()}</span>
                )}
                <i className="bi bi-chevron-down" aria-hidden="true"></i>
              </button>
              {profileMenuOpen && (
                <div className="dashboard-profile-dropdown">
                  <div className="dropdown-profile-head">
                    <div className="dropdown-avatar">
                      {adminUser?.profilePhoto ? (
                        <img src={adminUser.profilePhoto} alt="" />
                      ) : (
                        <span>{(adminUser?.fullName || 'A').slice(0, 1).toUpperCase()}</span>
                      )}
                    </div>
                    <div>
                      <strong>{adminUser?.fullName || 'Admin'}</strong>
                      <span>{adminUser?.email || 'admin@mizentech.com'}</span>
                    </div>
                  </div>
                  <button
                    className="dropdown-command"
                    onClick={() => {
                      setActiveView('settings')
                      setProfileMenuOpen(false)
                    }}
                    type="button"
                  >
                    <i className="bi bi-pencil-square" aria-hidden="true"></i>
                    Edit Profile
                  </button>
                  <div className="dropdown-upload-group">
                    <span>Edit photo</span>
                    <div className="profile-photo-actions" aria-label="Profile photo options">
                      <label title="Camera">
                        <i className="bi bi-camera-fill" aria-hidden="true"></i>
                        <input accept="image/*" capture="environment" type="file" onChange={handleProfilePhotoSelect} />
                      </label>
                      <label title="Gallery">
                        <i className="bi bi-images" aria-hidden="true"></i>
                        <input accept="image/*" type="file" onChange={handleProfilePhotoSelect} />
                      </label>
                      <label title="Files">
                        <i className="bi bi-folder2-open" aria-hidden="true"></i>
                        <input type="file" onChange={handleProfilePhotoSelect} />
                      </label>
                    </div>
                  </div>
                  <button className="dropdown-command danger" onClick={handleLogout} type="button">
                    <i className="bi bi-box-arrow-right" aria-hidden="true"></i>
                    Logout
                  </button>
                  {savingProfilePhoto && <small>Uploading photo...</small>}
                </div>
              )}
            </div>
          </div>
        </header>

        {error && <p className="admin-error">{error}</p>}

        {activeView === 'dashboard' && (
          <>
            <div className="admin-stat-grid">
              {stats.map(([label, value, detail]) => (
                <article className="admin-stat-card" key={label}>
                  <span>{label}</span>
                  <strong>{value}</strong>
                  <p>{detail}</p>
                </article>
              ))}
            </div>

            <section className="admin-content-grid">
              <article className="admin-panel wide">
                <div className="panel-heading">
                  <h2>Current Registers</h2>
                  <span>{filteredRegisters.length} Records</span>
                </div>
                <div className="register-list compact">
                  {filteredRegisters.slice(0, 6).map((user) => (
                    <div className="register-row" key={user._id}>
                      <b>{user.fullName}</b>
                      <span>{user.email}</span>
                      <em>{user.role}</em>
                    </div>
                  ))}
                </div>
              </article>

              <article className="admin-panel">
                <div className="panel-heading">
                  <h2>Quick Actions</h2>
                </div>
                <div className="quick-actions">
                  <button onClick={() => setActiveView('jobs')} type="button">
                    <i className="bi bi-plus-circle-fill" aria-hidden="true"></i>
                    Add Job
                  </button>
                  <button onClick={() => setActiveView('applications')} type="button">
                    <i className="bi bi-file-earmark-person-fill" aria-hidden="true"></i>
                    View Applications
                  </button>
                  <button onClick={() => setActiveView('employee-register')} type="button">
                    <i className="bi bi-person-plus-fill" aria-hidden="true"></i>
                    Employee Register
                  </button>
                  <button onClick={() => setActiveView('leaves')} type="button">
                    <i className="bi bi-calendar2-check-fill" aria-hidden="true"></i>
                    Review Leaves
                  </button>
                  <button onClick={() => setActiveView('attendance')} type="button">
                    <i className="bi bi-clock-history" aria-hidden="true"></i>
                    Attendance
                  </button>
                  <button onClick={() => setActiveView('projects')} type="button">
                    <i className="bi bi-kanban-fill" aria-hidden="true"></i>
                    Add Project
                  </button>
                  <button onClick={() => setActiveView('services')} type="button">
                    <i className="bi bi-layers-fill" aria-hidden="true"></i>
                    Manage Services
                  </button>
                  <button onClick={() => setActiveView('registers')} type="button">
                    <i className="bi bi-person-lines-fill" aria-hidden="true"></i>
                    View Registers
                  </button>
                  <button onClick={loadAdminData} type="button">
                    <i className="bi bi-arrow-clockwise" aria-hidden="true"></i>
                    Refresh Data
                  </button>
                </div>
              </article>
            </section>
          </>
        )}

        {activeView === 'registers' && (
          <section className="admin-content-grid">
            {editingRegisterId && (
              <article className="admin-panel">
                <div className="panel-heading">
                  <h2>Edit Register</h2>
                  <span>Admin</span>
                </div>
                <form className="job-form" onSubmit={handleSaveRegister}>
                  <select name="role" value={registerForm.role} onChange={handleRegisterChange}>
                    <option value="employee">Employee</option>
                    <option value="admin">Admin</option>
                  </select>
                  <input name="fullName" placeholder="Full name" value={registerForm.fullName} onChange={handleRegisterChange} required />
                  <input name="email" placeholder="Email address" type="email" value={registerForm.email} onChange={handleRegisterChange} required />
                  <input name="phone" placeholder="Phone number" value={registerForm.phone} onChange={handleRegisterChange} required />
                  <input name="employeeId" placeholder="Employee ID" value={registerForm.employeeId} onChange={handleRegisterChange} />
                  <input name="department" placeholder="Department" value={registerForm.department} onChange={handleRegisterChange} />
                  <input name="designation" placeholder="Designation" value={registerForm.designation} onChange={handleRegisterChange} />
                  <input name="adminCode" placeholder="Admin code" value={registerForm.adminCode} onChange={handleRegisterChange} />
                  <input name="companySize" placeholder="Company size" value={registerForm.companySize} onChange={handleRegisterChange} />
                  <input name="industry" placeholder="Industry" value={registerForm.industry} onChange={handleRegisterChange} />
                  <input name="password" placeholder="New password optional" type="password" value={registerForm.password} onChange={handleRegisterChange} />
                  <input name="confirmPassword" placeholder="Confirm new password" type="password" value={registerForm.confirmPassword} onChange={handleRegisterChange} />
                  <button className="primary-btn" type="submit">Update Register</button>
                  <button className="secondary-btn" onClick={handleCancelRegisterEdit} type="button">Cancel Edit</button>
                </form>
              </article>
            )}

            <article className={`admin-panel ${editingRegisterId ? '' : 'wide'}`}>
              <div className="panel-heading">
                <h2>Current Registers Data</h2>
                <span>{filteredRegisters.length} Users</span>
              </div>
              <div className="register-table manage-register-table">
                <div className="register-table-head">
                  <span>Name</span>
                  <span>Role</span>
                  <span>Contact</span>
                  <span>Department</span>
                  <span>Joined</span>
                  <span>Actions</span>
                </div>
                {filteredRegisters.map((user) => (
                  <div className="register-table-row" key={user._id}>
                    <strong>{user.fullName}</strong>
                    <span>{user.role}</span>
                    <span>{user.email || user.phone}</span>
                    <span>{user.department || user.industry || 'Unassigned'}</span>
                    <span>{user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'New'}</span>
                    <div className="admin-row-actions">
                      <button onClick={() => handleEditRegister(user)} title="Edit register" type="button">
                        <i className="bi bi-pencil-square" aria-hidden="true"></i>
                      </button>
                      <button onClick={() => handleDeleteRegister(user._id)} title="Delete register" type="button">
                        <i className="bi bi-trash3" aria-hidden="true"></i>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          </section>
        )}

        {activeView === 'employee-register' && (
          <section className="admin-content-grid employee-onboarding-layout">
            <article className="admin-panel employee-onboarding-panel">
              <div className="employee-onboarding-heading">
                <div>
                  <span className="onboarding-kicker">HR onboarding</span>
                  <h2>Register a New Employee</h2>
                  <p>Create the login, employment record, leave policy, and experience profile in one place.</p>
                </div>
                <div className="onboarding-id-preview">
                  <i className="bi bi-person-vcard-fill" aria-hidden="true"></i>
                  <span>Next employee ID</span>
                  <strong>{nextEmployeeId}</strong>
                </div>
              </div>

              {employeeNotice && <p className="employee-success-note">{employeeNotice}</p>}

              <form className="employee-onboarding-form" onSubmit={handleCreateEmployee}>
                <section className="onboarding-form-section">
                  <div className="onboarding-section-title">
                    <i className="bi bi-person-lines-fill" aria-hidden="true"></i>
                    <div><strong>Personal and job details</strong><span>Required employee identity information</span></div>
                  </div>
                  <div className="employee-photo-field">
                    <label className="employee-photo-upload">
                      {employeeForm.profilePhoto ? (
                        <img src={employeeForm.profilePhoto} alt="Employee preview" />
                      ) : (
                        <i className="bi bi-camera-fill" aria-hidden="true"></i>
                      )}
                      <span>{employeeForm.profilePhoto ? 'Change photo' : 'Upload photo'}</span>
                      <small>JPG or PNG, maximum 10 MB</small>
                      <input accept="image/*" onChange={(event) => handleEmployeePhoto(event)} required={!employeeForm.profilePhoto} type="file" />
                    </label>
                  </div>
                  <div className="onboarding-field-grid">
                    <label><span>Full name *</span><input name="fullName" placeholder="Employee full name" value={employeeForm.fullName} onChange={handleEmployeeChange} required /></label>
                    <label><span>Email address *</span><input name="email" placeholder="name@company.com" type="email" value={employeeForm.email} onChange={handleEmployeeChange} required /></label>
                    <label><span>Phone number *</span><input inputMode="numeric" maxLength="10" minLength="10" name="phone" pattern="[0-9]{10}" placeholder="10-digit phone number" value={employeeForm.phone} onChange={handleEmployeeChange} required /></label>
                    <label>
                      <span>Employee ID *</span>
                      <input minLength="6" name="employeeId" pattern="EMP[0-9]{3,}" placeholder="EMP001" title="Use EMP followed by at least 3 digits, for example EMP001" value={employeeForm.employeeId || nextEmployeeId} onChange={handleEmployeeChange} required />
                      <small>Minimum 6 characters, for example EMP001.</small>
                    </label>
                    <label><span>Department</span><input name="department" placeholder="Engineering" value={employeeForm.department} onChange={handleEmployeeChange} /></label>
                    <label><span>Designation</span><input name="designation" placeholder="Software Engineer" value={employeeForm.designation} onChange={handleEmployeeChange} /></label>
                  </div>
                </section>

                <section className="onboarding-form-section">
                  <div className="onboarding-section-title">
                    <i className="bi bi-calendar2-heart-fill" aria-hidden="true"></i>
                    <div><strong>Annual leave policy</strong><span>Track used and remaining leave automatically</span></div>
                  </div>
                  <div className="leave-policy-editor">
                    <label><span>Leaves allowed per year</span><input max="365" min="1" name="annualLeaveAllowance" type="number" value={employeeForm.annualLeaveAllowance} onChange={handleEmployeeChange} required /></label>
                    <div className="leave-policy-preview"><b>{employeeForm.annualLeaveAllowance || 20}</b><span>days available on joining</span></div>
                  </div>
                </section>

                <section className="onboarding-form-section">
                  <div className="onboarding-section-title">
                    <i className="bi bi-briefcase-fill" aria-hidden="true"></i>
                    <div><strong>Experience</strong><span>Choose fresher or add previous employment records</span></div>
                  </div>
                  <div className="experience-choice" role="group" aria-label="Employee experience type">
                    <button className={employeeForm.experienceType === 'fresher' ? 'active' : ''} name="experienceType" onClick={handleEmployeeChange} type="button" value="fresher"><i className="bi bi-mortarboard-fill"></i> Fresher</button>
                    <button className={employeeForm.experienceType === 'experienced' ? 'active' : ''} name="experienceType" onClick={handleEmployeeChange} type="button" value="experienced"><i className="bi bi-building-check"></i> Experienced</button>
                  </div>

                  {employeeForm.experienceType === 'experienced' && (
                    <div className="experience-details-panel">
                      <div className="onboarding-field-grid">
                        <label><span>Total experience *</span><input max="60" min="0" name="experienceYears" placeholder="Years" step="0.1" type="number" value={employeeForm.experienceYears} onChange={handleEmployeeChange} required /></label>
                        <label><span>Previous company *</span><input name="previousCompanyName" placeholder="Company name" value={employeeForm.previousCompanyName} onChange={handleEmployeeChange} required /></label>
                        <label><span>Previous designation</span><input name="previousDesignation" placeholder="Previous role" value={employeeForm.previousDesignation} onChange={handleEmployeeChange} /></label>
                        <label><span>Employment start</span><input name="previousCompanyFrom" type="date" value={employeeForm.previousCompanyFrom} onChange={handleEmployeeChange} /></label>
                        <label><span>Employment end</span><input name="previousCompanyTo" type="date" value={employeeForm.previousCompanyTo} onChange={handleEmployeeChange} /></label>
                        <label className="span-2"><span>Previous company details</span><textarea name="previousCompanyDetails" placeholder="Location, manager/contact, reason for leaving, or other notes" value={employeeForm.previousCompanyDetails} onChange={handleEmployeeChange}></textarea></label>
                      </div>
                      <div className="payslip-upload-grid">
                        {payslipLabels.map((label, index) => (
                          <label className={`payslip-upload-card ${employeeForm.previousCompanyPayslips[index] ? 'uploaded' : ''}`} key={label}>
                            <i className={`bi ${employeeForm.previousCompanyPayslips[index] ? 'bi-file-earmark-check-fill' : 'bi-file-earmark-arrow-up-fill'}`} aria-hidden="true"></i>
                            <strong>{label}</strong>
                            <span>{employeeForm.previousCompanyPayslips[index]?.fileName || 'Upload payslip'}</span>
                            <small>PDF or image, maximum 700 KB</small>
                            <input accept=".pdf,image/*" onChange={(event) => handlePayslipUpload(event, index)} required={!employeeForm.previousCompanyPayslips[index]} type="file" />
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </section>

                <section className="onboarding-form-section">
                  <div className="onboarding-section-title">
                    <i className="bi bi-shield-lock-fill" aria-hidden="true"></i>
                    <div><strong>Login credentials</strong><span>The employee can sign in using their employee ID</span></div>
                  </div>
                  <div className="onboarding-field-grid">
                    <label><span>Password *</span><input minLength="6" name="password" placeholder="Minimum 6 characters" type="password" value={employeeForm.password} onChange={handleEmployeeChange} required /></label>
                    <label><span>Confirm password *</span><input minLength="6" name="confirmPassword" placeholder="Repeat employee password" type="password" value={employeeForm.confirmPassword} onChange={handleEmployeeChange} required /></label>
                  </div>
                </section>

                <button className="employee-create-button" disabled={creatingEmployee} type="submit">
                  <i className="bi bi-person-check-fill" aria-hidden="true"></i>
                  {creatingEmployee ? 'Creating Employee...' : 'Create Employee Profile'}
                </button>
              </form>
            </article>

            <article className="admin-panel employee-onboarding-aside">
              <div className="panel-heading">
                <h2>Recent Employees</h2>
                <span>{employees.length} Accounts</span>
              </div>
              <div className="register-list compact">
                {employees.slice(0, 6).map((employee) => {
                  const balance = getEmployeeLeaveBalance(employee, leaves)
                  return (
                    <div
                      aria-label={`Open ${employee.fullName}'s dashboard`}
                      className="register-row employee-dashboard-link recent-employee-row"
                      key={employee._id}
                      onClick={() => handleOpenEmployeeDashboard(employee)}
                      onKeyDown={(event) => handleEmployeeCardKeyDown(event, employee)}
                      role="button"
                      tabIndex="0"
                    >
                      <div className="recent-employee-avatar">{employee.profilePhoto ? <img src={employee.profilePhoto} alt="" /> : (employee.fullName || 'E').slice(0, 1)}</div>
                      <div><b>{employee.fullName}</b><span>{employee.employeeId || 'Employee'}</span></div>
                      <em>{balance.remaining} leaves available</em>
                    </div>
                  )
                })}
                {!employees.length && <p className="empty-state">Registered employees will appear here.</p>}
              </div>
            </article>
          </section>
        )}

        {activeView === 'employees' && (
          <section className="admin-content-grid">
            {editingEmployeeId && (
              <article className="admin-panel">
                <div className="panel-heading">
                  <h2>Edit Employee</h2>
                  <span>Admin</span>
                </div>
                <form className="job-form employee-edit-form" onSubmit={handleSaveEmployee}>
                  <label className="employee-edit-photo">
                    {employeeEditForm.profilePhoto ? <img src={employeeEditForm.profilePhoto} alt="Employee" /> : <i className="bi bi-camera-fill"></i>}
                    <span>Update employee photo</span>
                    <input accept="image/*" onChange={(event) => handleEmployeePhoto(event, true)} type="file" />
                  </label>
                  <input name="fullName" placeholder="Full name" value={employeeEditForm.fullName} onChange={handleEmployeeEditChange} required />
                  <input name="email" placeholder="Email address" type="email" value={employeeEditForm.email} onChange={handleEmployeeEditChange} required />
                  <input inputMode="numeric" maxLength="10" minLength="10" name="phone" pattern="[0-9]{10}" placeholder="10-digit phone number" value={employeeEditForm.phone} onChange={handleEmployeeEditChange} required />
                  <input minLength="6" name="employeeId" pattern="EMP[0-9]{3,}" placeholder="Employee ID (EMP001)" value={employeeEditForm.employeeId} onChange={handleEmployeeEditChange} required />
                  <input name="department" placeholder="Department" value={employeeEditForm.department} onChange={handleEmployeeEditChange} />
                  <input name="designation" placeholder="Designation" value={employeeEditForm.designation} onChange={handleEmployeeEditChange} />
                  <label className="edit-labelled-field"><span>Annual leave allowance</span><input max="365" min="1" name="annualLeaveAllowance" type="number" value={employeeEditForm.annualLeaveAllowance} onChange={handleEmployeeEditChange} required /></label>
                  <select name="experienceType" value={employeeEditForm.experienceType} onChange={handleEmployeeEditChange}>
                    <option value="fresher">Fresher</option>
                    <option value="experienced">Experienced</option>
                  </select>
                  {employeeEditForm.experienceType === 'experienced' && (
                    <>
                      <input min="0" name="experienceYears" placeholder="Experience in years" step="0.1" type="number" value={employeeEditForm.experienceYears} onChange={handleEmployeeEditChange} />
                      <input name="previousCompanyName" placeholder="Previous company" value={employeeEditForm.previousCompanyName} onChange={handleEmployeeEditChange} required />
                      <input name="previousDesignation" placeholder="Previous designation" value={employeeEditForm.previousDesignation} onChange={handleEmployeeEditChange} />
                      <input name="previousCompanyFrom" type="date" value={employeeEditForm.previousCompanyFrom} onChange={handleEmployeeEditChange} />
                      <input name="previousCompanyTo" type="date" value={employeeEditForm.previousCompanyTo} onChange={handleEmployeeEditChange} />
                      <textarea name="previousCompanyDetails" placeholder="Previous company details" value={employeeEditForm.previousCompanyDetails} onChange={handleEmployeeEditChange}></textarea>
                      <div className="edit-payslip-list">
                        {payslipLabels.map((label, index) => (
                          <label key={label}>
                            <span>{label}: {employeeEditForm.previousCompanyPayslips[index]?.fileName || 'Not uploaded'}</span>
                            <input accept=".pdf,image/*" onChange={(event) => handlePayslipUpload(event, index, true)} type="file" />
                          </label>
                        ))}
                      </div>
                    </>
                  )}
                  <input name="password" placeholder="New password optional" type="password" value={employeeEditForm.password} onChange={handleEmployeeEditChange} />
                  <input name="confirmPassword" placeholder="Confirm new password" type="password" value={employeeEditForm.confirmPassword} onChange={handleEmployeeEditChange} />
                  <button className="primary-btn" type="submit">Update Employee</button>
                  <button className="secondary-btn" onClick={handleCancelEmployeeEdit} type="button">Cancel Edit</button>
                </form>
              </article>
            )}

          <article className={`admin-panel ${editingEmployeeId ? '' : 'wide'}`}>
            <div className="panel-heading">
              <h2>Employees</h2>
              <span>{employees.length} Team Members</span>
            </div>
            <div className="employee-admin-grid">
              {employees.map((employee) => (
                <article
                  aria-label={`Open ${employee.fullName}'s dashboard`}
                  className="employee-admin-card employee-dashboard-link"
                  key={employee._id}
                  onClick={() => handleOpenEmployeeDashboard(employee)}
                  onKeyDown={(event) => handleEmployeeCardKeyDown(event, employee)}
                  role="button"
                  tabIndex="0"
                >
                  <div className="employee-admin-avatar">
                    {employee.profilePhoto ? (
                      <img src={employee.profilePhoto} alt="" />
                    ) : (
                      (employee.fullName || 'E').slice(0, 1).toUpperCase()
                    )}
                  </div>
                  <div>
                    <strong>{employee.fullName}</strong>
                    <span>{employee.designation || 'Team Member'}</span>
                    <div className="employee-card-meta">
                      <small>{employee.experienceType === 'experienced' ? `${employee.experienceYears || 0} years experience` : 'Fresher'}</small>
                      <small>{getEmployeeLeaveBalance(employee, leaves).remaining} leaves available out of {getEmployeeLeaveBalance(employee, leaves).annual}</small>
                    </div>
                    <p>{employee.department || 'Unassigned'} · {employee.email}</p>
                  </div>
                  <em>{employee.employeeId || 'No ID'}</em>
                  <div className="admin-row-actions employee-card-actions">
                    <button onClick={(event) => { event.stopPropagation(); handleEditEmployee(employee) }} title="Edit employee" type="button">
                      <i className="bi bi-pencil-square" aria-hidden="true"></i>
                    </button>
                    <button onClick={(event) => { event.stopPropagation(); handleDeleteEmployee(employee._id) }} title="Delete employee" type="button">
                      <i className="bi bi-trash3" aria-hidden="true"></i>
                    </button>
                  </div>
                </article>
              ))}
              {!employees.length && <p className="empty-state">Registered employees will appear here.</p>}
            </div>
          </article>
          </section>
        )}

        {activeView === 'leaves' && (
          <article className="admin-panel">
            <div className="panel-heading">
              <h2>Employee Leaves</h2>
              <span>{leaves.length} Requests</span>
            </div>
            <div className="leave-admin-list">
              {leaves.map((leave) => (
                <div className="leave-admin-card" key={leave._id}>
                  <i className="bi bi-calendar-event-fill" aria-hidden="true"></i>
                  <div>
                    <strong>{leave.employee?.fullName || 'Employee'}</strong>
                    <span>{leave.employee?.department || 'Unassigned'} | {leave.employee?.employeeId || 'No ID'}</span>
                    <p>{leave.type} leave from {formatDate(leave.fromDate)} to {formatDate(leave.toDate)}</p>
                    {leave.reason && <small>{leave.reason}</small>}
                  </div>
                  <select value={leave.status} onChange={(event) => handleLeaveStatus(leave._id, event.target.value)}>
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
              ))}
              {!leaves.length && <p className="empty-state">Employee leave requests will appear here.</p>}
            </div>
          </article>
        )}

        {activeView === 'attendance' && (
          <article className="admin-panel">
            <div className="panel-heading">
              <h2>Team Attendance</h2>
              <span>{attendance.length} Records</span>
            </div>
            <div className={`admin-own-attendance ${activeAdminAttendance ? 'checked-in' : ''}`}>
              <div><i className={`bi ${activeAdminAttendance ? 'bi-person-check-fill' : 'bi-person-dash-fill'}`}></i><div><span>Admin attendance</span><strong>{activeAdminAttendance ? `Checked in at ${formatTime(activeAdminAttendance.loginAt)}` : 'Ready to check in'}</strong></div></div>
              <button disabled={savingAdminAttendance} onClick={handleAdminAttendance} type="button">{savingAdminAttendance ? 'Saving...' : activeAdminAttendance ? 'Check Out' : 'Check In'}</button>
            </div>
            <div className="attendance-list admin-attendance-list">
              {attendance.map((entry) => (
                <div className="attendance-row" key={entry._id}>
                  <div>
                    <strong>{entry.employee?.fullName || 'Employee'}</strong>
                    <span>{entry.employee?.role === 'admin' ? 'Admin' : entry.employee?.department || 'Unassigned'} | {formatDate(entry.loginAt)}</span>
                  </div>
                  <div>
                    <strong>{formatTime(entry.loginAt)}</strong>
                    <span>Login</span>
                  </div>
                  <div>
                    <strong>{formatTime(entry.logoutAt)}</strong>
                    <span>Logout</span>
                  </div>
                  <b>{entry.status}</b>
                </div>
              ))}
              {!attendance.length && <p className="empty-state">Team attendance records will appear here.</p>}
            </div>
          </article>
        )}

        {activeView === 'meetings' && (
          <article className="admin-panel">
            <div className="panel-heading"><h2>Management Meetings</h2><span>{meetings.length} Messages</span></div>
            <div className="dashboard-meeting-grid">
              {meetings.map((meeting) => (
                <article key={meeting._id}>
                  <div className="dashboard-meeting-date"><strong>{new Date(meeting.meetingDate).getDate()}</strong><span>{new Date(meeting.meetingDate).toLocaleString([], { month: 'short' })}</span></div>
                  <div><span className="meeting-recipient-badge">For {meeting.audience === 'all' ? 'everyone' : meeting.audience}</span><h3>{meeting.title}</h3><p>{meeting.message}</p><small><i className="bi bi-clock-fill"></i> {meeting.meetingTime} · {meeting.durationMinutes} minutes</small>{meeting.meetingLink && <a href={meeting.meetingLink} rel="noreferrer" target="_blank">Join meeting</a>}</div>
                </article>
              ))}
              {!meetings.length && <p className="empty-state">Management meeting messages will appear here.</p>}
            </div>
          </article>
        )}

        {activeView === 'jobs' && (
          <section className="admin-content-grid">
            <article className="admin-panel">
              <div className="panel-heading">
                <h2>Create Job</h2>
                <span>Admin</span>
              </div>
              <form className="job-form" onSubmit={handleCreateJob}>
                <input name="title" placeholder="Job title" value={jobForm.title} onChange={handleJobChange} required />
                <input name="department" placeholder="Department" value={jobForm.department} onChange={handleJobChange} required />
                <input name="location" placeholder="Location" value={jobForm.location} onChange={handleJobChange} />
                <select name="type" value={jobForm.type} onChange={handleJobChange}>
                  <option>Full Time</option>
                  <option>Part Time</option>
                  <option>Internship</option>
                  <option>Contract</option>
                </select>
                <input name="salary" placeholder="Salary package, e.g. 4 LPA - 8 LPA" value={jobForm.salary} onChange={handleJobChange} />
                <input name="experience" placeholder="Experience, e.g. 2+ years" value={jobForm.experience} onChange={handleJobChange} />
                <input name="skills" placeholder="Skills, e.g. React, Node, MongoDB" value={jobForm.skills} onChange={handleJobChange} />
                <input name="openings" min="1" type="number" value={jobForm.openings} onChange={handleJobChange} />
                <input name="applicationEmail" placeholder="Application email" value={jobForm.applicationEmail} onChange={handleJobChange} />
                <textarea name="description" placeholder="Short description" value={jobForm.description} onChange={handleJobChange}></textarea>
                <button className="primary-btn" type="submit">Publish Job</button>
              </form>
            </article>

            <article className="admin-panel">
              <div className="panel-heading">
                <h2>Jobs</h2>
                <span>{jobs.length} Total</span>
              </div>
              <div className="job-list">
                {jobs.map((job) => (
                  <div className="job-row" key={job._id}>
                    <i className="bi bi-briefcase-fill" aria-hidden="true"></i>
                    <div>
                      <strong>{job.title}</strong>
                      <span>{job.department} · {job.location || 'Remote'} · {job.type}</span>
                      <small>{job.experience || 'Experience open'} · {job.salary || 'Salary not listed'}</small>
                    </div>
                    <em>{job.status}</em>
                  </div>
                ))}
              </div>
            </article>
          </section>
        )}

        {activeView === 'applications' && (
          <section className="admin-content-grid application-admin-grid">
            {editingApplicationId && (
              <article className="admin-panel">
                <div className="panel-heading">
                  <h2>Edit Application</h2>
                  <span>Admin</span>
                </div>
                <form className="job-form" onSubmit={handleSaveApplication}>
                  <input name="fullName" placeholder="Full name" value={applicationForm.fullName} onChange={handleApplicationEditChange} required />
                  <input name="email" placeholder="Email address" type="email" value={applicationForm.email} onChange={handleApplicationEditChange} required />
                  <input name="phone" placeholder="Phone number" value={applicationForm.phone} onChange={handleApplicationEditChange} required />
                  <input name="jobTitle" placeholder="Job title" value={applicationForm.jobTitle} onChange={handleApplicationEditChange} required />
                  <input name="experience" placeholder="Experience" value={applicationForm.experience} onChange={handleApplicationEditChange} />
                  <input name="portfolio" placeholder="Portfolio or LinkedIn" value={applicationForm.portfolio} onChange={handleApplicationEditChange} />
                  <select name="status" value={applicationForm.status} onChange={handleApplicationEditChange}>
                    <option value="new">New</option>
                    <option value="reviewing">Reviewing</option>
                    <option value="shortlisted">Shortlisted</option>
                    <option value="rejected">Rejected</option>
                  </select>
                  <textarea name="coverLetter" placeholder="Short message" value={applicationForm.coverLetter} onChange={handleApplicationEditChange}></textarea>
                  <button className="primary-btn" type="submit">Update Application</button>
                  <button className="secondary-btn" onClick={handleCancelApplicationEdit} type="button">Cancel Edit</button>
                </form>
              </article>
            )}

            <article className={`admin-panel ${editingApplicationId ? '' : 'wide'}`}>
              <div className="panel-heading">
                <h2>Job Applications</h2>
                <span>{applications.length} Submitted</span>
              </div>

              {applicationNotice && <p className="admin-success-note">{applicationNotice}</p>}

              <div className="application-list">
                {applications.map((application) => {
                  return (
                    <div className="application-card enhanced-application-card" key={application._id}>
                      <div className="application-main">
                        <div className="application-avatar">
                          {(application.fullName || 'A').slice(0, 1).toUpperCase()}
                        </div>
                        <div>
                          <strong>{application.fullName}</strong>
                          <span>{application.jobTitle}</span>
                          <p>{application.email} | {application.phone}</p>
                          {application.coverLetter && <small>{application.coverLetter}</small>}
                        </div>
                      </div>

                      <div className="application-meta">
                        <b>{application.experience || 'Experience not added'}</b>
                        <em className={`application-status-badge status-${application.status || 'new'}`}>
                          {application.status || 'new'}
                        </em>
                        {application.resumeFile && (
                          <a href={application.resumeFile} download={application.resumeFileName || 'resume'}>
                            Resume
                          </a>
                        )}
                        {application.portfolio && (
                          <a href={application.portfolio} rel="noreferrer" target="_blank">
                            Portfolio
                          </a>
                        )}
                      </div>

                      <div className="application-controls">
                        <select
                          value={application.status}
                          onChange={(event) => handleApplicationStatus(application, event.target.value)}
                        >
                          <option value="new">New</option>
                          <option value="reviewing">Reviewing</option>
                          <option value="shortlisted">Shortlisted</option>
                          <option value="rejected">Rejected</option>
                        </select>
                        <div className="admin-row-actions application-actions">
                          {['shortlisted', 'rejected'].includes(application.status) && (
                            <button
                              disabled={notifyingApplicationId === application._id}
                              onClick={() => handleApplicationEmailRetry(application)}
                              title={`Resend ${application.status} email`}
                              type="button"
                            >
                              <i className={`bi ${notifyingApplicationId === application._id ? 'bi-hourglass-split' : 'bi-envelope-arrow-up-fill'}`} aria-hidden="true"></i>
                            </button>
                          )}
                          <button onClick={() => handleEditApplication(application)} title="Edit application" type="button">
                            <i className="bi bi-pencil-square" aria-hidden="true"></i>
                          </button>
                          <button onClick={() => handleDeleteApplication(application._id)} title="Delete application" type="button">
                            <i className="bi bi-trash3" aria-hidden="true"></i>
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
                {!applications.length && <p className="empty-state">Applications from the Careers page will appear here.</p>}
              </div>
            </article>
          </section>
        )}

        {activeView === 'projects' && (
          <section className="admin-content-grid">
            <article className="admin-panel">
              <div className="panel-heading">
                <h2>Create Project</h2>
                <span>Company</span>
              </div>
              <form className="job-form" onSubmit={handleCreateProject}>
                <input name="name" placeholder="Project name" value={projectForm.name} onChange={handleProjectChange} required />
                <input name="client" placeholder="Client or owner" value={projectForm.client} onChange={handleProjectChange} />
                <select name="status" value={projectForm.status} onChange={handleProjectChange}>
                  <option value="planning">Planning</option>
                  <option value="active">Active</option>
                  <option value="review">Review</option>
                  <option value="completed">Completed</option>
                  <option value="on hold">On Hold</option>
                </select>
                <input name="progress" min="0" max="100" type="number" placeholder="Progress %" value={projectForm.progress} onChange={handleProjectChange} />
                <input name="budget" placeholder="Budget" value={projectForm.budget} onChange={handleProjectChange} />
                <input name="deadline" placeholder="Deadline" value={projectForm.deadline} onChange={handleProjectChange} />
                <textarea name="description" placeholder="Project notes" value={projectForm.description} onChange={handleProjectChange}></textarea>
                <button className="primary-btn" type="submit">Save Project</button>
              </form>
            </article>

            <article className="admin-panel">
              <div className="panel-heading">
                <h2>Projects</h2>
                <span>{projects.length} Total</span>
              </div>
              <div className="project-list">
                {projects.map((project) => (
                  <div className="project-row" key={project._id}>
                    <div>
                      <strong>{project.name}</strong>
                      <span>{project.client || 'Internal'} · {project.status}</span>
                    </div>
                    <div className="project-progress">
                      <i style={{ width: `${project.progress || 0}%` }}></i>
                    </div>
                    <b>{project.progress || 0}%</b>
                  </div>
                ))}
              </div>
            </article>
          </section>
        )}

        {activeView === 'company' && (
          <section className="admin-content-grid">
            <article className="admin-panel">
              <div className="panel-heading">
                <h2>Company Data</h2>
                <span>Editable</span>
              </div>
              <form className="job-form" onSubmit={handleUpdateCompany}>
                <input name="name" placeholder="Company name" value={companyForm.name} onChange={handleCompanyChange} />
                <input name="email" placeholder="Company email" value={companyForm.email} onChange={handleCompanyChange} />
                <input name="phone" placeholder="Phone" value={companyForm.phone} onChange={handleCompanyChange} />
                <input name="website" placeholder="Website" value={companyForm.website} onChange={handleCompanyChange} />
                <input name="industry" placeholder="Industry" value={companyForm.industry} onChange={handleCompanyChange} />
                <textarea name="address" placeholder="Address" value={companyForm.address} onChange={handleCompanyChange}></textarea>
                <textarea name="description" placeholder="Company description" value={companyForm.description} onChange={handleCompanyChange}></textarea>
                <button className="primary-btn" type="submit">Update Company</button>
              </form>
            </article>

            <article className="admin-panel company-preview">
              <div className="panel-heading">
                <h2>Preview</h2>
                <span>Live</span>
              </div>
              <i className="bi bi-building-fill" aria-hidden="true"></i>
              <h3>{company?.name || companyForm.name}</h3>
              <p>{company?.description || companyForm.description || 'Add company details to show here.'}</p>
              <div>
                <span>{company?.email || companyForm.email}</span>
                <span>{company?.phone || companyForm.phone || '+91 94809 49103'}</span>
                <span>{company?.industry || companyForm.industry}</span>
              </div>
            </article>
          </section>
        )}

        {activeView === 'departments' && (
          <section className="admin-content-grid">
            <article className="admin-panel">
              <div className="panel-heading">
                <h2>{editingDepartmentId ? 'Edit Department' : 'Add Department'}</h2>
                <span>{editingDepartmentId ? 'Editing' : 'Admin'}</span>
              </div>
              <form className="job-form" onSubmit={handleCreateDepartment}>
                <input name="name" placeholder="Department name, e.g. Accountant, Sales" value={departmentForm.name} onChange={handleDepartmentChange} required />
                <textarea name="description" placeholder="Department notes" value={departmentForm.description} onChange={handleDepartmentChange}></textarea>
                <button className="primary-btn" type="submit">{editingDepartmentId ? 'Update Department' : 'Add Department'}</button>
                {editingDepartmentId && (
                  <button className="secondary-btn" onClick={handleCancelDepartmentEdit} type="button">Cancel Edit</button>
                )}
              </form>
            </article>

            <article className="admin-panel">
              <div className="panel-heading">
                <h2>Departments</h2>
                <span>{departments.length} Groups</span>
              </div>
              <div className="department-grid compact-departments">
                {departments.map((department) => (
                  <div className="department-card" key={department._id || department.name}>
                    <i className="bi bi-diagram-3-fill" aria-hidden="true"></i>
                    <strong>{department.name}</strong>
                    <span>{department.employeeCount ?? registerDepartmentCounts[department.name] ?? 0} registered</span>
                    {department.description && <p>{department.description}</p>}
                    {!department.derived && (
                      <div className="admin-row-actions department-actions">
                        <button onClick={() => handleEditDepartment(department)} title="Edit department" type="button">
                          <i className="bi bi-pencil-square" aria-hidden="true"></i>
                        </button>
                        <button onClick={() => handleDeleteDepartment(department._id)} title="Delete department" type="button">
                          <i className="bi bi-trash3" aria-hidden="true"></i>
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </article>
          </section>
        )}

        {activeView === 'services' && (
          <section className="admin-content-grid">
            <article className="admin-panel">
              <div className="panel-heading">
                <h2>{editingServiceId ? 'Edit Service' : 'Add Service'}</h2>
                <span>{editingServiceId ? 'Editing' : 'Home Page'}</span>
              </div>
              <form className="job-form service-form" onSubmit={handleSaveService}>
                <input name="title" placeholder="Service title" value={serviceForm.title} onChange={handleServiceChange} required />
                <input name="badge" placeholder="Badge" value={serviceForm.badge} onChange={handleServiceChange} />
                <input name="image" placeholder="Image URL" value={serviceForm.image} onChange={handleServiceChange} />
                <input name="order" type="number" placeholder="Display order" value={serviceForm.order} onChange={handleServiceChange} />
                <select name="status" value={serviceForm.status} onChange={handleServiceChange}>
                  <option value="active">Active</option>
                  <option value="hidden">Hidden</option>
                </select>
                <textarea name="front" placeholder="Front card text" value={serviceForm.front} onChange={handleServiceChange}></textarea>
                <textarea name="back" placeholder="Back card text" value={serviceForm.back} onChange={handleServiceChange}></textarea>
                <textarea name="details" placeholder="Details, comma separated" value={serviceForm.details} onChange={handleServiceChange}></textarea>
                <button className="primary-btn" type="submit">{editingServiceId ? 'Update Service' : 'Create Service'}</button>
                {editingServiceId && (
                  <button className="secondary-btn" onClick={handleCancelServiceEdit} type="button">
                    Cancel Edit
                  </button>
                )}
              </form>
            </article>

            <article className="admin-panel">
              <div className="panel-heading">
                <h2>Popular Services</h2>
                <span>{services.length} Total</span>
              </div>
              <div className="service-admin-list">
                {services.map((service) => (
                  <div className="service-admin-card" key={service._id}>
                    {service.image && <img src={service.image} alt="" />}
                    <div>
                      <strong>{service.title}</strong>
                      <span>{service.badge} | {service.status}</span>
                      <p>{service.front}</p>
                    </div>
                    <div className="admin-row-actions">
                      <button onClick={() => handleEditService(service)} type="button">
                        <i className="bi bi-pencil-square" aria-hidden="true"></i>
                      </button>
                      <button onClick={() => handleDeleteService(service._id)} type="button">
                        <i className="bi bi-trash3" aria-hidden="true"></i>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          </section>
        )}

        {['reports', 'settings'].includes(activeView) && (
          <article className="admin-panel">
            <div className="panel-heading">
              <h2>{activeView === 'reports' ? 'Reports' : 'Settings'}</h2>
            </div>
            <p className="empty-state">
              {activeView === 'reports'
                ? `Registers: ${summary.totalRegisters}, Employees: ${summary.employees}, Open jobs: ${summary.openJobs}.`
                : 'Profile, permissions, and company settings are ready for your next admin controls.'}
            </p>
          </article>
        )}
      </section>
    </main>
  )
}

export default AdminDashboard
