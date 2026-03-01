import { Search, ShoppingCart, LayoutDashboard, LogOut } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import { useNavigate } from 'react-router-dom';
import AperturaCajaModal from '../../components/AperturaCajaModal';
// 1. NUEVO: Importamos el Modal de Cierre de Caja
import CierreCajaModal from '../../components/CierreCajaModal';
import GastoModal from '../../components/GastoModal';

export default function POS() {
    const [searchTerm, setSearchTerm] = useState('');
    const [products, setProducts] = useState([]);
    const [cart, setCart] = useState([]);
    const [loading, setLoading] = useState(false);

    const [cajaAbierta, setCajaAbierta] = useState(null);
    const [verificandoCaja, setVerificandoCaja] = useState(true);
    const [usuarioActual, setUsuarioActual] = useState(null);

    // 2. NUEVO: Estado para controlar si mostramos la pantalla de cierre
    const [mostrarCierre, setMostrarCierre] = useState(false);
    const [mostrarGasto, setMostrarGasto] = useState(false);

    // Borrá el const LOCAL_ACTUAL_ID = 2; y poné esto:
    const [localActualId, setLocalActualId] = useState(null);
    const [rolUsuario, setRolUsuario] = useState('empleado');
    const navigate = useNavigate();
    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate('/login');
    };
    // --- VERIFICAR CAJA AL ENTRAR AL POS ---
    useEffect(() => {
        const initPOS = async () => {
            setVerificandoCaja(true);
            try {
                const {
                    data: { user },
                } = await supabase.auth.getUser();
                setUsuarioActual(user);

                if (user) {
                    // Buscamos su perfil para saber en qué caja trabaja
                    const { data: perfil } = await supabase
                        .from('profiles')
                        .select('rol, local_id')
                        .eq('id', user.id)
                        .single();

                    const localAsignado = perfil?.local_id || 1; // Por defecto lo mandamos a la caja 1
                    setLocalActualId(localAsignado);
                    setRolUsuario(perfil?.rol || 'empleado');

                    const { data, error } = await supabase
                        .from('turnos_caja')
                        .select('*')
                        .eq('local_id', localAsignado) // Usamos su local asignado
                        .eq('estado', 'ABIERTO')
                        .maybeSingle();

                    if (error) throw error;
                    if (data) setCajaAbierta(data);
                }
            } catch (error) {
                console.error('Error verificando caja:', error);
            } finally {
                setVerificandoCaja(false);
            }
        };

        initPOS();
    }, []);

    // --- BUSCADOR ---
    const searchProducts = async (term) => {
        if (!term) {
            setProducts([]);
            return;
        }
        setLoading(true);

        const { data, error } = await supabase
            .from('variantes')
            .select(`id, codigo_barras, stock_actual, talle, precio:productos(precio_base, nombre)`)
            .ilike('productos.nombre', `%${term}%`)
            .limit(10);

        if (!error) {
            const formatted = data
                .map((item) => ({
                    id: item.id,
                    nombre: item.precio?.nombre || 'DESCONOCIDO',
                    precio: item.precio?.precio_base || 0,
                    talle: item.talle,
                    stock: item.stock_actual,
                    codigo: item.codigo_barras,
                }))
                .filter((item) => item.nombre !== 'DESCONOCIDO');

            setProducts(formatted);
        }
        setLoading(false);
    };

    useEffect(() => {
        const timeout = setTimeout(() => {
            if (searchTerm.trim().length > 0) {
                searchProducts(searchTerm);
            } else {
                setProducts([]);
            }
        }, 300);
        return () => clearTimeout(timeout);
    }, [searchTerm]);

    // --- CARRITO ---
    const addToCart = (product) => {
        setCart((currentCart) => {
            const exists = currentCart.find((item) => item.id === product.id);
            if (exists) {
                return currentCart.map((item) =>
                    item.id === product.id ? { ...item, cantidad: item.cantidad + 1 } : item,
                );
            }
            return [...currentCart, { ...product, cantidad: 1 }];
        });
    };

    const total = cart.reduce((acc, item) => acc + item.precio * item.cantidad, 0);

    // --- COBRAR ---
    const handleCheckout = async () => {
        if (cart.length === 0) return;

        if (!cajaAbierta) {
            alert('Bloqueo de seguridad: No podés vender sin abrir la caja.');
            return;
        }

        const confirm = window.confirm(`¿Confirmar venta por $${total}?`);
        if (!confirm) return;

        setLoading(true);

        try {
            if (!usuarioActual) throw new Error('No hay sesión activa');

            const ventaData = {
                p_local_id: localActualId,
                p_vendedor_id: usuarioActual.id,
                p_turno_id: cajaAbierta.id,
                p_total: total,
                p_metodo_pago: 'efectivo',
                p_detalles: cart,
            };

            const { data, error } = await supabase.rpc('procesar_venta', ventaData);

            if (error) throw error;

            alert(`✅ Venta #${data} registrada con éxito!`);

            // Actualizamos la caja localmente para que el cierre Z tenga los datos frescos
            setCajaAbierta((prev) => ({
                ...prev,
                efectivo_esperado: Number(prev.efectivo_esperado) + total,
            }));

            setCart([]);
            setSearchTerm('');
            setProducts([]);
        } catch (error) {
            console.error(error);
            alert('❌ Error al procesar la venta: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    // --- ATAJO F10 ---
    useEffect(() => {
        const manejarTeclas = (evento) => {
            if (evento.key === 'F10') {
                evento.preventDefault();
                if (cart.length > 0 && !loading && cajaAbierta && !mostrarCierre) {
                    handleCheckout();
                }
            }
        };

        window.addEventListener('keydown', manejarTeclas);
        return () => window.removeEventListener('keydown', manejarTeclas);

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cart, loading, cajaAbierta, mostrarCierre]);

    if (verificandoCaja) {
        return (
            <div className="flex h-screen items-center justify-center bg-gray-900 text-white text-xl">
                Iniciando terminal de cobro...
            </div>
        );
    }

    return (
        <div className="flex h-screen bg-gray-900 text-white overflow-hidden relative">
            {/* --- MODAL DE APERTURA --- */}
            {!cajaAbierta && (
                <div className="absolute inset-0 z-50">
                    <AperturaCajaModal
                        localId={localActualId}
                        usuarioId={usuarioActual?.id}
                        onCajaAbierta={(nuevoTurno) => setCajaAbierta(nuevoTurno)}
                    />
                </div>
            )}

            {/* --- 3. NUEVO: MODAL DE CIERRE Z --- */}
            {mostrarCierre && cajaAbierta && (
                <div className="absolute inset-0 z-50">
                    <CierreCajaModal
                        turno={cajaAbierta}
                        onClose={() => setMostrarCierre(false)}
                        onCierreExitoso={() => {
                            setMostrarCierre(false);
                            setCajaAbierta(null); // Esto bloquea el POS y pide abrir caja de nuevo
                            alert('✅ ¡Turno cerrado exitosamente! El arqueo fue guardado.');
                            navigate('/dashboard');
                        }}
                    />
                </div>
            )}

            {/* --- MODAL DE GASTOS --- */}
            {mostrarGasto && cajaAbierta && (
                <div className="absolute inset-0 z-50">
                    <GastoModal
                        turnoId={cajaAbierta.id}
                        onClose={() => setMostrarGasto(false)}
                        onGastoRegistrado={(montoRetirado) => {
                            setMostrarGasto(false);
                            // YA NO RESTAMOS LA PLATA ACÁ. Las ventas quedan intactas.
                            alert(`✅ Gasto registrado. Se retiraron $${montoRetirado} de la caja física.`);
                        }}
                    />
                </div>
            )}

            {/* --- CONTENEDOR PRINCIPAL RESPONSIVO --- */}
            <div
                className={`flex flex-col lg:flex-row w-full h-full ${!cajaAbierta || mostrarCierre ? 'blur-md pointer-events-none' : ''}`}>
                {/* SECCIÓN IZQUIERDA: Buscador y Productos */}
                <div className="w-full lg:w-[70%] xl:w-[75%] p-4 lg:p-6 flex flex-col border-b lg:border-b-0 lg:border-r border-gray-800 h-[60vh] lg:h-full">
                    {/* Encabezado con Botones */}
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-2xl font-bold flex items-center gap-2">
                            <Search className="text-blue-500" /> Catálogo
                        </h2>

                        <div className="flex gap-3">
                            {/* 4. NUEVO: BOTÓN DE CERRAR CAJA */}
                            <button
                                onClick={() => setMostrarCierre(true)}
                                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-bold text-white transition-colors shadow-lg">
                                Cerrar Caja
                            </button>

                            <button
                                onClick={() => setMostrarGasto(true)}
                                className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 rounded-lg text-sm font-bold text-white transition-colors shadow-lg">
                                Retirar Efectivo
                            </button>
                            <button
                                onClick={handleLogout}
                                className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-red-400 transition-colors border border-gray-700">
                                <LogOut size={16} />
                                Salir
                            </button>
                            {rolUsuario === 'dueño' && (
                                <button
                                    onClick={() => navigate('/dashboard')}
                                    className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-300 transition-colors border border-gray-700">
                                    <LayoutDashboard size={16} />
                                    Admin
                                </button>
                            )}
                        </div>
                    </div>

                    <input
                        autoFocus
                        type="text"
                        placeholder="Escribe 'zapatilla' o escanea código..."
                        className="w-full p-4 bg-gray-800 rounded-xl text-lg border border-gray-700 focus:border-blue-500 focus:outline-none mb-6"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />

                    <div className="flex-1 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 content-start pr-2">
                        {products.map((p) => (
                            <div
                                key={p.id}
                                onClick={() => addToCart(p)}
                                className="bg-gray-800 p-4 rounded-lg border border-gray-700 hover:border-blue-500 cursor-pointer transition-all active:scale-95">
                                <h3 className="font-bold text-lg">{p.nombre}</h3>
                                <div className="flex justify-between mt-2 text-gray-400">
                                    <span>{p.talle ? `Talle: ${p.talle}` : 'Unitario'}</span>
                                    <span className={p.stock < 2 ? 'text-red-500' : 'text-green-500'}>
                                        Stock: {p.stock}
                                    </span>
                                </div>
                                <div className="mt-3 text-2xl font-bold text-blue-400">${p.precio}</div>
                            </div>
                        ))}
                        {products.length === 0 && !loading && searchTerm && (
                            <p className="text-gray-500 col-span-full text-center mt-10">
                                No se encontraron productos.
                            </p>
                        )}
                    </div>
                </div>

                {/* SECCIÓN DERECHA: Ticket / Carrito */}
                <div className="w-full lg:w-[30%] xl:w-[25%] bg-gray-950 p-4 lg:p-6 flex flex-col shadow-2xl h-[40vh] lg:h-full">
                    <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                        <ShoppingCart className="text-green-500" /> Ticket Actual
                    </h2>

                    <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                        {cart.map((item) => (
                            <div
                                key={item.id}
                                className="flex justify-between items-center bg-gray-900 p-3 rounded border border-gray-800">
                                <div>
                                    <div className="font-bold">{item.nombre}</div>
                                    <div className="text-sm text-gray-400">
                                        ${item.precio} x {item.cantidad}
                                    </div>
                                </div>
                                <div className="font-bold text-xl">${item.precio * item.cantidad}</div>
                            </div>
                        ))}
                        {cart.length === 0 && (
                            <div className="h-full flex flex-col items-center justify-center text-gray-600 opacity-50">
                                <ShoppingCart size={48} />
                                <p className="mt-2">El carrito está vacío</p>
                            </div>
                        )}
                    </div>

                    <div className="mt-6 border-t border-gray-800 pt-6">
                        <div className="flex justify-between items-end mb-6">
                            <span className="text-gray-400 text-lg">Total a Pagar</span>
                            <span className="text-4xl font-bold text-green-500">${total}</span>
                        </div>

                        <button
                            onClick={handleCheckout}
                            disabled={cart.length === 0 || loading}
                            className={`w-full py-5 rounded-xl font-bold text-xl text-white shadow-lg transition-all 
                                ${loading ? 'bg-gray-600 cursor-not-allowed' : 'bg-green-600 hover:bg-green-500'}`}>
                            {loading ? 'Procesando...' : 'COBRAR (F10)'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
