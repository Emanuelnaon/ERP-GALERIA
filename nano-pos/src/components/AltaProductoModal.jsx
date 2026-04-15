import { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { X, Save, Box, Barcode, DollarSign } from 'lucide-react';

export default function AltaProductoModal({ localId, onClose, onGuardado }) {
    const [nombre, setNombre] = useState('');
    const [precio, setPrecio] = useState('');
    const [stock, setStock] = useState('10');
    const [codigo, setCodigo] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        // Foco automático al código para escanear directo
        const input = document.getElementById('input-codigo');
        if (input) input.focus();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (loading) return;
        setLoading(true);

        try {
            const { data: producto, error: errProd } = await supabase
                .from('productos')
                .insert([
                    {
                        nombre: nombre.toUpperCase(),
                        precio_base: Number(precio),
                        local_id: localId,
                    },
                ])
                .select()
                .single();

            if (errProd) throw errProd;

            const { error: errVar } = await supabase.from('variantes').insert([
                {
                    producto_id: producto.id,
                    local_id: localId,
                    codigo_barras: codigo,
                    stock_actual: Number(stock),
                    talle: 'U',
                },
            ]);

            if (errVar) throw errVar;

            onGuardado(producto.nombre);
            onClose();
        } catch (error) {
            console.error('Error:', error);
            alert('Error al guardar.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="flex justify-between items-center p-4 border-b border-gray-800">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Box className="text-blue-500" /> Carga con Lector
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white">
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-gray-400 text-sm font-bold mb-1">Escaneá el Código</label>
                        <div className="relative">
                            <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
                            <input
                                id="input-codigo"
                                type="text"
                                required
                                value={codigo}
                                onChange={(e) => setCodigo(e.target.value)}
                                className="w-full bg-gray-800 text-white rounded-lg py-2.5 pl-10 border border-gray-700 focus:border-blue-500 outline-none"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-gray-400 text-sm font-bold mb-1">Nombre del Artículo</label>
                        <input
                            type="text"
                            required
                            value={nombre}
                            onChange={(e) => setNombre(e.target.value)}
                            className="w-full bg-gray-800 text-white rounded-lg py-2.5 px-3 border border-gray-700 focus:border-blue-500 outline-none uppercase"
                            placeholder="EJ: REMERA NIKE DRY"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-gray-400 text-sm font-bold mb-1">Precio</label>
                            <div className="relative">
                                <DollarSign
                                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
                                    size={18}
                                />
                                <input
                                    type="number"
                                    required
                                    value={precio}
                                    onChange={(e) => setPrecio(e.target.value)}
                                    className="w-full bg-gray-800 text-white rounded-lg py-2.5 pl-9 border border-gray-700 focus:border-blue-500 outline-none font-bold"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-gray-400 text-sm font-bold mb-1">Stock Inicial</label>
                            <input
                                type="number"
                                required
                                value={stock}
                                onChange={(e) => setStock(e.target.value)}
                                className="w-full bg-gray-800 text-white rounded-lg py-2.5 px-3 border border-gray-700 focus:border-blue-500 outline-none font-bold text-center"
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full mt-4 bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-colors">
                        {loading ? (
                            'Guardando...'
                        ) : (
                            <>
                                <Save size={20} /> GUARDAR PRODUCTO
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
}
