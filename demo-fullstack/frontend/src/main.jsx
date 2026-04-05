import React from 'react'
import ReactDOM from 'react-dom/client'
import './styles.css'

function App() {
  const [health, setHealth] = React.useState(null)
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/health')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setHealth(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  React.useEffect(() => {
    load()
  }, [])

  return (
    <main className="app">
      <h1>Demo Fullstack Sandbox</h1>
      <p>This frontend calls a Go backend, which checks PostgreSQL.</p>
      <button onClick={load} disabled={loading}>
        {loading ? 'Checking…' : 'Refresh health'}
      </button>
      {error && <pre className="error">{error}</pre>}
      {health && <pre className="card">{JSON.stringify(health, null, 2)}</pre>}
    </main>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
