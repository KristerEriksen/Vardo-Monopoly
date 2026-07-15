import { BrowserRouter, Routes, Route } from "react-router-dom";
import Intro from "./pages/Intro";
import GamePage from "./pages/GamePage";
import "./styles/board.css";
import "./styles/ui.css";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Intro />} />
        <Route path="/Game" element={<GamePage />} />
      </Routes>
    </BrowserRouter>
  );
}
