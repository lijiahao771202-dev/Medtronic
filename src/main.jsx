import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
// import ColorBends from './components/ColorBends'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* 调整 ColorBends 的配色以贴近 R=0.4, G=0.6, B=0.7 的冷色系 */}
    {/* <ColorBends
      style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: -1 }}
      colors={["#5aa0b3", "#6fb6d9", "#3d566e"]}
      rotation={30}
      speed={0.25}
      scale={1.15}
      frequency={1.3}
      warpStrength={1.1}
      mouseInfluence={0.75}
      parallax={0.6}
      noise={0.06}
      transparent
    /> */}
    <App />
  </StrictMode>,
)
