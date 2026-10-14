import { useEffect, useState, type FormEvent } from 'react'
import {
  ArrowDown,
  ArrowUpRight,
  Check,
  CheckCheck,
  ChevronDown,
  Clock3,
  FileText,
  LayoutGrid,
  ListTodo,
  LogOut,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  UserPlus,
  X,
} from 'lucide-react'
import { neonClient, neonConfigured } from './neon'
import './App.css'

type TaskStatus = 'todo' | 'in-progress' | 'done'
type Priority = 'High' | 'Medium' | 'Low'
type View = 'all' | 'mine' | 'completed'
type User = { id: string; name: string; email: string; role?: string | string[] }
type TeamMember = { id: string; display_name: string; email: string }
type Task = {
  id: string
  title: string
  project: string
  assignee_id: string | null
  priority: Priority
  status: TaskStatus
  due_date: string | null
  created_by: string
  completed_by: string | null
  completed_at: string | null
  created_at: string
}

const TODAY_LABEL = new Intl.DateTimeFormat('en', { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date())
const MEMBER_COLORS = ['coral', 'blue', 'green', 'yellow', 'lilac']
const INITIAL_RESET_TOKEN = typeof window === 'undefined' ? '' : new URL(window.location.href).searchParams.get('token') ?? ''

function getInitials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('') || 'TM'
}

function getMemberColor(id: string) {
  return [...id].reduce((total, character) => total + character.charCodeAt(0), 0) % MEMBER_COLORS.length
}

function formatDueDate(value: string | null) {
  if (!value) return 'No date'
  const due = new Date(`${value}T12:00:00`)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const dueDay = new Date(due)
  dueDay.setHours(0, 0, 0, 0)
  if (dueDay.getTime() === today.getTime()) return 'Today'
  if (dueDay.getTime() === tomorrow.getTime()) return 'Tomorrow'
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(due)
}

function messageFromError(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.'
}

