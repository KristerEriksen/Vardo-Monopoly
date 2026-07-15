import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// StrictMode er med vilje ikke brukt: dobbel-mount i dev åpner to
// socket-tilkoblinger, og backend legger da til spøkelsesspillere.
createRoot(document.getElementById('root')).render(<App />)
