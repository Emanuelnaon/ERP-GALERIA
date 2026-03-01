import React, { useState, useEffect } from 'react';
import { Wallet, AlertCircle } from 'lucide-react';
import { supabase } from '../services/supabase';

export default function AperturaCajaModal({ localId, usuarioId, onCajaAbierta, rolUsuario }) {
    const [saldoInicial, setSaldoInicial] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null); // Solución al error de ESLint
    const [cajaExistente, setCajaExistente] = useState(null);

    // 1. Verificar si ya hay una caja abierta (Relevo)
    useEffect(() => {
        const revisarCaja = async () => {
            if (!localId) return;
            const { data } = await supabase
                .from('turnos_caja')
                .select('*')
                .eq('local_id', localId)
                .eq('estado', 'ABIERTO')
                .maybeSingle();

            if (data) setCajaExistente(data);
        };
        revisarCaja();
    }, [localId]);

    // 2. Función única para manejar el envío del formulario
    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        // CASO A: Es un relevo (ya hay caja abierta)
        if (cajaExistente) {
            onCajaAbierta(cajaExistente);
            setLoading(false);
            return;
        }

        // CASO B: Es una apertura nueva
        const monto = parseFloat(saldoInicial);
        if (isNaN(monto) || monto < 0) {
            setError('Por favor, ingresá un monto válido.');
            setLoading(false);
            return;
        }

        try {
            const { data, error: supabaseError } = await supabase
                .from('turnos_caja')
                .insert([
                    {
                        local_id: localId,
                        usuario_id: usuarioId,
                        saldo_inicial: monto,
                        estado: 'ABIERTO',
                    },
                ])
                .select()
                .single();

            if (supabaseError) throw supabaseError;

            onCajaAbierta(data);
        } catch (err) {
            console.error('Error al abrir caja:', err);
            setError('Hubo un problema al abrir la caja. Intentá de nuevo.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
                {/* Cabecera dinámica */}
                <div className="bg-blue-600 p-6 text-center">
                    <div className="bg-white/20 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Wallet className="w-8 h-8 text-white" />
                    </div>
                    <h2 className="text-2xl font-bold text-white">
                        {cajaExistente ? 'Relevo de Turno' : 'Apertura de Caja'}
                    </h2>
                    <p className="text-blue-100 mt-1">
                        {cajaExistente
                            ? 'Hay una caja abierta. Confirma para continuar.'
                            : 'Ingresá el cambio inicial para empezar a vender'}
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="p-6">
                    {/* Solo mostramos el input si NO hay caja existente */}
                    {!cajaExistente && (
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
                                    onChange={(e) => setSaldoInicial(e.target.value)}
                                    className="w-full pl-10 pr-4 py-4 text-2xl font-bold text-gray-900 bg-gray-50 border-2 border-gray-200 rounded-xl focus:ring-0 focus:border-blue-600 transition-colors"
                                />
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="mb-6 flex items-center gap-2 text-red-600 bg-red-50 p-3 rounded-lg">
                            <AlertCircle className="w-5 h-5 flex-shrink-0" />
                            <span className="text-sm font-medium">{error}</span>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading || (!cajaExistente && !saldoInicial)}
                        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-bold py-4 rounded-xl transition-colors shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2">
                        {loading ? 'Procesando...' : cajaExistente ? 'Confirmar y Continuar' : 'Abrir Caja y Comenzar'}
                    </button>

                    <div className="mt-4 flex flex-col gap-2">
                        {/* 🛡️ Seguridad: Solo el Admin ve este botón */}
                        {rolUsuario === 'admin' && (
                            <button
                                type="button"
                                onClick={() => (window.location.href = '/dashboard')}
                                className="text-gray-500 hover:text-gray-700 text-sm font-medium transition-colors">
                                ← Volver al Centro de Comando
                            </button>
                        )}

                        <button
                            type="button"
                            onClick={async () => {
                                await supabase.auth.signOut();
                                window.location.href = '/login';
                            }}
                            className="text-red-400 hover:text-red-500 text-sm font-medium transition-colors">
                            Cerrar Sesión / Cambiar de Usuario
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