export default function NeonApp() {
  const [user, setUser] = useState<User | null>(null)
  const [loadingSession, setLoadingSession] = useState(true)
  const [loadingBoard, setLoadingBoard] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [tasks, setTasks] = useState<Task[]>([])
  const [members, setMembers] = useState<TeamMember[]>([])
  const [view, setView] = useState<View>('all')
  const [query, setQuery] = useState('')
  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false)
  const [isMemberFormOpen, setIsMemberFormOpen] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    let active = true
    async function loadSession() {
      if (!neonClient) {
        setLoadingSession(false)
        return
      }
      try {
        const result = await neonClient.auth.getSession()
        if (active) setUser((result.data?.user as User | undefined) ?? null)
      } catch (sessionError) {
        if (active) setError(messageFromError(sessionError))
      } finally {
        if (active) setLoadingSession(false)
      }
    }
    void loadSession()
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!user || !neonClient) return
    const client = neonClient
    const activeUser = user
    let active = true
    async function loadBoard() {
      setLoadingBoard(true)
      setError('')
      try {
        const membership = await client.rpc('join_team_member', { member_display_name: activeUser.name || activeUser.email })
        if (membership.error) throw new Error(membership.error.message)

        const [memberResult, taskResult] = await Promise.all([
          client.from('team_members').select('*').order('display_name', { ascending: true }),
          client.from('tasks').select('*').order('created_at', { ascending: false }),
        ])
        if (memberResult.error) throw new Error(memberResult.error.message)
        if (taskResult.error) throw new Error(taskResult.error.message)
        if (active) {
          setMembers((memberResult.data ?? []) as TeamMember[])
          setTasks((taskResult.data ?? []) as Task[])
        }
      } catch (loadError) {
        if (active) setError(messageFromError(loadError))
      } finally {
        if (active) setLoadingBoard(false)
      }
    }
    void loadBoard()
    return () => { active = false }
  }, [refreshKey, user])

  if (!neonConfigured || !neonClient) {
    return (
      <div className="connection-screen">
        <div className="connection-card">
          <a className="brand" href="#board" aria-label="Impact home"><span className="brand-mark"><Sparkles size={19} /></span><span>impact<span className="brand-period">.</span></span></a>
          <span className="modal-kicker">NEON CONNECTION</span>
          <h1>Connect your team board.</h1>
          <p>Set <code>VITE_NEON_AUTH_URL</code> and <code>VITE_NEON_DATA_API_URL</code> in <code>.env.local</code> for local development and in Vercel project settings for deployment.</p>
          <a className="connection-link" href="https://neon.com/docs/data-api/get-started" target="_blank" rel="noreferrer">Open Neon Data API setup <ArrowUpRight size={15} /></a>
        </div>
      </div>
    )
  }

  if (loadingSession) {
    return <div className="connection-screen"><div className="loading-message">Checking your sign-in...</div></div>
  }

  if (!user) {
    return <SignInScreen error={error} onError={setError} onSignedIn={setUser} />
  }

  const userIsAdmin = user.role === 'admin' || (Array.isArray(user.role) && user.role.includes('admin'))
  const openTasks = tasks.filter((task) => task.status !== 'done')
  const completedTasks = tasks.filter((task) => task.status === 'done')
  const mineCount = openTasks.filter((task) => task.assignee_id === user.id).length
  const normalizedQuery = query.trim().toLowerCase()
  const visibleTasks = tasks
    .filter((task) => {
      if (view === 'mine' && (task.assignee_id !== user.id || task.status === 'done')) return false
      if (view === 'completed' && task.status !== 'done') return false
      const assignee = members.find((member) => member.id === task.assignee_id)?.display_name ?? ''
      return !normalizedQuery || `${task.title} ${task.project} ${assignee}`.toLowerCase().includes(normalizedQuery)
    })
    .sort((a, b) => (a.due_date ?? '9999-12-31').localeCompare(b.due_date ?? '9999-12-31'))
  const title = view === 'mine' ? 'My tasks' : view === 'completed' ? 'Completed' : 'Team board'

  async function signOut() {
    if (!neonClient) return
    const result = await neonClient.auth.signOut()
    if (result.error) setError(result.error.message ?? 'Unable to sign out.')
    else {
      setUser(null)
      setTasks([])
      setMembers([])
      setError('')
    }
  }

  async function createTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!neonClient) return
    const formData = new FormData(event.currentTarget)
    const result = await neonClient.from('tasks').insert({
      title: String(formData.get('title')).trim(),
      project: String(formData.get('project')).trim() || 'Team updates',
      assignee_id: String(formData.get('assignee')) || null,
      due_date: String(formData.get('dueDate')) || null,
      priority: String(formData.get('priority')),
      status: 'todo',
    })
    if (result.error) {
      setError(result.error.message ?? 'Unable to create the account.')
      return
    }
    setIsTaskFormOpen(false)
    setError('')
    setRefreshKey((current) => current + 1)
  }

  async function advanceTask(task: Task) {
    if (!neonClient) return
    const nextStatus: Record<TaskStatus, TaskStatus> = {
      todo: 'in-progress',
      'in-progress': 'done',
      done: 'todo',
    }
    const result = await neonClient.from('tasks').update({ status: nextStatus[task.status] }).eq('id', task.id)
    if (result.error) {
      setError(result.error.message)
      return
    }
    setError('')
    setRefreshKey((current) => current + 1)
  }

  async function createMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!neonClient || !userIsAdmin) return
    const formData = new FormData(event.currentTarget)
    const result = await neonClient.auth.admin.createUser({
      name: String(formData.get('name')).trim(),
      email: String(formData.get('email')).trim(),
      password: String(formData.get('password')),
      role: 'user',
    })
    if (result.error) {
      setError(result.error.message ?? 'Unable to create the account.')
      return
    }
    const invite = await neonClient.from('team_invites').insert({
      user_id: result.data.user.id,
      email: result.data.user.email,
    })
    if (invite.error) {
      setError(`The account was created, but its team invite could not be saved: ${invite.error.message ?? 'Unknown error'}`)
      return
    }
    setNotice('Account created. Share the temporary password securely. The member appears in assignee lists after their first sign-in.')
    setError('')
    setIsMemberFormOpen(false)
  }

  const memberById = new Map(members.map((member) => [member.id, member]))

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#board" aria-label="Impact home"><span className="brand-mark"><Sparkles size={19} strokeWidth={2.2} /></span><span>impact<span className="brand-period">.</span></span></a>
        <div className="workspace-switcher"><span className="workspace-glyph">TI</span><span className="workspace-copy"><strong>TEAM IMPACT</strong><small>Team workspace</small></span><ChevronDown size={15} /></div>
        <div className="side-label">WORKSPACE</div>
        <nav className="side-nav" aria-label="Workspace views">
          <button className={`nav-item ${view === 'all' ? 'is-active' : ''}`} onClick={() => setView('all')} type="button"><LayoutGrid size={17} /><span>Team board</span><span className="nav-count">{openTasks.length}</span></button>
          <button className={`nav-item ${view === 'mine' ? 'is-active' : ''}`} onClick={() => setView('mine')} type="button"><ListTodo size={17} /><span>My tasks</span><span className="nav-count">{mineCount}</span></button>
          <button className={`nav-item ${view === 'completed' ? 'is-active' : ''}`} onClick={() => setView('completed')} type="button"><CheckCheck size={17} /><span>Completed</span><span className="nav-count">{completedTasks.length}</span></button>
        </nav>
        <div className="side-label project-label">TEAM MEMBERS <span>{members.length}</span></div>
        {members.map((member) => <div className="project-link" key={member.id}><span className={`project-dot member-dot-${getMemberColor(member.id)}`} />{member.display_name}</div>)}
        <div className="sidebar-bottom">
          <div className="storage-note"><span className="storage-dot" /><span>Connected to Neon</span></div>
          <div className="profile-button"><span className={`avatar avatar-${MEMBER_COLORS[getMemberColor(user.id)]}`}>{getInitials(user.name)}</span><span className="profile-copy"><strong>{user.name}</strong><small>{user.email}</small></span><button className="sign-out-button" type="button" onClick={() => void signOut()} aria-label="Sign out" title="Sign out"><LogOut size={15} /></button></div>
        </div>
      </aside>

      <main className="main-area" id="board">
        <header className="topbar">
          <div className="breadcrumbs"><span>TEAM IMPACT</span><span className="crumb-slash">/</span><strong>{title}</strong></div>
          <div className="topbar-actions"><span className="today-label"><Clock3 size={14} />{TODAY_LABEL}</span><span className={`avatar avatar-${MEMBER_COLORS[getMemberColor(user.id)]}`} title={user.name}>{getInitials(user.name)}</span></div>
        </header>

        <div className="board-content">
          <section className="board-heading"><div><div className="eyebrow"><span className="eyebrow-line" />YOUR TEAM, IN MOTION</div><h1>{title}<span className="heading-period">.</span></h1><p className="board-subtitle">Small steps, shared progress.</p></div><div className="heading-actions">{userIsAdmin && <button className="secondary-button" type="button" onClick={() => { setError(''); setIsMemberFormOpen(true) }}><UserPlus size={16} /> Add teammate</button>}<button className="primary-button" type="button" onClick={() => { setError(''); setIsTaskFormOpen(true) }}><Plus size={17} strokeWidth={2.5} /> Add a task</button></div></section>

          {notice && <div className="notice-banner" role="status">{notice}<button type="button" onClick={() => setNotice('')} aria-label="Dismiss"><X size={15} /></button></div>}
          {error && <div className="error-banner" role="alert">{error}<button type="button" onClick={() => setError('')} aria-label="Dismiss"><X size={15} /></button></div>}

          <section className="stats-row" aria-label="Task summary">
            <div className="stat-block"><span className="stat-label">OPEN TASKS</span><strong>{openTasks.length.toString().padStart(2, '0')}</strong><span className="stat-caption">across the team</span></div>
            <div className="stat-block stat-focus"><span className="stat-label">IN PROGRESS</span><strong>{tasks.filter((task) => task.status === 'in-progress').length.toString().padStart(2, '0')}</strong><span className="stat-caption">being moved forward</span></div>
            <div className="stat-block"><span className="stat-label">COMPLETED</span><strong>{completedTasks.length.toString().padStart(2, '0')}</strong><span className="stat-caption">nice work, team</span></div>
            <div className="team-progress"><div className="progress-topline"><span>Team momentum</span><strong>{tasks.length ? Math.round(completedTasks.length / tasks.length * 100) : 0}%</strong></div><div className="progress-track"><span style={{ width: `${tasks.length ? completedTasks.length / tasks.length * 100 : 0}%` }} /></div><small>Tasks wrapped up</small></div>
          </section>

          <section className="task-section">
            <div className="list-toolbar"><div className="list-heading"><FileText size={17} /><h2>{view === 'completed' ? 'Recently completed' : 'All tasks'}</h2><span className="result-count">{visibleTasks.length}</span></div><div className="toolbar-actions"><label className="search-box"><Search size={16} /><input aria-label="Search tasks" placeholder="Search tasks" value={query} onChange={(event) => setQuery(event.target.value)} /></label><button className="refresh-button" type="button" onClick={() => setRefreshKey((current) => current + 1)} disabled={loadingBoard} title="Refresh tasks" aria-label="Refresh tasks"><RefreshCw size={15} /></button><span className="sort-button" title="Tasks are sorted by due date"><ArrowDown size={15} /><span>Due date</span></span></div></div>

            <div className="task-list">
              {loadingBoard ? <div className="empty-state"><strong>Loading team tasks...</strong></div> : visibleTasks.length ? visibleTasks.map((task) => {
                const assignee = task.assignee_id ? memberById.get(task.assignee_id) : undefined
                const completer = task.completed_by ? memberById.get(task.completed_by) : undefined
                return <article className={`task-row ${task.status === 'done' ? 'task-done' : ''}`} key={task.id}>
                  <button className={`status-button status-${task.status}`} type="button" onClick={() => void advanceTask(task)} aria-label={`Change status for ${task.title}`} title={task.status === 'todo' ? 'Start task' : task.status === 'in-progress' ? 'Mark complete' : 'Reopen task'}>{task.status === 'done' ? <Check size={14} /> : task.status === 'in-progress' ? <ArrowUpRight size={14} /> : null}</button>
                  <div className="task-main"><strong>{task.title}</strong><span>{task.project} <span className="task-meta-divider">/</span> {task.status === 'done' ? `Completed by ${completer?.display_name ?? 'Team member'}` : assignee ? `Assigned to ${assignee.display_name}` : 'Unassigned'}</span></div>
                  <span className={`priority priority-${task.priority.toLowerCase()}`}><span />{task.priority}</span><span className="task-due">{formatDueDate(task.due_date)}</span>
                  <span className={`avatar task-assignee avatar-${MEMBER_COLORS[getMemberColor(assignee?.id ?? task.id)]}`} title={assignee?.display_name ?? 'Unassigned'}>{assignee ? getInitials(assignee.display_name) : '?'}</span>
                </article>
              }) : <div className="empty-state"><span className="empty-icon"><Search size={20} /></span><strong>{tasks.length ? 'No tasks found' : 'Your shared board is ready'}</strong><span>{tasks.length ? 'Try another search or filter.' : 'Add the first task for your team.'}</span></div>}
            </div>
            <button className="add-task-inline" type="button" onClick={() => { setError(''); setIsTaskFormOpen(true) }}><Plus size={15} /> Add a task</button>
          </section>
          <footer className="board-footer"><span><span className="footer-indicator" />Shared team board</span><span>NEON POSTGRES <span className="footer-dot">/</span> {members.length} MEMBERS</span></footer>
        </div>
      </main>

      {isTaskFormOpen && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setIsTaskFormOpen(false) }}><section className="task-modal" role="dialog" aria-modal="true" aria-labelledby="task-modal-title"><div className="modal-heading"><div><span className="modal-kicker">TEAM BOARD</span><h2 id="task-modal-title">Add a task</h2></div><button className="icon-button" type="button" onClick={() => setIsTaskFormOpen(false)} aria-label="Close"><X size={19} /></button></div><form onSubmit={(event) => void createTask(event)}><label className="form-field"><span>Task name</span><input name="title" placeholder="What needs to get done?" required autoFocus maxLength={120} /></label><label className="form-field"><span>Project <small>Optional</small></span><input name="project" placeholder="e.g. Spring launch" maxLength={48} /></label><div className="form-grid"><label className="form-field"><span>Assignee</span><select name="assignee" defaultValue=""><option value="">Unassigned</option>{members.map((member) => <option value={member.id} key={member.id}>{member.display_name}</option>)}</select></label><label className="form-field"><span>Priority</span><select name="priority" defaultValue="Medium"><option>Low</option><option>Medium</option><option>High</option></select></label></div><label className="form-field"><span>Due date</span><input name="dueDate" type="date" /></label><div className="modal-actions"><button className="cancel-button" type="button" onClick={() => setIsTaskFormOpen(false)}>Cancel</button><button className="primary-button" type="submit"><Plus size={16} /> Create task</button></div></form></section></div>}

      {isMemberFormOpen && userIsAdmin && <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setIsMemberFormOpen(false) }}><section className="task-modal" role="dialog" aria-modal="true" aria-labelledby="member-modal-title"><div className="modal-heading"><div><span className="modal-kicker">ADMINISTRATION</span><h2 id="member-modal-title">Create teammate account</h2></div><button className="icon-button" type="button" onClick={() => setIsMemberFormOpen(false)} aria-label="Close"><X size={19} /></button></div><form onSubmit={(event) => void createMember(event)}><label className="form-field"><span>Full name</span><input name="name" placeholder="Name" required maxLength={100} /></label><label className="form-field"><span>Email</span><input name="email" type="email" placeholder="name@company.com" required /></label><label className="form-field"><span>Temporary password</span><input name="password" type="password" autoComplete="new-password" minLength={12} required /><small className="field-note">Use a unique temporary password and share it through a separate secure channel.</small></label><div className="modal-actions"><button className="cancel-button" type="button" onClick={() => setIsMemberFormOpen(false)}>Cancel</button><button className="primary-button" type="submit"><UserPlus size={16} /> Create account</button></div></form></section></div>}
    </div>
  )
}

