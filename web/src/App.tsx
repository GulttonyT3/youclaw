import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Shell } from './components/layout/Shell'
import { Chat } from './pages/Chat'
import { Agents } from './pages/Agents'
import { Placeholder } from './pages/Placeholder'

export default function App() {
  return (
    <BrowserRouter>
      <Shell>
        <Routes>
          <Route path="/" element={<Chat />} />
          <Route path="/agents" element={<Agents />} />
          <Route path="/tasks" element={<Placeholder title="Tasks" />} />
          <Route path="/memory" element={<Placeholder title="Memory" />} />
          <Route path="/skills" element={<Placeholder title="Skills" />} />
          <Route path="/system" element={<Placeholder title="System" />} />
        </Routes>
      </Shell>
    </BrowserRouter>
  )
}
