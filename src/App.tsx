import { useEffect, useState } from 'react'
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
  Plus,
  Search,
  Sparkles,
  X,
} from 'lucide-react'
import './App.css'

type TaskStatus = 'todo' | 'in-progress' | 'done'
type Priority = 'High' | 'Medium' | 'Low'
type View = 'all' | 'mine' | 'completed'

type Task = {
  id: string
  title: string
  project: string
  assignee: string
  dueDate: string
  priority: Priority
  status: TaskStatus
}

const STORAGE_KEY = 'impact-board-tasks'
const CURRENT_MEMBER = 'Alex Morgan'
const MEMBERS = [
  { name: 'Alex Morgan', initials: 'AM', color: 'coral' },
  { name: 'Priya Shah', initials: 'PS', color: 'blue' },
  { name: 'Jordan Lee', initials: 'JL', color: 'green' },
  { name: 'Sam Rivera', initials: 'SR', color: 'yellow' },
  { name: 'Taylor Kim', initials: 'TK', color: 'lilac' },
]
const TODAY_LABEL = new Intl.DateTimeFormat('en', { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date())

function dateOffset(days: number) {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

const initialTasks: Task[] = [
  { id: 't-1', title: 'Share Q3 impact highlights with the team', project: 'Team updates', assignee: 'Alex Morgan', dueDate: dateOffset(0), priority: 'High', status: 'in-progress' },
  { id: 't-2', title: 'Review onboarding feedback from new hires', project: 'People & culture', assignee: 'Priya Shah', dueDate: dateOffset(1), priority: 'Medium', status: 'todo' },
  { id: 't-3', title: 'Prepare first draft of the launch brief', project: 'Spring launch', assignee: 'Jordan Lee', dueDate: dateOffset(2), priority: 'High', status: 'todo' },
  { id: 't-4', title: 'Confirm volunteer schedule for Friday', project: 'Community day', assignee: 'Alex Morgan', dueDate: dateOffset(3), priority: 'Low', status: 'todo' },
  { id: 't-5', title: 'Send design notes to the product group', project: 'Spring launch', assignee: 'Sam Rivera', dueDate: dateOffset(-1), priority: 'Medium', status: 'done' },
]

function readTasks(): Task[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? (JSON.parse(saved) as Task[]) : initialTasks
  } catch {
    return initialTasks
  }
}

function getInitials(name: string) {
  return MEMBERS.find((member) => member.name === name)?.initials ?? 'TM'
}

function getMemberColor(name: string) {
  return MEMBERS.find((member) => member.name === name)?.color ?? 'coral'
}

function formatDueDate(value: string) {
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

function App() {
  const [tasks, setTasks] = useState<Task[]>(readTasks)
  const [view, setView] = useState<View>('all')
  const [query, setQuery] = useState('')
  const [isFormOpen, setIsFormOpen] = useState(false)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks))
  }, [tasks])

  const openTasks = tasks.filter((task) => task.status !== 'done')
  const completedTasks = tasks.filter((task) => task.status === 'done')
  const mineCount = openTasks.filter((task) => task.assignee === CURRENT_MEMBER).length

  const normalizedQuery = query.trim().toLowerCase()
  const visibleTasks = tasks
    .filter((task) => {
      if (view === 'mine' && (task.assignee !== CURRENT_MEMBER || task.status === 'done')) return false
      if (view === 'completed' && task.status !== 'done') return false
      return !normalizedQuery || `${task.title} ${task.project} ${task.assignee}`.toLowerCase().includes(normalizedQuery)
    })
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))

  const title = view === 'mine' ? 'My tasks' : view === 'completed' ? 'Completed' : 'Team board'

  function advanceTask(taskId: string) {
    setTasks((currentTasks) => currentTasks.map((task) => {
      if (task.id !== taskId) return task
      const nextStatus: Record<TaskStatus, TaskStatus> = {
        todo: 'in-progress',
        'in-progress': 'done',
        done: 'todo',
      }
      return { ...task, status: nextStatus[task.status] }
    }))
  }

  function createTask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const newTask: Task = {
      id: crypto.randomUUID(),
      title: String(formData.get('title')).trim(),
      project: String(formData.get('project')).trim() || 'Team updates',
      assignee: String(formData.get('assignee')),
      dueDate: String(formData.get('dueDate')),
      priority: String(formData.get('priority')) as Priority,
      status: 'todo',
    }
    setTasks((currentTasks) => [newTask, ...currentTasks])
    setView('all')
    setQuery('')
    setIsFormOpen(false)
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#board" aria-label="Impact home">
          <span className="brand-mark"><Sparkles size={19} strokeWidth={2.2} /></span>
          <span>impact<span className="brand-period">.</span></span>
        </a>

        <div className="workspace-switcher">
          <span className="workspace-glyph">N</span>
          <span className="workspace-copy"><strong>Northstar Studio</strong><small>Team workspace</small></span>
          <ChevronDown size={15} />
        </div>

        <div className="side-label">WORKSPACE</div>
        <nav className="side-nav" aria-label="Workspace views">
          <button className={`nav-item ${view === 'all' ? 'is-active' : ''}`} onClick={() => setView('all')} type="button">
            <LayoutGrid size={17} /><span>Team board</span><span className="nav-count">{openTasks.length}</span>
          </button>
          <button className={`nav-item ${view === 'mine' ? 'is-active' : ''}`} onClick={() => setView('mine')} type="button">
            <ListTodo size={17} /><span>My tasks</span><span className="nav-count">{mineCount}</span>
          </button>
          <button className={`nav-item ${view === 'completed' ? 'is-active' : ''}`} onClick={() => setView('completed')} type="button">
            <CheckCheck size={17} /><span>Completed</span><span className="nav-count">{completedTasks.length}</span>
          </button>
        </nav>

        <div className="side-label project-label">PROJECTS</div>
        <div className="project-link"><span className="project-dot dot-orange" />Spring launch</div>
        <div className="project-link"><span className="project-dot dot-blue" />People &amp; culture</div>
        <div className="project-link"><span className="project-dot dot-green" />Community day</div>

        <div className="sidebar-bottom">
          <div className="storage-note"><span className="storage-dot" /><span>Saved in this browser</span></div>
          <div className="profile-button">
            <span className="avatar avatar-coral">AM</span>
            <span className="profile-copy"><strong>Alex Morgan</strong><small>Team member</small></span>
          </div>
        </div>
      </aside>

      <main className="main-area" id="board">
        <header className="topbar">
          <div className="breadcrumbs"><span>Northstar Studio</span><span className="crumb-slash">/</span><strong>{title}</strong></div>
          <div className="topbar-actions">
            <span className="today-label"><Clock3 size={14} />{TODAY_LABEL}</span>
            <div className="avatar-stack" aria-label="5 team members">
              {MEMBERS.slice(0, 4).map((member) => <span className={`avatar avatar-${member.color}`} key={member.name} title={member.name}>{member.initials}</span>)}
              <span className="avatar avatar-more">+1</span>
            </div>
          </div>
        </header>

        <div className="board-content">
          <section className="board-heading">
            <div>
              <div className="eyebrow"><span className="eyebrow-line" />YOUR TEAM, IN MOTION</div>
              <h1>{title}<span className="heading-period">.</span></h1>
              <p className="board-subtitle">Small steps, shared progress.</p>
            </div>
            <button className="primary-button" type="button" onClick={() => setIsFormOpen(true)}>
              <Plus size={17} strokeWidth={2.5} /> Add a task
            </button>
          </section>

          <section className="stats-row" aria-label="Task summary">
            <div className="stat-block"><span className="stat-label">OPEN TASKS</span><strong>{openTasks.length.toString().padStart(2, '0')}</strong><span className="stat-caption">across the team</span></div>
            <div className="stat-block stat-focus"><span className="stat-label">IN PROGRESS</span><strong>{tasks.filter((task) => task.status === 'in-progress').length.toString().padStart(2, '0')}</strong><span className="stat-caption">being moved forward</span></div>
            <div className="stat-block"><span className="stat-label">COMPLETED</span><strong>{completedTasks.length.toString().padStart(2, '0')}</strong><span className="stat-caption">nice work, team</span></div>
            <div className="team-progress"><div className="progress-topline"><span>Team momentum</span><strong>{tasks.length ? Math.round(completedTasks.length / tasks.length * 100) : 0}%</strong></div><div className="progress-track"><span style={{ width: `${tasks.length ? completedTasks.length / tasks.length * 100 : 0}%` }} /></div><small>Tasks wrapped up</small></div>
          </section>

          <section className="task-section">
            <div className="list-toolbar">
              <div className="list-heading"><FileText size={17} /><h2>{view === 'completed' ? 'Recently completed' : 'All tasks'}</h2><span className="result-count">{visibleTasks.length}</span></div>
              <div className="toolbar-actions">
                <label className="search-box"><Search size={16} /><input aria-label="Search tasks" placeholder="Search tasks" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
                <span className="sort-button" title="Tasks are sorted by due date"><ArrowDown size={15} /><span>Due date</span></span>
              </div>
            </div>

            <div className="task-list">
              {visibleTasks.length ? visibleTasks.map((task) => (
                <article className={`task-row ${task.status === 'done' ? 'task-done' : ''}`} key={task.id}>
                  <button className={`status-button status-${task.status}`} type="button" onClick={() => advanceTask(task.id)} aria-label={`Change status for ${task.title}`} title={task.status === 'todo' ? 'Start task' : task.status === 'in-progress' ? 'Mark complete' : 'Reopen task'}>
                    {task.status === 'done' ? <Check size={14} /> : task.status === 'in-progress' ? <ArrowUpRight size={14} /> : null}
                  </button>
                  <div className="task-main"><strong>{task.title}</strong><span>{task.project}</span></div>
                  <span className={`priority priority-${task.priority.toLowerCase()}`}><span />{task.priority}</span>
                  <span className="task-due">{task.dueDate ? formatDueDate(task.dueDate) : 'No date'}</span>
                  <span className={`avatar task-assignee avatar-${getMemberColor(task.assignee)}`} title={task.assignee}>{getInitials(task.assignee)}</span>
                </article>
              )) : (
                <div className="empty-state"><span className="empty-icon"><Search size={20} /></span><strong>No tasks found</strong><span>Try another search or add a task to the board.</span></div>
              )}
            </div>
            <button className="add-task-inline" type="button" onClick={() => setIsFormOpen(true)}><Plus size={15} /> Add a task</button>
          </section>

          <footer className="board-footer"><span><span className="footer-indicator" />Board is up to date</span><span>LOCAL PREVIEW <span className="footer-dot">/</span> NORTHSTAR STUDIO</span></footer>
        </div>
      </main>

      {isFormOpen && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setIsFormOpen(false) }}>
          <section className="task-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
            <div className="modal-heading"><div><span className="modal-kicker">TEAM BOARD</span><h2 id="modal-title">Add a task</h2></div><button className="icon-button" type="button" onClick={() => setIsFormOpen(false)} aria-label="Close"><X size={19} /></button></div>
            <form onSubmit={createTask}>
              <label className="form-field"><span>Task name</span><input name="title" placeholder="What needs to get done?" required autoFocus maxLength={120} /></label>
              <label className="form-field"><span>Project <small>Optional</small></span><input name="project" placeholder="e.g. Spring launch" maxLength={48} /></label>
              <div className="form-grid">
                <label className="form-field"><span>Owner</span><select name="assignee" defaultValue={CURRENT_MEMBER}>{MEMBERS.map((member) => <option key={member.name}>{member.name}</option>)}</select></label>
                <label className="form-field"><span>Priority</span><select name="priority" defaultValue="Medium"><option>Low</option><option>Medium</option><option>High</option></select></label>
              </div>
              <label className="form-field"><span>Due date</span><input name="dueDate" type="date" /></label>
              <div className="modal-actions"><button className="cancel-button" type="button" onClick={() => setIsFormOpen(false)}>Cancel</button><button className="primary-button" type="submit"><Plus size={16} /> Create task</button></div>
            </form>
          </section>
        </div>
      )}
    </div>
  )
}

export default App
