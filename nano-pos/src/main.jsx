import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"; // <--- IMPORTANTE
import App from "./App.jsx";
import "./index.css";

// Creamos el cliente que gestionará la caché y la estabilidad de los datos
const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 0, 
            refetchOnWindowFocus: true, // Si el usuario vuelve a la pestaña, actualizamos
        },
    },
});

ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
        <QueryClientProvider client={queryClient}>
            {" "}
            {/* <--- ENVUELVE LA APP */}
            <BrowserRouter>
                <App />
            </BrowserRouter>
        </QueryClientProvider>
    </React.StrictMode>,
);
