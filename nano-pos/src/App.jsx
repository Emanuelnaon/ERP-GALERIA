import { Routes, Route } from "react-router-dom";
import Login from "./pages/Auth/Login";
import POS from "./pages/POS/POS";
import Dashboard from "./pages/Admin/Dashboard"; // <--- IMPORTANTE: Importar el archivo nuevo

function App() {
    return (
        <Routes>
            <Route path="/" element={<Login />} />
            <Route path="/pos" element={<POS />} />
            <Route path="/dashboard" element={<Dashboard />} />{" "}
            {/* <--- IMPORTANTE: La ruta */}
        </Routes>
    );
}

export default App;
