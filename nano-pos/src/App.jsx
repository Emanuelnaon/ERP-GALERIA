import { Routes, Route, BrowserRouter } from 'react-router-dom';
import Login from './pages/Auth/Login';
import POS from './pages/POS/POS';
import Dashboard from './pages/Admin/Dashboard';

function App() {
    return (
        
            <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/pos" element={<POS />} />
                <Route path="/dashboard" element={<Dashboard />} />
            </Routes>
        
    );
}

export default App;