function SignInScreen({ error, onError, onSignedIn }: { error: string; onError: (message: string) => void; onSignedIn: (user: User) => void }) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [screen, setScreen] = useState<'sign-in' | 'forgot-password' | 'reset-password'>(INITIAL_RESET_TOKEN ? 'reset-password' : 'sign-in')
  const [resetToken, setResetToken] = useState(INITIAL_RESET_TOKEN)
  const [statusMessage, setStatusMessage] = useState('')

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!neonClient) return
    setIsSubmitting(true)
    onError('')
    const formData = new FormData(event.currentTarget)
    try {
      const result = await neonClient.auth.signIn.email({
        email: String(formData.get('email')).trim(),
        password: String(formData.get('password')),
      })
      if (result.error) throw new Error(result.error.message)
      onSignedIn(result.data.user as User)
    } catch (signInError) {
      onError(messageFromError(signInError))
    } finally {
      setIsSubmitting(false)
    }
  }

  async function requestPasswordReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!neonClient) return
    setIsSubmitting(true)
    onError('')
    const formData = new FormData(event.currentTarget)
    try {
      const result = await neonClient.auth.requestPasswordReset({
        email: String(formData.get('email')).trim(),
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (result.error) throw new Error(result.error.message)
      setStatusMessage('If this account exists, a password-reset link is on its way. Check your inbox.')
    } catch (resetError) {
      onError(messageFromError(resetError))
    } finally {
      setIsSubmitting(false)
    }
  }

  async function resetPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!neonClient) return
    setIsSubmitting(true)
    onError('')
    const formData = new FormData(event.currentTarget)
    const password = String(formData.get('password'))
    if (password !== String(formData.get('confirmPassword'))) {
      onError('The passwords do not match.')
      setIsSubmitting(false)
      return
    }
    try {
      const result = await neonClient.auth.resetPassword({ newPassword: password, token: resetToken })
      if (result.error) throw new Error(result.error.message)
      window.history.replaceState(null, '', '/')
      setResetToken('')
      setScreen('sign-in')
      setStatusMessage('Password set. You can now sign in.')
    } catch (resetError) {
      onError(messageFromError(resetError))
    } finally {
      setIsSubmitting(false)
    }
  }

  const heading = screen === 'reset-password' ? 'Set your password.' : screen === 'forgot-password' ? 'Reset your password.' : 'Welcome back.'

  return <div className="connection-screen"><section className="connection-card sign-in-card"><a className="brand" href="#board" aria-label="Impact home"><span className="brand-mark"><Sparkles size={19} /></span><span>impact<span className="brand-period">.</span></span></a><span className="modal-kicker">TEAM IMPACT</span><h1>{heading}</h1><p>{screen === 'reset-password' ? 'Choose a new password for your team account.' : screen === 'forgot-password' ? 'We’ll email a secure reset link if this account exists.' : 'Sign in with the account your team administrator created.'}</p>{error && <div className="error-banner" role="alert">{error}</div>}{statusMessage && <div className="notice-banner" role="status">{statusMessage}</div>}{screen === 'sign-in' ? <form onSubmit={(event) => void signIn(event)}><label className="form-field"><span>Email</span><input name="email" type="email" autoComplete="username" required /></label><label className="form-field"><span>Password</span><input name="password" type="password" autoComplete="current-password" required /></label><button className="primary-button sign-in-submit" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Signing in...' : 'Sign in'}</button><button className="auth-link-button" type="button" onClick={() => { onError(''); setStatusMessage(''); setScreen('forgot-password') }}>Forgot password?</button></form> : screen === 'forgot-password' ? <form onSubmit={(event) => void requestPasswordReset(event)}><label className="form-field"><span>Email</span><input name="email" type="email" autoComplete="username" required /></label><button className="primary-button sign-in-submit" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Sending...' : 'Send reset link'}</button><button className="auth-link-button" type="button" onClick={() => { onError(''); setStatusMessage(''); setScreen('sign-in') }}>Back to sign in</button></form> : resetToken ? <form onSubmit={(event) => void resetPassword(event)}><label className="form-field"><span>New password</span><input name="password" type="password" autoComplete="new-password" minLength={12} required /></label><label className="form-field"><span>Confirm password</span><input name="confirmPassword" type="password" autoComplete="new-password" minLength={12} required /></label><button className="primary-button sign-in-submit" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Saving...' : 'Set password'}</button></form> : <div className="error-banner" role="alert">This reset link is missing its token or has expired. Request a new one from the sign-in page.</div>}<div className="sign-in-note"><span className="storage-dot" />Private team workspace</div></section></div>
}