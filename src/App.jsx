import { Routes, Route, Navigate } from 'react-router-dom'
import Home from './components/Home'
import Room from './components/Room'

export default function App() {
  return (
    <main className="app">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/r/:code" element={<Room />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </main>
  )
}
