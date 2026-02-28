import React, { useState } from "react";
import { Wallet, AlertCircle } from "lucide-react";
import { supabase } from "../services/supabase"; // Ajustá esta ruta a tu archivo de Supabase

export default function AperturaCajaModal({
    localId,
    usuarioId,
    onCajaAbierta,
}) {
    const [saldoInicial, setSaldoInicial] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleAbrirCaja = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        // Convertimos a número para asegurar
        const monto = parseFloat(saldoInicial);

        if (isNaN(monto) || monto < 0) {
            setError("Por favor, ingresá un monto válido.");
            setLoading(false);
            return;
        }

        try {
            const { data, error: supabaseError } = await supabase
                .from("turnos_caja")
                .insert([
                    {
                        local_id: localId,
                        usuario_id: usuarioId,
                        saldo_inicial: monto,
                        estado: "ABIERTO",
                    },
                ])
                .select()
                .single();

            if (supabaseError) throw supabaseError;

            // Si salió bien, le avisamos al componente padre (el POS) que ya puede vender
            onCajaAbierta(data);
        } catch (err) {
            console.error("Error al abrir caja:", err);
            setError("Hubo un problema al abrir la caja. Intentá de nuevo.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
                {/* Cabecera del Modal */}
                <div className="bg-blue-600 p-6 text-center">
                    <div className="bg-white/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Wallet className="w-8 h-8 text-white" />
                    </div>
                    <h2 className="text-2xl font-bold text-white">
                        Apertura de Caja
                    </h2>
                    <p className="text-blue-100 mt-1">
                        Ingresá el cambio inicial para empezar a vender
                    </p>
                </div>

                {/* Formulario */}
                <form onSubmit={handleAbrirCaja} className="p-6">
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Efectivo en caja (Pesos)
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
                                value={saldoInicial}
                                onChange={(e) =>
                                    setSaldoInicial(e.target.value)
                                }
                                className="w-full pl-10 pr-4 py-4 text-2xl font-bold text-gray-900 bg-gray-50 border-2 border-gray-200 rounded-xl focus:ring-0 focus:border-blue-600 transition-colors"
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="mb-6 flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg">
                            <AlertCircle className="w-5 h-5 flex-shrink-0" />
                            <span className="text-sm font-medium">{error}</span>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading || !saldoInicial}
                        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-bold py-4 rounded-xl transition-colors shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2"
                    >
                        {loading
                            ? "Abriendo turno..."
                            : "Abrir Caja y Comenzar"}
                    </button>
                </form>
            </div>
        </div>
    );
}
