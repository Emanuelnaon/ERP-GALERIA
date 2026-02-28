import React, { useState, useEffect } from "react";
import { supabase } from "../../services/supabase";
import {
    Store,
    DollarSign,
    Clock,
    AlertTriangle,
    CheckCircle,
    ArrowLeft,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {
    const [turnosHoy, setTurnosHoy] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    // Simulamos los 4 locales de la galería
    const localesGaleria = [
        { id: 1, nombre: "Zapatería", color: "bg-blue-600" },
        { id: 2, nombre: "Ropa", color: "bg-purple-600" },
        { id: 3, nombre: "Librería", color: "bg-orange-600" },
        { id: 4, nombre: "Regalería", color: "bg-emerald-600" },
    ];

    useEffect(() => {
        cargarEstadoCajas();
    }, []);

    const cargarEstadoCajas = async () => {
        try {
            // Obtenemos la fecha de hoy a la medianoche para filtrar
            const hoyInicio = new Date();
            hoyInicio.setHours(0, 0, 0, 0);

            const { data, error } = await supabase
                .from("turnos_caja")
                .select("*")
                .gte("fecha_apertura", hoyInicio.toISOString()) // Solo los de hoy
                .order("fecha_apertura", { ascending: false });

            if (error) throw error;
            setTurnosHoy(data || []);
        } catch (error) {
            console.error("Error cargando dashboard:", error);
        } finally {
            setLoading(false);
        }
    };

    // Función para encontrar el turno más reciente de un local específico
    const obtenerTurnoLocal = (localId) => {
        return turnosHoy.find((t) => Number(t.local_id) === localId);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white text-xl">
                Cargando métricas de la galería...
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900 text-white p-6 lg:p-10">
            {/* Header del Dashboard */}
            <div className="flex justify-between items-center mb-10 border-b border-gray-800 pb-6">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-3">
                        <Store className="text-blue-500 w-8 h-8" />
                        Centro de Comando Multirubro
                    </h1>
                    <p className="text-gray-400 mt-2">
                        Monitoreo de cajas en tiempo real - Esquina
                    </p>
                </div>

                <button
                    onClick={() => navigate("/pos")}
                    className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 px-6 py-3 rounded-xl transition-colors font-medium border border-gray-700"
                >
                    <ArrowLeft size={20} /> Ir al Mostrador (POS)
                </button>
            </div>

            {/* Grilla de los 4 Locales */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                {localesGaleria.map((local) => {
                    const turno = obtenerTurnoLocal(local.id);
                    const estaAbierto = turno?.estado === "ABIERTO";
                    const estaCerrado = turno?.estado === "CERRADO";

                    return (
                        <div
                            key={local.id}
                            className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden shadow-xl flex flex-col"
                        >
                            {/* Cabecera de la Tarjeta */}
                            <div
                                className={`${local.color} p-4 flex justify-between items-center`}
                            >
                                <h3 className="font-bold text-xl">
                                    {local.nombre}
                                </h3>
                                {estaAbierto ? (
                                    <span className="bg-green-500/20 text-green-100 text-xs font-bold px-3 py-1 rounded-full border border-green-500/30 flex items-center gap-1">
                                        <Clock size={12} /> ABIERTO
                                    </span>
                                ) : estaCerrado ? (
                                    <span className="bg-red-500/20 text-red-100 text-xs font-bold px-3 py-1 rounded-full border border-red-500/30">
                                        CERRADO
                                    </span>
                                ) : (
                                    <span className="bg-gray-900/50 text-gray-300 text-xs font-bold px-3 py-1 rounded-full">
                                        SIN ABRIR HOY
                                    </span>
                                )}
                            </div>

                            {/* Cuerpo de la Tarjeta (Datos Financieros) */}
                            <div className="p-6 flex-1 flex flex-col justify-center">
                                {!turno ? (
                                    <div className="text-center text-gray-500">
                                        <Store className="w-12 h-12 mx-auto mb-2 opacity-20" />
                                        <p>
                                            El empleado aún no abrió la caja
                                            hoy.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <div>
                                            <p className="text-gray-400 text-sm">
                                                Fondo Inicial (Apertura)
                                            </p>
                                            <p className="text-xl font-bold text-gray-200">
                                                $
                                                {Number(
                                                    turno.saldo_inicial,
                                                ).toLocaleString()}
                                            </p>
                                        </div>

                                        <div>
                                            <p className="text-gray-400 text-sm">
                                                Ventas Registradas
                                            </p>
                                            <p className="text-2xl font-bold text-green-400 flex items-center gap-1">
                                                <DollarSign size={20} />
                                                {Number(
                                                    turno.efectivo_esperado,
                                                ).toLocaleString()}
                                            </p>
                                        </div>

                                        {/* Si ya hicieron el Cierre Z, mostramos el resultado */}
                                        {estaCerrado && (
                                            <div
                                                className={`mt-4 p-3 rounded-lg border ${Number(turno.diferencia) === 0 ? "bg-green-500/10 border-green-500/30" : "bg-red-500/10 border-red-500/30"}`}
                                            >
                                                <p className="text-xs text-gray-400 uppercase font-bold mb-1">
                                                    Resultado del Cierre Z
                                                </p>
                                                <div className="flex items-center gap-2">
                                                    {Number(
                                                        turno.diferencia,
                                                    ) === 0 ? (
                                                        <CheckCircle
                                                            size={16}
                                                            className="text-green-500"
                                                        />
                                                    ) : (
                                                        <AlertTriangle
                                                            size={16}
                                                            className="text-red-500"
                                                        />
                                                    )}
                                                    <span
                                                        className={`font-bold ${Number(turno.diferencia) === 0 ? "text-green-400" : "text-red-400"}`}
                                                    >
                                                        {Number(
                                                            turno.diferencia,
                                                        ) === 0
                                                            ? "Caja Cuadrada Exacta"
                                                            : `Diferencia: $${Number(turno.diferencia).toLocaleString()}`}
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
