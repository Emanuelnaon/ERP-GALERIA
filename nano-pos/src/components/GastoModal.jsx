import React, { useState } from "react";
import { supabase } from "../services/supabase";
import { HandCoins, X } from "lucide-react";

export default function GastoModal({ turnoId, onClose, onGastoRegistrado }) {
    const [monto, setMonto] = useState("");
    const [descripcion, setDescripcion] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleRegistrarGasto = async (e) => {
        e.preventDefault();
        if (!monto || !descripcion) {
            setError("Completá el monto y el motivo del retiro.");
            return;
        }

        setLoading(true);
        setError(null);

        try {
            // SOLO GUARDAMOS EL COMPROBANTE DEL GASTO
            const { error: errorGasto } = await supabase
                .from("gastos_caja")
                .insert([
                    {
                        turno_id: turnoId,
                        monto: Number(monto),
                        descripcion: descripcion,
                    },
                ]);

            if (errorGasto) throw errorGasto;

            // Avisamos al POS que se guardó
            onGastoRegistrado(Number(monto));
        } catch (err) {
            console.error("Error al registrar gasto:", err);
            setError("Hubo un problema. Intentá de nuevo.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm p-4">
            <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden text-white relative">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-white"
                >
                    <X size={24} />
                </button>

                <div className="bg-orange-600/20 border-b border-orange-500/30 p-6 text-center">
                    <div className="bg-orange-500/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                        <HandCoins className="w-8 h-8 text-orange-500" />
                    </div>
                    <h2 className="text-2xl font-bold">Retiro de Efectivo</h2>
                    <p className="text-gray-400 mt-1">
                        Registrá salidas de plata de la caja
                    </p>
                </div>

                <div className="p-6">
                    <form onSubmit={handleRegistrarGasto}>
                        <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                Monto a retirar
                            </label>
                            <div className="relative">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 font-bold">
                                    $
                                </span>
                                <input
                                    type="number"
                                    min="1"
                                    autoFocus
                                    value={monto}
                                    onChange={(e) => setMonto(e.target.value)}
                                    className="w-full pl-10 pr-4 py-3 text-xl font-bold text-gray-900 bg-gray-50 border-2 border-gray-200 rounded-xl focus:ring-0 focus:border-orange-500 transition-colors"
                                    placeholder="0.00"
                                />
                            </div>
                        </div>

                        <div className="mb-6">
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                Motivo / Descripción
                            </label>
                            <input
                                type="text"
                                value={descripcion}
                                onChange={(e) => setDescripcion(e.target.value)}
                                className="w-full px-4 py-3 text-lg text-gray-900 bg-gray-50 border-2 border-gray-200 rounded-xl focus:ring-0 focus:border-orange-500 transition-colors"
                                placeholder="Ej: Pago a proveedor de limpieza"
                            />
                        </div>

                        {error && (
                            <p className="text-red-400 mb-4 text-center font-medium">
                                {error}
                            </p>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-4 rounded-xl transition-colors shadow-lg flex items-center justify-center"
                        >
                            {loading ? "Registrando..." : "Confirmar Retiro"}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
