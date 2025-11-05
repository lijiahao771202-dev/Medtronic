import { useState } from 'react'
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom'
import Home from './pages/Home'
import Agent from './pages/Agent'
import Stats from './pages/Stats'
import Type from './pages/Type'
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
      <div className="app-container">
        {/* 调整背景的虹彩层颜色为 R=0.4, G=0.6, B=0.7 */}
        {/* <Iridescence color={[0.4, 0.6, 0.7]} speed={0.2} mouseReact={true} /> */}
        <nav className="navbar">
          <Link to="/">首页</Link>
          <Link to="/agent">智能体</Link>
          <Link to="/stats">统计</Link>
          <Link to="/type">类型</Link>
        </nav>

        <div className="content-area">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/agent" element={<Agent />} />
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
