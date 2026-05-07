import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import InputPage from './pages/InputPage';
import QueuePage from './pages/QueuePage';
import PromoterPage from './pages/PromoterPage';
import PlayerCardPage from './pages/PlayerCardPage';
import AdminPanel from './pages/AdminPanel';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<div className="app-container"><InputPage /></div>} />
        <Route path="/queue" element={<div className="app-container"><QueuePage /></div>} />
        <Route path="/promoter" element={<div className="app-container"><PromoterPage /></div>} />
        <Route path="/player-card" element={<PlayerCardPage />} />
        <Route path="/admin" element={<div className="app-container"><AdminPanel /></div>} />
      </Routes>
    </Router>
  );
}

export default App;
