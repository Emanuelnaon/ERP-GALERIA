import { Search, AlertTriangle, ShoppingCart, LayoutDashboard, LogOut, Store, Trash2, Minus, Plus, HelpCircle } from 'lucide-react';
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

// --- FUNCIÓN PARA GENERAR SONIDO DE ERROR (BEEP GRAVE) ---
const playErrorSound = () => {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        oscillator.type = 'sawtooth'; // Tipo de onda áspera para que suene a error
        oscillator.frequency.setValueAtTime(150, audioCtx.currentTime); // Frecuencia grave

        // Efecto de caída de volumen rápida
        gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);

        oscillator.start(audioCtx.currentTime);
        oscillator.stop(audioCtx.currentTime + 0.3);
    } catch (e) {
        console.error('El navegador no soporta Web Audio API', e);
    }
};

export default function POS() {
    const [searchTerm, setSearchTerm] = useState('');
    const [products, setProducts] = useState([]);
    const [cart, setCart] = useState([]);
    const [loading, setLoading] = useState(false);
    const [ticketData, setTicketData] = useState(null);

    // --- ESTADOS PARA EL MODAL DE COBRO ---
    const [mostrarCobro, setMostrarCobro] = useState(false);
    const [metodoPago, setMetodoPago] = useState('efectivo');
    const [montoRecibido, setMontoRecibido] = useState('');

    const [cajaAbierta, setCajaAbierta] = useState(null);
    const [verificandoCaja, setVerificandoCaja] = useState(true);
    const [usuarioActual, setUsuarioActual] = useState(null);

    const [mostrarCierre, setMostrarCierre] = useState(false);
    const [mostrarGasto, setMostrarGasto] = useState(false);

    const [localActualId, setLocalActualId] = useState(null);
    const [rolUsuario, setRolUsuario] = useState('vendedor');
    const navigate = useNavigate();
    const location = useLocation();

    const [vistaActiva, setVistaActiva] = useState('catalogo'); // Controla qué pestaña vemos
    const [ventasTurno, setVentasTurno] = useState([]); // Guarda el historial de ventas
    const [gastosTurno, setGastosTurno] = useState([]);
    const [cargandoVentas, setCargandoVentas] = useState(false);
    const [mensajeFlotante, setMensajeFlotante] = useState(null);

    const handleLogout = async () => {
        // EL CANDADO: Si hay caja abierta, frenamos la salida
        if (cajaAbierta) {
            const confirmarRelevo = window.confirm(
                '⚠️ ALERTA: Tenés la caja ABIERTA con dinero sin declarar.\n\n' +
                    '¿Estás dejando la sesión para que ingrese un RELEVO?\n' +
                    "- Si tu turno terminó, tocá 'Cancelar' y hacé el Cierre de Caja.\n" +
                    "- Si es un relevo, tocá 'Aceptar' para salir.",
            );

            if (!confirmarRelevo) return; // Si toca cancelar, lo dejamos en el POS
        }

        // Si no hay caja abierta, o si confirmó el relevo, cerramos sesión
        await supabase.auth.signOut();
    };

    // 1. OBTENER USUARIO Y ROL
    useEffect(() => {
        const initUser = async () => {
            setVerificandoCaja(true);
            let rolLocal = 'vendedor'; // Creamos una variable auxiliar

            try {
                const {
                    data: { user },
                } = await supabase.auth.getUser();

                if (user) {
                    const { data: perfil } = await supabase
                        .from('profiles')
                        .select('user_role, local_id, dni')
                        .eq('id', user.id)
                        .single();

                    rolLocal = perfil?.user_role || 'vendedor'; // Guardamos acá
                    setRolUsuario(rolLocal); // Actualizamos el estado para la UI

                    const identificadorCajero = perfil?.dni || user.email.split('@')[0];
                    user.identificador = identificadorCajero;
                    setUsuarioActual(user);

                    const localRequerido = location.state?.localDestino;
                    const dispositivoBautizado = localStorage.getItem('nano_pos_device_local');

                    if (rolLocal === 'admin') {
                        setLocalActualId(
                            localRequerido
                                ? Number(localRequerido)
                                : dispositivoBautizado
                                  ? Number(dispositivoBautizado)
                                  : 1,
                        );
                    } else {
                        if (!dispositivoBautizado) {
                            alert('⚠️ ACCESO DENEGADO: Esta computadora no está asignada a ningún local.');
                            await supabase.auth.signOut();
                            navigate('/login');
                            return;
                        }
                        setLocalActualId(Number(dispositivoBautizado));
                    }
                }
            } catch (error) {
                console.error('Error verificando usuario:', error);
            } finally {
                // 👇 Usamos la variable local, NO el estado, así no hace falta en el array
                if (localStorage.getItem('nano_pos_device_local') || rolLocal === 'admin') {
                    setVerificandoCaja(false);
                }
            }
        };
        initUser();
    }, [location.state?.localDestino, navigate]); // 👈 El array queda limpio y seguro

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

    // --- HISTORIAL COMPLETO Y ANTENAS REALTIME ---
    useEffect(() => {
        if (!cajaAbierta?.id) return;

        const cargarHistorial = async () => {
            setCargandoVentas(true);
            try {
                // 1. Traemos Ventas
                const { data: ventas } = await supabase
                    .from('ventas')
                    .select('*')
                    .eq('turno_id', cajaAbierta.id)
                    .order('created_at', { ascending: false });

                // 2. Traemos Retiros
                const { data: gastos } = await supabase
                    .from('gastos_caja')
                    .select('*')
                    .eq('turno_id', cajaAbierta.id)
                    .order('created_at', { ascending: false });

                setVentasTurno(ventas || []);
                setGastosTurno(gastos || []);
            } catch (error) {
                console.error('Error buscando historial:', error);
            } finally {
                setCargandoVentas(false);
            }
        };

        cargarHistorial();

        // -- ANTENAS --
        const canalCaja = supabase
            .channel('caja-actual')
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'turnos_caja', filter: `id=eq.${cajaAbierta.id}` },
                (payload) => {
                    // 👇 EL ESCUDO ANTI-F5 👇
                    if (payload.new.estado === 'CERRADO') {
                        // Si la base de datos dice que se cerró, limpiamos la variable para que salte el Modal de Apertura
                        setCajaAbierta(null);
                    } else {
                        // Si sigue abierta (ej: se actualizó un vuelto), actualizamos los datos nomás
                        setCajaAbierta(payload.new);
                    }
                },
            )
            .subscribe();

        const canalVentas = supabase
            .channel('ventas-nuevas')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'ventas', filter: `turno_id=eq.${cajaAbierta.id}` },
                (payload) => {
                    setVentasTurno((prev) => {
                        if (prev.some((v) => v.id === payload.new.id)) return prev;
                        return [payload.new, ...prev];
                    });
                },
            )
            .subscribe();

        const canalGastos = supabase
            .channel('gastos-nuevos')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'gastos_caja', filter: `turno_id=eq.${cajaAbierta.id}` },
                (payload) => {
                    setGastosTurno((prev) => {
                        if (prev.some((g) => g.id === payload.new.id)) return prev;
                        return [payload.new, ...prev];
                    });
                },
            )
            .subscribe();

        return () => {
            supabase.removeChannel(canalCaja);
            supabase.removeChannel(canalVentas);
            supabase.removeChannel(canalGastos);
        };
    }, [cajaAbierta?.id]);

    // --- BUSCADOR ---
    const searchProducts = async (term) => {
        if (!term) return setProducts([]);
        setLoading(true);

        // 1. Petición A: Busca SOLO por nombre
        const fetchPorNombre = supabase
            .from('variantes')
            .select(`id, codigo_barras, stock_actual, talle, precio:productos!inner(precio_base, nombre)`)
            .eq('productos.local_id', localActualId)
            .ilike('productos.nombre', `%${term}%`)
            .limit(10);

        // 2. Petición B: Busca SOLO por código de barras
        const fetchPorCodigo = supabase
            .from('variantes')
            .select(`id, codigo_barras, stock_actual, talle, precio:productos!inner(precio_base, nombre)`)
            .eq('productos.local_id', localActualId)
            .ilike('codigo_barras', `%${term}%`)
            .limit(10);

        // Las disparamos a las dos a la vez de forma independiente
        const [resNombre, resCodigo] = await Promise.all([fetchPorNombre, fetchPorCodigo]);

        if (!resNombre.error && !resCodigo.error) {
            // Juntamos los resultados
            const combinados = [...resNombre.data, ...resCodigo.data];

            // Limpiamos los repetidos por si un producto saltó en ambas listas
            const unicos = Array.from(new Map(combinados.map((item) => [item.id, item])).values());

            const formatted = unicos
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
            console.error('Error buscando productos:', resNombre.error || resCodigo.error);
        }
        setLoading(false);
    };

    // --- 🖨️ MOTOR DE IMPRESIÓN TÉRMICA ---
    const imprimirTicket = (carritoVenta, totalVenta, metodo, pagaCon, vuelto, nombreLocal) => {
        // Creamos una ventana invisible
        const ventana = window.open('', 'PRINT', 'height=400,width=600');

        // Le inyectamos el diseño clásico de ticket de supermercado/kiosco
        ventana.document.write(`
            <html>
                <head>
                    <title>Ticket de Venta</title>
                    <style>
                        /* Forzamos el ancho para rollo térmico estándar (58mm) */
                        body { 
                            font-family: monospace; 
                            width: 58mm; 
                            margin: 0 auto; 
                            padding: 2mm; 
                            color: #000;
                        }
                        h2, h3 { text-align: center; margin: 0 0 5px 0; font-size: 14px; }
                        p { margin: 2px 0; font-size: 12px; }
                        .divisor { border-top: 1px dashed #000; margin: 5px 0; }
                        table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 5px; }
                        th { text-align: left; border-bottom: 1px solid #000; padding-bottom: 2px; }
                        td { padding: 2px 0; vertical-align: top; }
                        .cant { width: 15%; text-align: center; }
                        .precio { width: 30%; text-align: right; }
                        .total-txt { font-size: 14px; font-weight: bold; text-align: right; margin-top: 5px; }
                        .centrado { text-align: center; }
                        /* 👇 Estilo para el aviso legal */
                        .legal { text-align: center; font-size: 9px; font-weight: bold; border: 1px solid #000; padding: 2px; margin-bottom: 5px; }
                    </style>
                </head>
                <body>
                    <h2>NANO POS - ${nombreLocal}</h2>
                    <div class="legal">DOCUMENTO NO VÁLIDO COMO FACTURA</div>
                    <p class="centrado">Ticket de Control Interno</p>
                    <p>Fecha: ${new Date().toLocaleString('es-AR')}</p>
                    <div class="divisor"></div>
                    
                    <table>
                        <thead>
                            <tr>
                                <th class="cant">C.</th>
                                <th>Detalle</th>
                                <th class="precio">Subt</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${carritoVenta
                                .map(
                                    (item) => `
                                <tr>
                                    <td class="cant">${item.cantidad}</td>
                                    <td>${item.nombre}</td>
                                    <td class="precio">$${item.precio * item.cantidad}</td>
                                </tr>
                            `,
                                )
                                .join('')}
                        </tbody>
                    </table>
                    
                    <div class="divisor"></div>
                    <p class="total-txt">TOTAL: $${totalVenta}</p>
                    <p>Pago: ${metodo}</p>
                    ${metodo === 'EFECTIVO' ? `<p>Abona con: $${pagaCon}<br>Vuelto: $${vuelto}</p>` : ''}
                    
                    <div class="divisor"></div>
                    <p class="centrado">¡Gracias por su compra!</p>
                </body>
            </html>
        `);

        // Cerramos el documento, disparamos la impresora y matamos la ventana
        ventana.document.close();
        ventana.focus();
        setTimeout(() => {
            ventana.print();
            ventana.close();
        }, 250);
    };

    // --- LECTOR DE CÓDIGO DE BARRAS ---
    const handleEscanearCodigo = async (codigo) => {
        if (!codigo) return;
        setLoading(true);

        const { data, error } = await supabase
            .from('variantes')
            .select(`id, codigo_barras, stock_actual, talle, precio:productos!inner(precio_base, nombre)`)
            .eq('productos.local_id', localActualId)
            .eq('codigo_barras', codigo) // Buscamos coincidencia EXACTA
            .single(); // Traemos solo uno

        // 👇 AHORA USAMOS LA ALERTA FLOTANTE Y EL SONIDO
        if (error || !data) {
            console.warn('Código no encontrado:', error?.message);

            // Reproducir sonido de error
            playErrorSound();

            // Mostrar mensaje flotante
            setMensajeFlotante(`El código ${codigo} no existe.`);

            // Desaparecer el mensaje a los 3 segundos
            setTimeout(() => {
                setMensajeFlotante(null);
            }, 3000);

            setSearchTerm('');
            setLoading(false);
            return; // Cortamos la función acá
        }

        // Si llegó acá, es porque encontró el producto
        const productoEscaneado = {
            id: data.id,
            nombre: data.precio.nombre,
            precio: data.precio.precio_base,
            talle: data.talle,
            stock: data.stock_actual,
            codigo: data.codigo_barras,
        };

        addToCart(productoEscaneado); // Lo mandamos directo al carrito
        setSearchTerm(''); // Limpiamos el buscador
        setLoading(false);
    };

    // --- DETECTOR DE LA TECLA ENTER (Pistola Láser) ---
    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && searchTerm.trim() !== '') {
            handleEscanearCodigo(searchTerm.trim());
        }
    };

    useEffect(() => {
        const timeout = setTimeout(() => {
            if (searchTerm.trim().length > 0) searchProducts(searchTerm);
            else setProducts([]);
        }, 300);
        return () => clearTimeout(timeout);
        // eslint-disable-next-line react-hooks/exhaustive-deps
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
                return currentCart;
            }

            if (exists) {
                return currentCart.map((item) =>
                    item.id === product.id ? { ...item, cantidad: item.cantidad + 1 } : item,
                );
            }
            return [...currentCart, { ...product, cantidad: 1 }];
        });
    };

    // --- CONTROL DE CANTIDADES Y ELIMINAR ÍTEMS ---
    const updateQuantity = (productId, change, maxStock) => {
        setCart((currentCart) => {
            return currentCart
                .map((item) => {
                    if (item.id === productId) {
                        const nuevaCantidad = item.cantidad + change;
                        // Muro de seguridad del stock
                        if (change > 0 && nuevaCantidad > maxStock) {
                            alert(`⚠️ Stock insuficiente. Solo tenés ${maxStock} unidades.`);
                            return item;
                        }
                        if (nuevaCantidad <= 0) return { ...item, cantidad: 0 };

                        return { ...item, cantidad: nuevaCantidad };
                    }
                    return item;
                })
                .filter((item) => item.cantidad > 0);
        });
    };

    const removeFromCart = (productId) => {
        setCart((currentCart) => currentCart.filter((item) => item.id !== productId));
    };

    // --- LÓGICA DE COBRO ---
    const total = cart.reduce((acc, item) => acc + item.precio * item.cantidad, 0);

   const iniciarCobro = () => {
       // 🛡️ PATOVICA 1: No hacer nada si ya está cargando o el carrito está vacío
       if (loading || cart.length === 0) return;

       if (!cajaAbierta) {
           alert('Bloqueo de seguridad: No podés vender sin abrir la caja.');
           return;
       }
       setMetodoPago('efectivo');
       setMontoRecibido(''); // Reseteamos el input
       setMostrarCobro(true); // Abrimos el modal
   };

