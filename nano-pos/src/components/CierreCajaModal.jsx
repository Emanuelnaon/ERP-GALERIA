import React, { useState, useEffect } from "react";
import { Lock, AlertTriangle, CheckCircle, X } from "lucide-react";
import { supabase } from "../services/supabase";

export default function CierreCajaModal({ turno, onClose, onCierreExitoso }) {
    const [efectivoDeclarado, setEfectivoDeclarado] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [totalGastos, setTotalGastos] = useState(0);

    // Buscamos los gastos de este turno específico
    useEffect(() => {
        const fetchGastos = async () => {
            const { data } = await supabase
                .from("gastos_caja")
                .select("monto")
                .eq("turno_id", turno.id);

            const sum =
                data?.reduce((acc, curr) => acc + Number(curr.monto), 0) || 0;
            setTotalGastos(sum);
        };
        fetchGastos();
    }, [turno.id]);

    // MATEMÁTICA CONTABLE REAL
    const saldoInicial = Number(turno.saldo_inicial) || 0;
    const efectivoVentas = Number(turno.efectivo_esperado) || 0; // Ganancia pura

    // Lo que debe haber físicamente en el cajón de madera:
    const totalEsperado = saldoInicial + efectivoVentas - totalGastos;

    const declarado = Number(efectivoDeclarado) || 0;
    const diferencia = declarado - totalEsperado;

    const handleCerrarCaja = async (e) => {
        e.preventDefault();

        if (efectivoDeclarado === "") {
            setError("Debes ingresar el efectivo que contaste.");
            return;
        }

        const confirmacion = window.confirm(
            `Estás por cerrar la caja con un ${diferencia < 0 ? "FALTANTE" : "SOBRANTE/CUADRE"} de $${diferencia}. ¿Confirmar?`,
        );
        if (!confirmacion) return;

        setLoading(true);
        setError(null);

        try {
            const { error: supabaseError } = await supabase
                .from("turnos_caja")
                .update({
                    estado: "CERRADO",
                    efectivo_declarado: declarado,
                    diferencia: diferencia,
                    fecha_cierre: new Date().toISOString(),
                })
                .eq("id", turno.id);

            if (supabaseError) throw supabaseError;

            onCierreExitoso();
        } catch (err) {
            console.error("Error al cerrar caja:", err);
            setError("Hubo un problema al cerrar la caja. Intentá de nuevo.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm p-4">
            <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden text-white relative">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-white"
                >
                    <X size={24} />
                </button>

                <div className="bg-red-600/20 border-b border-red-500/30 p-6 text-center">
                    <div className="bg-red-500/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Lock className="w-8 h-8 text-red-500" />
                    </div>
                    <h2 className="text-2xl font-bold">
                        Cierre de Caja (Arqueo)
                    </h2>
                    <p className="text-gray-400 mt-1">
                        Contá los billetes del cajón antes de cerrar
                    </p>
                </div>

                <div className="p-6 bg-gray-800/50">
                    {/* RESUMEN CONTABLE CLARO */}
                    <div className="space-y-3 mb-6 text-lg">
                        <div className="flex justify-between text-gray-300">
                            <span>Fondo Inicial (No es Venta):</span>
                            <span>${saldoInicial}</span>
                        </div>
                        <div className="flex justify-between text-green-400 font-bold">
                            <span>Ventas del Día (Ingreso Real):</span>
                            <span>+ ${efectivoVentas}</span>
                        </div>
                        {totalGastos > 0 && (
                            <div className="flex justify-between text-orange-400">
                                <span>Retiros de Efectivo (Gastos):</span>
                                <span>- ${totalGastos}</span>
                            </div>
                        )}
                        <div className="flex justify-between font-bold text-xl border-t border-gray-700 pt-3">
                            <span>Efectivo Físico Esperado:</span>
                            <span className="text-blue-400">
                                ${totalEsperado}
                            </span>
                        </div>
                    </div>

                    <form onSubmit={handleCerrarCaja}>
                        <div className="mb-6">
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                ¿Cuánto efectivo real hay en la caja?
                            </label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-xl">
                                    $
                                </span>
                                <input
                                    type="number"
                                    min="0"
                                    step="100"
                                    autoFocus
                                    value={efectivoDeclarado}
                                    onChange={(e) =>
                                        setEfectivoDeclarado(e.target.value)
                                    }
                                    className="w-full pl-10 pr-4 py-4 text-2xl font-bold text-gray-900 bg-gray-50 border-2 border-gray-200 rounded-xl focus:ring-0 focus:border-red-500 transition-colors"
                                    placeholder="0.00"
                                />
                            </div>
                        </div>

                        {efectivoDeclarado !== "" && (
                            <div
                                className={`mb-6 flex items-center gap-3 p-4 rounded-xl border ${diferencia === 0 ? "bg-green-500/10 border-green-500/50 text-green-400" : diferencia > 0 ? "bg-blue-500/10 border-blue-500/50 text-blue-400" : "bg-red-500/10 border-red-500/50 text-red-400"}`}
                            >
                                {diferencia < 0 ? (
                                    <AlertTriangle size={24} />
                                ) : (
                                    <CheckCircle size={24} />
                                )}
                                <div>
                                    <p className="font-bold">
                                        {diferencia === 0
                                            ? "¡La caja cuadra perfecto!"
                                            : diferencia > 0
                                              ? `Sobrante de caja: $${diferencia}`
                                              : `Faltante de caja: $${Math.abs(diferencia)}`}
                                    </p>
                                    {diferencia < 0 && (
                                        <p className="text-sm opacity-80">
                                            Revisá si diste mal un vuelto.
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}

                        {error && (
                            <p className="text-red-400 mb-4 text-center font-medium">
                                {error}
                            </p>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-xl transition-colors shadow-lg shadow-red-600/30 flex items-center justify-center gap-2"
                        >
                            {loading
                                ? "Cerrando turno..."
                                : "Confirmar Cierre Z"}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
