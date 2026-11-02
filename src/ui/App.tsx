import { firebaseConfig } from '../transport/firebaseConfig'
import { Home } from './screens/Home'

export default function App() {
  return (
    <div className="app">
      <main className="app-main">
        <Home />
      </main>

      <footer className="app-footer">
        {import.meta.env.MODE} · {firebaseConfig.projectId}
      </footer>
    </div>
  )
}
