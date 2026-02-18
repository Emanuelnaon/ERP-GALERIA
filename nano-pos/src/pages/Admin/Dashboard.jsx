import { useQuery } from "@tanstack/react-query"; // <--- La herramienta pro
import { supabase } from "../../services/supabase";
import { useNavigate } from "react-router-dom";
import {
    TrendingUp,
    ShoppingBag,
    DollarSign,
    Calendar,
    ArrowLeft,
    Loader2,
} from "lucide-react";

// Función extractora (separada del componente para evitar recreaciones)
const fetchVentasDelDia = async () => {
    const { data, error } = await supabase
        .from("ventas")
        .select(
            `
      id, 
      total, 
      created_at, 
      metodo_pago
    `,
        )
        .order("created_at", { ascending: false })
        .limit(20);

    if (error) throw new Error(error.message);
    return data;
};

export default function Dashboard() {
    const navigate = useNavigate();

    // useQuery maneja: loading, error, data, caché y reintentos automáticos
    const {
        data: ventas,
        isLoading,
        isError,
        error,
    } = useQuery({
        queryKey: ["ventasDashboard"], // Identificador único para la caché
        queryFn: fetchVentasDelDia,
    });

    // Cálculos derivados (siempre seguros porque 'ventas' o es undefined o es array real)
    const stats = {
        total: ventas?.reduce((acc, v) => acc + v.total, 0) || 0,
        count: ventas?.length || 0,
    };

    // Estado de Carga (UI Feedback)
    if (isLoading)
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-100 text-gray-500">
                <Loader2 className="animate-spin mr-2" /> Cargando métricas...
            </div>
        );

    // Estado de Error (Robustez)
    if (isError)
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-100 text-red-500">
                Error cargando datos: {error.message}
            </div>
        );

    return (
        <div className="min-h-screen bg-gray-100 p-8 text-gray-800">
            {/* Encabezado */}
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold">Panel de Control</h1>
                    <p className="text-gray-500">Resumen en tiempo real</p>
                </div>
                <button
                    onClick={() => navigate("/pos")}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition shadow-sm"
                >
                    <ArrowLeft size={18} /> Volver al Cajero
                </button>
            </div>

            {/* Tarjetas de Métricas */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex items-center justify-between">
                    <div>
                        <p className="text-gray-500 text-sm font-bold uppercase">
                            Ventas Totales
                        </p>
                        <p className="text-3xl font-bold mt-1 text-green-600">
                            ${stats.total.toLocaleString()}
                        </p>
                    </div>
                    <div className="p-3 bg-green-100 text-green-600 rounded-full">
                        <DollarSign size={24} />
                    </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 flex items-center justify-between">
                    <div>
                        <p className="text-gray-500 text-sm font-bold uppercase">
                            Tickets Emitidos
                        </p>
                        <p className="text-3xl font-bold mt-1 text-blue-600">
                            {stats.count}
                        </p>
                    </div>
                    <div className="p-3 bg-blue-100 text-blue-600 rounded-full">
                        <ShoppingBag size={24} />
                    </div>
                </div>
            </div>

            {/* Tabla de Ventas */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-6 border-b border-gray-100">
                    <h2 className="font-bold text-lg flex items-center gap-2">
                        <Calendar size={18} className="text-gray-400" /> Últimas
                        Transacciones
                    </h2>
                </div>
                <table className="w-full text-left">
                    <thead className="bg-gray-50 text-gray-500 text-sm">
                        <tr>
                            <th className="p-4">ID</th>
                            <th className="p-4">Hora</th>
                            <th className="p-4">Pago</th>
                            <th className="p-4 text-right">Total</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {ventas.map((v) => (
                            <tr key={v.id} className="hover:bg-gray-50">
                                <td className="p-4 font-medium">#{v.id}</td>
                                <td className="p-4 text-gray-500">
                                    {new Date(v.created_at).toLocaleTimeString(
                                        [],
                                        { hour: "2-digit", minute: "2-digit" },
                                    )}
                                </td>
                                <td className="p-4 capitalize">
                                    {v.metodo_pago}
                                </td>
                                <td className="p-4 font-bold text-right">
                                    ${v.total}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {ventas.length === 0 && (
                    <div className="p-8 text-center text-gray-400">
                        No hay ventas todavía.
                    </div>
                )}
            </div>
        </div>
    );
}
