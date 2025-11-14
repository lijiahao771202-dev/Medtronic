import { useState } from 'react'
import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom'
import Home from './pages/Home'
import Agent from './pages/Agent'
import Stats from './pages/Stats'
import Type from './pages/Type'
import GenerateScript from './pages/GenerateScript'
import VoiceCall from './pages/VoiceCall'
import MindfulWalkingMeditation from './pages/MindfulWalkingMeditation'
import BodyScanMeditation from './pages/BodyScanMeditation'
import MindfulSittingMeditation from './pages/MindfulSittingMeditation'
import ThreeMinuteBreathingSpace from './pages/ThreeMinuteBreathingSpace'
// import Iridescence from './components/Iridescence';

import './App.css'

function App() {
  const [count, setCount] = useState(0)

  return (
    <Router>
      <div className="global-bg" aria-hidden="true" />
      <div className="app-container">
        {/* 调整背景的虹彩层颜色为 R=0.4, G=0.6, B=0.7 */}
        {/* <Iridescence color={[0.4, 0.6, 0.7]} speed={0.2} mouseReact={true} /> */}
        <div className="navbar-wrap">
          <nav className="navbar">
            <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>首页</NavLink>
            <NavLink to="/agent" className={({ isActive }) => (isActive ? 'active' : '')}>智能体</NavLink>
            <NavLink to="/stats" className={({ isActive }) => (isActive ? 'active' : '')}>统计</NavLink>
            <NavLink to="/type" className={({ isActive }) => (isActive ? 'active' : '')}>类型</NavLink>
          </nav>
        </div>

        <div className="content-area">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/agent" element={<Agent />} />
            <Route path="/agent/voice" element={<VoiceCall />} />
            <Route path="/agent/generate/:type" element={<GenerateScript />} />
            <Route path="/stats" element={<Stats />} />
            <Route path="/type" element={<Type />} />
            <Route path="/meditation/:type" element={<MindfulWalkingMeditation />} />
            <Route path="/meditation/body-scan" element={<BodyScanMeditation />} />
            <Route path="/meditation/mindful-sitting" element={<MindfulSittingMeditation />} />
            <Route path="/meditation/three-minute-breathing-space" element={<ThreeMinuteBreathingSpace />} />
          </Routes>
        </div>
      </div>
    </Router>
  )
}

export default App
