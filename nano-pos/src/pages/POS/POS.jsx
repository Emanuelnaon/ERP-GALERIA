import { Search, ShoppingCart, LayoutDashboard, LogOut, Store } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import { useNavigate, useLocation } from 'react-router-dom';
import AperturaCajaModal from '../../components/AperturaCajaModal';
import CierreCajaModal from '../../components/CierreCajaModal';
import GastoModal from '../../components/GastoModal';
import TicketVentaModal from '../../components/TicketVentaModal';


const LOCALES_GALERIA = [
    { id: 1, nombre: 'Zapatería' },
    { id: 2, nombre: 'Ropa' },
    { id: 3, nombre: 'Librería' },
    { id: 4, nombre: 'Regalería' },
];

export default function POS() {
    const [searchTerm, setSearchTerm] = useState('');
    const [products, setProducts] = useState([]);
    const [cart, setCart] = useState([]);
    const [loading, setLoading] = useState(false);
    const [ticketData, setTicketData] = useState(null);

    const [cajaAbierta, setCajaAbierta] = useState(null);
    const [verificandoCaja, setVerificandoCaja] = useState(true);
    const [usuarioActual, setUsuarioActual] = useState(null);

    const [mostrarCierre, setMostrarCierre] = useState(false);
    const [mostrarGasto, setMostrarGasto] = useState(false);

    const [localActualId, setLocalActualId] = useState(null);
    const [rolUsuario, setRolUsuario] = useState('vendedor');
    const navigate = useNavigate();
    const location = useLocation();

    const handleLogout = async () => {
        if (cajaAbierta && rolUsuario !== 'admin') {
            alert(
                '⛔ SEGURIDAD: Tu turno está en curso. Debes realizar el Cierre de Caja (botón rojo) y declarar el dinero antes de poder cerrar sesión.',
            );
            return;
        }

        await supabase.auth.signOut();
        navigate('/login');
    };

    // 1. OBTENER USUARIO Y ROL
    useEffect(() => {
        const initUser = async () => {
            setVerificandoCaja(true);
            try {
                const {
                    data: { user },
                } = await supabase.auth.getUser();
                setUsuarioActual(user);

                if (user) {
                    const { data: perfil } = await supabase
                        .from('profiles')
                        .select('user_role, local_id')
                        .eq('id', user.id)
                        .single();

                    const rol = perfil?.user_role || 'vendedor';
                    setRolUsuario(rol);

                    const localRequerido = location.state?.localDestino;
                    const dispositivoBautizado = localStorage.getItem('nano_pos_device_local'); // Leemos la memoria

                    if (rol === 'admin') {
                        // El Admin es Dios: Si viene del Dashboard va a ese local, sino usa el de la PC, sino el 1.
                        setLocalActualId(
                            localRequerido
                                ? Number(localRequerido)
                                : dispositivoBautizado
                                  ? Number(dispositivoBautizado)
                                  : 1,
                        );
                    } else {
                        // El Empleado es mortal: Queda encadenado al dispositivo físico donde está parado.
                        // Si la máquina no está bautizada, usa su local de perfil por defecto.
                        setLocalActualId(dispositivoBautizado ? Number(dispositivoBautizado) : perfil?.local_id || 1);
                    }
                }
            } catch (error) {
                console.error('Error verificando usuario:', error);
            }
        };
        initUser();
    }, [location.state?.localDestino]);

    // 2. BUSCAR CAJA CADA VEZ QUE CAMBIA EL LOCAL
    useEffect(() => {
        if (!localActualId) return;

        const fetchCaja = async () => {
            setVerificandoCaja(true);
            try {
                const { data, error } = await supabase
                    .from('turnos_caja')
                    .select('*')
                    .eq('local_id', localActualId)
                    .eq('estado', 'ABIERTO')
                    .maybeSingle();

                if (error) throw error;
                setCajaAbierta(data || null);
            } catch (error) {
                console.error('Error buscando caja:', error);
            } finally {
                setVerificandoCaja(false);
            }
        };

        fetchCaja();
    }, [localActualId]);

    // --- BUSCADOR ---
    const searchProducts = async (term) => {
        if (!term) return setProducts([]);
        setLoading(true);

        const { data, error } = await supabase
            .from('variantes')
            // 1. 👇 Agregamos "!inner" a productos. Es OBLIGATORIO en Supabase para poder filtrar por una tabla conectada.
            .select(`id, codigo_barras, stock_actual, talle, precio:productos!inner(precio_base, nombre)`)
            // 2. 👇 EL MURO DE SEGURIDAD: Exigimos que el producto pertenezca al local actual
            .eq('productos.local_id', localActualId)
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
        } else {
            console.error('Error buscando productos:', error);
        }
        setLoading(false);
    };

    useEffect(() => {
        const timeout = setTimeout(() => {
            if (searchTerm.trim().length > 0) searchProducts(searchTerm);
            else setProducts([]);
        }, 300);
        return () => clearTimeout(timeout);
    }, [searchTerm]);

    // --- CARRITO Y COBRO ---
    const addToCart = (product) => {
        setCart((currentCart) => {
            const exists = currentCart.find((item) => item.id === product.id);
            const cantidadActual = exists ? exists.cantidad : 0;

            // 🛑 EL MURO DE SEGURIDAD DEL STOCK
            if (cantidadActual + 1 > product.stock) {
                alert(
                    `⚠️ Stock insuficiente. Solo tenés ${product.stock} unidades de "${product.nombre}" en tu local.`,
                );
                return currentCart; // Devolvemos el carrito intacto, no lo dejamos sumar
            }

            if (exists) {
                return currentCart.map((item) =>
                    item.id === product.id ? { ...item, cantidad: item.cantidad + 1 } : item,
                );
            }
            return [...currentCart, { ...product, cantidad: 1 }];
        });
    };

    const total = cart.reduce((acc, item) => acc + item.precio * item.cantidad, 0);

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

            const { data: numeroVenta, error } = await supabase.rpc('procesar_venta', ventaData);
            if (error) throw error;

            const localObj = LOCALES_GALERIA.find((l) => l.id === localActualId);

            setTicketData({
                cart: [...cart], // Hacemos una copia del carrito
                total: total,
                numVenta: numeroVenta,
                localNombre: localObj ? localObj.nombre : 'Local Comercial',
                vendedorEmail: usuarioActual.email,
            });

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
                Iniciando terminal...
            </div>
        );
    }

    const handleRelevo = async () => {
        const confirm = window.confirm(
            '¿Confirmas el relevo? Se cerrará tu sesión pero la caja permanecerá ABIERTA para el siguiente compañero.',
        );
        if (confirm) {
            // Aquí podrías disparar un log en Supabase: "Usuario X entregó a las HH:MM"
            await supabase.auth.signOut();
            navigate('/login');
        }
    };
    return (
        <div className="flex h-screen bg-gray-900 text-white overflow-hidden relative print:bg-white print:h-auto print:overflow-visible">
            {/* MODALES */}
            {!cajaAbierta && (
                <div className="absolute inset-0 z-50">
                    <AperturaCajaModal
                        localId={localActualId}
                        usuarioId={usuarioActual?.id}
                        rolUsuario={rolUsuario}
                        onCajaAbierta={(nuevoTurno) => setCajaAbierta(nuevoTurno)}
                    />
                </div>
            )}

            {mostrarCierre && cajaAbierta && (
                <div className="absolute inset-0 z-50">
                    <CierreCajaModal
                        turno={cajaAbierta}
                        onClose={() => setMostrarCierre(false)}
                        onCierreExitoso={() => {
                            setMostrarCierre(false);
                            setCajaAbierta(null);
                            alert('✅ ¡Turno cerrado exitosamente!');
                            // Si es admin, vuelve al panel. Si es vendedor, se queda para volver a abrir.
                            if (rolUsuario === 'admin') navigate('/dashboard');
                        }}
                    />
                </div>
            )}

            {mostrarGasto && cajaAbierta && (
                <div className="absolute inset-0 z-50">
                    <GastoModal
                        turnoId={cajaAbierta.id}
                        onClose={() => setMostrarGasto(false)}
                        onGastoRegistrado={(monto) => {
                            setMostrarGasto(false);
                            alert(`✅ Gasto registrado: $${monto}.`);
                        }}
                    />
                </div>
            )}

            <div
                className={`flex flex-col lg:flex-row w-full h-full print:hidden ${!cajaAbierta || mostrarCierre ? 'blur-md pointer-events-none' : ''}`}>
                <div className="w-full lg:w-[70%] xl:w-[75%] p-4 lg:p-6 flex flex-col border-b lg:border-b-0 lg:border-r border-gray-800 h-[60vh] lg:h-full">
                    {/* ENCABEZADO Y CONTROLES */}
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-2xl font-bold flex items-center gap-2">
                            <Search className="text-blue-500" /> Catálogo
                        </h2>

                        <div className="flex gap-3 items-center">
                            {/* SELECTOR DE LOCAL (Solo para Admin) */}
                            {rolUsuario === 'admin' && (
                                <div className="flex items-center gap-2 bg-gray-800 px-3 py-2 rounded-lg border border-gray-700">
                                    <Store size={16} className="text-blue-400" />
                                    <select
                                        value={localActualId || 1}
                                        onChange={(e) => setLocalActualId(Number(e.target.value))}
                                        className="bg-transparent text-white font-bold focus:outline-none cursor-pointer">
                                        {LOCALES_GALERIA.map((l) => (
                                            <option key={l.id} value={l.id} className="bg-gray-800">
                                                {l.nombre}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            <button
                                onClick={handleRelevo}
                                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-sm font-bold text-white transition-colors shadow-lg">
                                Relevo de Personal
                            </button>
                            <button
                                onClick={() => setMostrarCierre(true)}
                                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-bold shadow-lg">
                                Cerrar Caja
                            </button>

                            <button
                                onClick={() => setMostrarGasto(true)}
                                className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 rounded-lg text-sm font-bold shadow-lg">
                                Retirar Efectivo
                            </button>

                            {rolUsuario === 'admin' && (
                                <button
                                    onClick={() => navigate('/dashboard')}
                                    className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-300 border border-gray-700">
                                    <LayoutDashboard size={16} /> Admin
                                </button>
                            )}

                            <button
                                onClick={handleLogout}
                                className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-red-400 border border-gray-700">
                                <LogOut size={16} /> Salir
                            </button>
                        </div>
                    </div>

                    {/* BUSCADOR */}
                    <input
                        autoFocus
                        type="text"
                        placeholder="Escribe o escanea código..."
                        className="w-full p-4 bg-gray-800 rounded-xl text-lg border border-gray-700 focus:border-blue-500 focus:outline-none mb-6"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />

                    {/* PRODUCTOS */}
                    <div className="flex-1 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 content-start pr-2">
                        {products.map((p) => (
                            <div
                                key={p.id}
                                onClick={() => addToCart(p)}
                                className="bg-gray-800 p-4 rounded-lg border border-gray-700 hover:border-blue-500 cursor-pointer active:scale-95 transition-all">
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

                {/* TICKET */}
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
                            className={`w-full py-5 rounded-xl font-bold text-xl text-white shadow-lg transition-all ${loading ? 'bg-gray-600 cursor-not-allowed' : 'bg-green-600 hover:bg-green-500'}`}>
                            {loading ? 'Procesando...' : 'COBRAR (F10)'}
                        </button>
                    </div>
                </div>
            </div>
            {/* MODAL DE TICKET DE VENTA (Se muestra al cobrar) */}
            {ticketData && (
                <TicketVentaModal
                    cart={ticketData.cart}
                    total={ticketData.total}
                    numVenta={ticketData.numVenta}
                    localNombre={ticketData.localNombre}
                    vendedorEmail={ticketData.vendedorEmail}
                    onClose={() => setTicketData(null)}
                />
            )}
        </div>
    );
}