const confirmarVentaFinal = async (e) => {
    if (e) e.preventDefault();

    // 🛡️ PATOVICA 2 (EL MÁS IMPORTANTE): Bloquea el doble Enter o múltiples clics
    if (loading) return;

    // Validación básica
    if (metodoPago === 'efectivo' && montoRecibido !== '' && Number(montoRecibido) < total) {
        alert('El monto recibido es menor al total a pagar.');
        return;
    }

    setLoading(true); // 🔒 Cerramos la puerta instantáneamente

    try {
        if (!usuarioActual) throw new Error('No hay sesión activa');
        const ventaData = {
            p_local_id: localActualId,
            p_vendedor_id: usuarioActual.id,
            p_turno_id: cajaAbierta.id,
            p_total: total,
            p_metodo_pago: metodoPago,
            p_detalles: cart,
        };

        const { data: numeroVenta, error } = await supabase.rpc('procesar_venta', ventaData);
        if (error) throw error;

        const localObj = LOCALES_GALERIA.find((l) => l.id === localActualId);

        // Armamos el ticket para el modal visual
        setTicketData({
            cart: [...cart],
            total: total,
            numVenta: numeroVenta,
            localNombre: localObj ? localObj.nombre : 'Local Comercial',
            vendedorEmail: usuarioActual.identificador || usuarioActual.email.split('@')[0],
        });

        // 👇 🖨️ ACÁ DISPARAMOS LA IMPRESORA TÉRMICA 👇
        const vueltoCalc = metodoPago === 'efectivo' && montoRecibido ? Number(montoRecibido) - total : 0;
        const pagoConCalc = metodoPago === 'efectivo' && montoRecibido ? montoRecibido : total;

        imprimirTicket(
            cart,
            total,
            metodoPago.toUpperCase(),
            pagoConCalc,
            vueltoCalc,
            localObj ? localObj.nombre : 'Local Comercial',
        );

        // Actualizamos la caja localmente
        setCajaAbierta((prev) => ({
            ...prev,
            efectivo_esperado: Number(prev?.efectivo_esperado || 0) + total,
        }));

        // El truco visual para la pestaña "Mis Ventas"
        const nuevaVentaLocal = {
            id: numeroVenta,
            created_at: new Date().toISOString(),
            metodo_pago: metodoPago,
            total: total,
        };

        setVentasTurno((prev) => {
            if (prev.some((v) => v.id === nuevaVentaLocal.id)) return prev;
            return [nuevaVentaLocal, ...prev];
        });

        // Limpiamos todo
        setCart([]);
        setSearchTerm('');
        setMostrarCobro(false); // Cerramos el modal
    } catch (error) {
        console.error(error);
        alert('❌ Error al procesar la venta: ' + error.message);
    } finally {
        setLoading(false); // 🔓 Liberamos la puerta al terminar (éxito o error)
    }
};

    // --- ATAJO F10 (Abre el modal en vez de cobrar directo) ---
    useEffect(() => {
        const manejarTeclas = (evento) => {
            if (evento.key === 'F10') {
                evento.preventDefault();
                if (cart.length > 0 && !loading && cajaAbierta && !mostrarCierre && !mostrarCobro) {
                    iniciarCobro();
                }
            }
            // Si el modal está abierto, Enter confirma y Escape lo cierra
            if (mostrarCobro) {
                if (evento.key === 'Escape') setMostrarCobro(false);
            }
        };
        window.addEventListener('keydown', manejarTeclas);
        return () => window.removeEventListener('keydown', manejarTeclas);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cart, loading, cajaAbierta, mostrarCierre, mostrarCobro]);

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

    // --- CÁLCULOS MATEMÁTICOS DEL TABLERO EN TIEMPO REAL ---
    const fondoInicial = Number(cajaAbierta?.saldo_inicial || 0);

    // Total vendido (Suma Efectivo y Transferencias para las estadísticas)
    const totalVendido = ventasTurno.reduce((acc, v) => acc + Number(v.total), 0);

    // Solo lo vendido en EFECTIVO (porque las transferencias no van al cajón físico)
    const ventasEfectivo = ventasTurno
        .filter((v) => v.metodo_pago?.toLowerCase() === 'efectivo')
        .reduce((acc, v) => acc + Number(v.total), 0);

    const totalRetiros = gastosTurno.reduce((acc, g) => acc + Number(g.monto), 0);

    // 💰 LA VERDAD ABSOLUTA DEL CAJÓN FÍSICO
    const dineroFisicoEnCaja = fondoInicial + ventasEfectivo - totalRetiros;
    // --------------------------------------------------------

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

            {/* 👇 MENSAJE FLOTANTE DE ERROR (TOAST) 👇 */}
            {mensajeFlotante && (
                <div className="absolute top-10 left-1/2 transform -translate-x-1/2 z-[60] bg-red-600 text-white px-6 py-3 rounded-xl shadow-2xl border-2 border-red-400 font-bold flex items-center gap-3 animate-bounce">
                    <AlertTriangle size={24} />
                    {mensajeFlotante}
                </div>
            )}

            {mostrarCierre && cajaAbierta && (
                <div className="absolute inset-0 z-50">
                    <CierreCajaModal
                        turno={cajaAbierta}
                        onClose={() => setMostrarCierre(false)}
                        onCierreExitoso={async () => {
                            setMostrarCierre(false);
                            setCajaAbierta(null); // Local state set to null (ahora la antena lo respeta)
                            alert('✅ ¡Turno cerrado exitosamente!');

                            if (rolUsuario === 'admin') {
                                // Si es el dueño, capaz quiere ir al panel a ver números
                                navigate('/dashboard');
                            } else {
                                // Si es vendedor, cerramos su sesión sí o sí para que entre el próximo
                                await supabase.auth.signOut();
                                navigate('/login');
                            }
                        }}
                    />
                </div>
            )}

            {/* 👇 MODAL DE COBRO F10 👇 */}
            {mostrarCobro && (
                <div className="absolute inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="bg-gray-900 border-2 border-blue-500 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="bg-blue-600 p-6 text-center">
                            <h2 className="text-3xl font-bold text-white mb-1">Confirmar Venta</h2>
                            <p className="text-blue-100 font-medium">Ticket por {cart.length} artículos</p>
                        </div>

                        <form onSubmit={confirmarVentaFinal} className="p-8 space-y-6">
                            {/* Total a Pagar Gigante */}
                            <div className="flex justify-between items-end border-b border-gray-700 pb-4">
                                <span className="text-gray-400 text-xl font-bold">Total a Pagar</span>
                                <span className="text-5xl font-extrabold text-green-400">
                                    ${total.toLocaleString()}
                                </span>
                            </div>

                            {/* Selector de Método de Pago */}
                            <div className="grid grid-cols-2 gap-4">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setMetodoPago('efectivo');
                                        setMontoRecibido('');
                                    }}
                                    className={`py-4 rounded-xl font-bold text-lg border-2 transition-all ${metodoPago === 'efectivo' ? 'bg-blue-600 border-blue-400 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'}`}>
                                    💵 Efectivo
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setMetodoPago('transferencia');
                                        setMontoRecibido(total.toString()); // Autocompleta el total
                                    }}
                                    className={`py-4 rounded-xl font-bold text-lg border-2 transition-all ${metodoPago === 'transferencia' ? 'bg-indigo-600 border-indigo-400 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'}`}>
                                    📱 Transferencia
                                </button>
                            </div>

                            {/* Input para calcular vuelto (Solo si es efectivo) */}
                            {metodoPago === 'efectivo' && (
                                <div className="space-y-2">
                                    <label className="text-gray-400 font-bold">Abonó con:</label>
                                    <div className="relative">
                                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-2xl font-bold">
                                            $
                                        </span>
                                        <input
                                            type="number"
                                            autoFocus // 👈 Clave para no usar el mouse
                                            min={total}
                                            value={montoRecibido}
                                            onChange={(e) => setMontoRecibido(e.target.value)}
                                            className="w-full bg-gray-950 border-2 border-gray-700 rounded-xl py-4 pl-12 pr-4 text-3xl font-bold text-white focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/20"
                                            placeholder={total.toString()}
                                        />
                                    </div>

                                    {/* Cálculo del vuelto automático */}
                                    {montoRecibido && Number(montoRecibido) >= total && (
                                        <div className="flex justify-between items-center bg-gray-800 p-4 rounded-xl mt-4">
                                            <span className="text-gray-300 font-bold">Su vuelto:</span>
                                            <span className="text-3xl font-bold text-orange-400">
                                                ${(Number(montoRecibido) - total).toLocaleString()}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Botones de acción */}
                            <div className="flex gap-4 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setMostrarCobro(false)}
                                    className="px-6 py-4 rounded-xl font-bold text-gray-400 bg-gray-800 hover:bg-gray-700 transition-colors">
                                    Cancelar (Esc)
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="flex-1 bg-green-600 hover:bg-green-500 text-white font-extrabold text-xl py-4 rounded-xl shadow-lg shadow-green-600/30 transition-all">
                                    {loading ? 'Procesando...' : 'CONFIRMAR (Enter)'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {mostrarGasto && cajaAbierta && (
                <div className="absolute inset-0 z-50">
                    <GastoModal
                        turnoId={cajaAbierta.id}
                        maximoPermitido={dineroFisicoEnCaja}
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
                    {/* 👇 Agregamos flex-wrap al contenedor principal y un gap-4 para la separación */}
                    <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
                        {/* PESTAÑAS */}
                        <div className="flex bg-gray-950 p-1 rounded-lg border border-gray-800 shadow-inner w-full md:w-auto">
                            <button
                                onClick={() => setVistaActiva('catalogo')}
                                className={`flex-1 md:flex-none px-4 md:px-6 py-2 rounded-md font-bold transition-all text-sm md:text-base ${
                                    vistaActiva === 'catalogo'
                                        ? 'bg-blue-600 text-white shadow-md'
                                        : 'text-gray-400 hover:text-white'
                                }`}>
                                Catálogo
                            </button>

                            <button
                                onClick={() => setVistaActiva('historial')}
                                className={`flex-1 md:flex-none px-4 md:px-6 py-2 rounded-md font-bold transition-all text-sm md:text-base ${
                                    vistaActiva === 'historial'
                                        ? 'bg-blue-600 text-white shadow-md'
                                        : 'text-gray-400 hover:text-white'
                                }`}>
                                Mis Ventas
                            </button>
                        </div>

                        {/* BOTONES DE ACCIÓN */}
                        {/* 👇 Agregamos flex-wrap a los botones y achicamos un poco la letra en móviles */}
                        <div className="flex flex-wrap gap-2 md:gap-3 items-center w-full xl:w-auto justify-start xl:justify-end">
                            {/* SELECTOR DE LOCAL (Solo para Admin) */}
                            {rolUsuario === 'admin' && (
                                <div className="flex items-center gap-2 bg-gray-800 px-2 py-2 rounded-lg border border-gray-700">
                                    <Store size={16} className="text-blue-400 hidden sm:block" />
                                    <select
                                        value={localActualId || 1}
                                        onChange={(e) => setLocalActualId(Number(e.target.value))}
                                        className="bg-transparent text-white font-bold focus:outline-none cursor-pointer text-xs md:text-sm">
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
                                className="flex items-center gap-1 md:gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-xs md:text-sm font-bold text-white transition-colors shadow-lg">
                                Relevo
                            </button>

                            <button
                                onClick={() => setMostrarCierre(true)}
                                className="flex items-center gap-1 md:gap-2 px-3 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-xs md:text-sm font-bold shadow-lg">
                                Cerrar Caja
                            </button>

                            <button
                                onClick={() => setMostrarGasto(true)}
                                className="flex items-center gap-1 md:gap-2 px-3 py-2 bg-orange-600 hover:bg-orange-700 rounded-lg text-xs md:text-sm font-bold shadow-lg">
                                Retiro
                            </button>

                            {rolUsuario === 'admin' && (
                                <button
                                    onClick={() => navigate('/dashboard')}
                                    className="flex items-center gap-1 md:gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs md:text-sm text-gray-300 border border-gray-700">
                                    <LayoutDashboard size={14} className="hidden sm:block" /> Admin
                                </button>
                            )}

                            <button
                                onClick={handleLogout}
                                className="flex items-center gap-1 md:gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs md:text-sm text-red-400 border border-gray-700">
                                <LogOut size={14} className="hidden sm:block" /> Salir
                            </button>

                            {/* BOTÓN DE SOPORTE DIRECTO */}
                            <button
                                onClick={() =>
                                    window.open(
                                        'https://wa.me/549XXXXXXXXXX?text=Hola%20Ema,%20tengo%20una%20consulta%20con%20el%20sistema%20NANO%20POS:%20',
                                        '_blank',
                                    )
                                }
                                className="flex items-center gap-1 md:gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs md:text-sm text-green-400 border border-gray-700 transition-colors shadow-lg">
                                <HelpCircle size={14} className="hidden sm:block" /> Ayuda
                            </button>
                        </div>
                    </div>

                    {/* 👇 BUSCADOR (Oculto en historial) */}
                    {vistaActiva === 'catalogo' && (
                        <input
                            autoFocus
                            type="text"
                            placeholder="Escribe o escanea código..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onKeyDown={handleKeyDown}
                            className="w-full p-4 bg-gray-800 rounded-xl text-lg text-white font-bold border border-gray-700 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/50 focus:outline-none mb-6 transition-all"
                        />
                    )}

                    {/* 👇 ÁREA DINÁMICA: PRODUCTOS O HISTORIAL 👇 */}
                    {vistaActiva === 'catalogo' ? (
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
                    ) : (
                        <div className="flex-1 overflow-y-auto bg-gray-900 rounded-xl border border-gray-800 p-4 pr-2">
                            <h3 className="text-xl font-bold mb-4 text-gray-300">Resumen del Turno</h3>

                            {/* 👇 TABLERO DE RESUMEN (4 BLOQUES) 👇 */}
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 bg-gray-800 p-4 rounded-xl border border-gray-700 mb-6 shadow-lg">
                                {/* 1. Fondo Inicial */}
                                <div className="p-3 bg-gray-900 rounded-lg border border-gray-700 flex flex-col justify-center">
                                    <p className="text-gray-400 text-[10px] md:text-xs font-bold uppercase mb-1">
                                        Fondo Inicial
                                    </p>
                                    <p className="text-lg md:text-xl font-bold text-white">
                                        ${fondoInicial.toLocaleString()}
                                    </p>
                                </div>

                                {/* 2. Total Vendido (Global) */}
                                <div className="p-3 bg-gray-900 rounded-lg border border-gray-700 flex flex-col justify-center">
                                    <p className="text-gray-400 text-[10px] md:text-xs font-bold uppercase mb-1">
                                        Total Vendido
                                    </p>
                                    <p className="text-lg md:text-xl font-bold text-blue-400">
                                        ${totalVendido.toLocaleString()}
                                    </p>
                                </div>

                                {/* 3. Retiros */}
                                <div className="p-3 bg-gray-900 rounded-lg border border-gray-700 flex flex-col justify-center">
                                    <p className="text-gray-400 text-[10px] md:text-xs font-bold uppercase mb-1">
                                        Retiros
                                    </p>
                                    <p className="text-lg md:text-xl font-bold text-orange-400">
                                        -${totalRetiros.toLocaleString()}
                                    </p>
                                </div>

                                {/* 4. Efectivo a Rendir */}
                                <div className="p-3 bg-gray-900 rounded-lg border-2 border-green-900/50 flex flex-col justify-center">
                                    <p className="text-green-400/80 text-[10px] md:text-xs font-bold uppercase mb-1">
                                        Efectivo a Rendir
                                    </p>
                                    <p className="text-xl md:text-2xl font-extrabold text-green-400">
                                        ${dineroFisicoEnCaja.toLocaleString()}
                                    </p>
                                </div>
                            </div>
                            {/* 👆 FIN DEL TABLERO 👆 */}

                            <h3 className="text-lg font-bold mb-4 text-gray-400 border-b border-gray-800 pb-2">
                                Historial de Tickets
                            </h3>

                            {cargandoVentas ? (
                                <p className="text-center text-gray-500 mt-10">Cargando historial...</p>
                            ) : ventasTurno.length === 0 ? (
                                <p className="text-gray-500 text-center mt-10">
                                    Aún no registraste ventas en este turno.
                                </p>
                            ) : (
                                <div className="space-y-3">
                                    {ventasTurno.map((v) => (
                                        <div
                                            key={v.id}
                                            className="flex justify-between items-center p-4 bg-gray-800 rounded-lg border border-gray-700 hover:border-gray-500 transition-colors">
                                            <div>
                                                <p className="font-bold text-lg text-white">Ticket #{v.id}</p>
                                                <p className="text-sm text-gray-400">
                                                    {new Date(v.created_at).toLocaleTimeString()} hs |{' '}
                                                    {v.metodo_pago?.toUpperCase() || 'EFECTIVO'}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-bold text-2xl text-green-400">
                                                    ${Number(v.total).toLocaleString()}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
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
                                className="flex flex-col gap-2 bg-gray-900 p-3 rounded border border-gray-800">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <div className="font-bold">{item.nombre}</div>
                                        <div className="text-sm text-gray-400">
                                            ${item.precio} x {item.cantidad}
                                        </div>
                                    </div>
                                    <div className="font-bold text-xl text-blue-400">
                                        ${item.precio * item.cantidad}
                                    </div>
                                </div>

                                {/* Controles de cantidad y Eliminar */}
                                <div className="flex justify-between items-center mt-2 border-t border-gray-800 pt-2">
                                    <div className="flex items-center gap-3 bg-gray-950 rounded-lg p-1 border border-gray-700">
                                        <button
                                            onClick={() => updateQuantity(item.id, -1, item.stock)}
                                            className="p-1 hover:bg-gray-800 rounded text-gray-400 hover:text-white transition-colors">
                                            <Minus size={16} />
                                        </button>
                                        <span className="font-bold w-6 text-center">{item.cantidad}</span>
                                        <button
                                            onClick={() => updateQuantity(item.id, 1, item.stock)}
                                            className="p-1 hover:bg-gray-800 rounded text-gray-400 hover:text-white transition-colors">
                                            <Plus size={16} />
                                        </button>
                                    </div>

                                    <button
                                        onClick={() => removeFromCart(item.id)}
                                        className="text-red-500 hover:text-red-400 p-2 hover:bg-red-500/10 rounded-lg transition-colors"
                                        title="Eliminar producto">
                                        <Trash2 size={18} />
                                    </button>
                                </div>
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
                            onClick={iniciarCobro}
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
