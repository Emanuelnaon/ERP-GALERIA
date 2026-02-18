import {
    Search,
    ShoppingCart,
    Trash2,
    Plus,
    Minus,
    LayoutDashboard,
} from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "../../services/supabase";
import { useNavigate } from "react-router-dom";

export default function POS() {
    const [searchTerm, setSearchTerm] = useState("");
    const [products, setProducts] = useState([]); // Resultados de búsqueda
    const [cart, setCart] = useState([]); // Carrito de compras
    const [loading, setLoading] = useState(false);

    // Función para buscar productos en Supabase
    const searchProducts = async (term) => {
        if (!term) {
            setProducts([]); // Si no hay termino, vaciar lista
            return;
        }
        setLoading(true);

        const { data, error } = await supabase
            .from("variantes")
            .select(
                `
        id, 
        codigo_barras, 
        stock_actual, 
        talle, 
        precio:productos(precio_base, nombre)
      `,
            )
            .ilike("productos.nombre", `%${term}%`)
            .limit(10);

        if (error) {
            console.error("Error:", error);
        } else {
            const formatted = data
                .map((item) => ({
                    id: item.id,
                    // Si el producto padre es null, ponemos un placeholder
                    nombre: item.precio?.nombre || "DESCONOCIDO",
                    precio: item.precio?.precio_base || 0,
                    talle: item.talle,
                    stock: item.stock_actual,
                    codigo: item.codigo_barras,
                }))
                // FILTRO CLAVE: Eliminamos los que dicen 'DESCONOCIDO' para que no ensucien
                .filter((item) => item.nombre !== "DESCONOCIDO");

            setProducts(formatted);
        }
        setLoading(false);
    };

    // Efecto: Buscar cuando el usuario deja de escribir (debounce simple)
    useEffect(() => {
        const timeout = setTimeout(() => {
            // Solo busca si hay algo escrito (y quita espacios en blanco)
            if (searchTerm.trim().length > 0) {
                searchProducts(searchTerm);
            } else {
                setProducts([]); // <--- ESTO FALTABA: Limpiar si el input está vacío
            }
        }, 300);
        return () => clearTimeout(timeout);
    }, [searchTerm]);

    // Agregar al carrito
    const addToCart = (product) => {
        setCart((currentCart) => {
            const exists = currentCart.find((item) => item.id === product.id);
            if (exists) {
                return currentCart.map((item) =>
                    item.id === product.id
                        ? { ...item, cantidad: item.cantidad + 1 }
                        : item,
                );
            }
            return [...currentCart, { ...product, cantidad: 1 }];
        });
    };

    // Calcular Total
    const total = cart.reduce(
        (acc, item) => acc + item.precio * item.cantidad,
        0,
    );

    const navigate = useNavigate();

    const handleCheckout = async () => {
        if (cart.length === 0) return;

        const confirm = window.confirm(`¿Confirmar venta por $${total}?`);
        if (!confirm) return;

        setLoading(true);

        try {
            // 1. Obtener usuario actual (el vendedor)
            const {
                data: { user },
            } = await supabase.auth.getUser();
            if (!user) {
                alert("Error: No hay sesión activa");
                return;
            }

            // 2. Preparar los datos para enviarlos a la función SQL
            // Nota: Asumimos Local ID = 1 por ahora. Luego lo haremos dinámico.
            const ventaData = {
                p_local_id: 1,
                p_vendedor_id: user.id,
                p_total: total,
                p_metodo_pago: "efectivo", // Podrías agregar un select para cambiar esto
                p_detalles: cart, // Enviamos el array tal cual
            };

            // 3. Invocar la función mágica "procesar_venta"
            const { data, error } = await supabase.rpc(
                "procesar_venta",
                ventaData,
            );

            if (error) throw error;

            // 4. ÉXITO
            alert(`✅ Venta #${data} registrada con éxito!`);
            setCart([]); // Limpiar carrito
            setSearchTerm(""); // Limpiar buscador
            setProducts([]); // Limpiar resultados
        } catch (error) {
            console.error(error);
            alert("❌ Error al procesar la venta: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex h-screen bg-gray-900 text-white overflow-hidden">
            {/* SECCIÓN IZQUIERDA: Buscador y Productos */}
            <div className="w-2/3 p-6 flex flex-col border-r border-gray-800">
                {/* Encabezado con Botón de Salida */}
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                        <Search className="text-blue-500" /> Catálogo
                    </h2>

                    <button
                        onClick={() => navigate("/dashboard")}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-300 transition-colors border border-gray-700"
                    >
                        <LayoutDashboard size={16} />
                        Ir al Admin
                    </button>
                </div>

                {/* Barra de Búsqueda */}
                <input
                    autoFocus
                    type="text"
                    placeholder="Escribe 'zapatilla' o escanea código..."
                    className="w-full p-4 bg-gray-800 rounded-xl text-lg border border-gray-700 focus:border-blue-500 focus:outline-none mb-6"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />

                {/* Lista de Resultados */}
                <div className="flex-1 overflow-y-auto grid grid-cols-2 gap-4 content-start">
                    {products.map((p) => (
                        <div
                            key={p.id}
                            onClick={() => addToCart(p)}
                            className="bg-gray-800 p-4 rounded-lg border border-gray-700 hover:border-blue-500 cursor-pointer transition-all active:scale-95"
                        >
                            <h3 className="font-bold text-lg">{p.nombre}</h3>
                            <div className="flex justify-between mt-2 text-gray-400">
                                <span>
                                    {p.talle ? `Talle: ${p.talle}` : "Unitario"}
                                </span>
                                <span
                                    className={
                                        p.stock < 2
                                            ? "text-red-500"
                                            : "text-green-500"
                                    }
                                >
                                    Stock: {p.stock}
                                </span>
                            </div>
                            <div className="mt-3 text-2xl font-bold text-blue-400">
                                ${p.precio}
                            </div>
                        </div>
                    ))}
                    {products.length === 0 && !loading && searchTerm && (
                        <p className="text-gray-500 col-span-2 text-center mt-10">
                            No se encontraron productos.
                        </p>
                    )}
                </div>
            </div>

            {/* SECCIÓN DERECHA: Ticket / Carrito */}
            <div className="w-1/3 bg-gray-950 p-6 flex flex-col shadow-2xl">
                <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                    <ShoppingCart className="text-green-500" /> Ticket Actual
                </h2>

                {/* Lista de Items en Carrito */}
                <div className="flex-1 overflow-y-auto space-y-3">
                    {cart.map((item) => (
                        <div
                            key={item.id}
                            className="flex justify-between items-center bg-gray-900 p-3 rounded border border-gray-800"
                        >
                            <div>
                                <div className="font-bold">{item.nombre}</div>
                                <div className="text-sm text-gray-400">
                                    ${item.precio} x {item.cantidad}
                                </div>
                            </div>
                            <div className="font-bold text-xl">
                                ${item.precio * item.cantidad}
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

                {/* Total y Botón de Cobro */}
                <div className="mt-6 border-t border-gray-800 pt-6">
                    <div className="flex justify-between items-end mb-6">
                        <span className="text-gray-400 text-lg">
                            Total a Pagar
                        </span>
                        <span className="text-4xl font-bold text-green-500">
                            ${total}
                        </span>
                    </div>

                    <button
                        onClick={handleCheckout}
                        disabled={cart.length === 0 || loading}
                        className={`w-full py-5 rounded-xl font-bold text-xl text-white shadow-lg transition-all 
    ${loading ? "bg-gray-600 cursor-not-allowed" : "bg-green-600 hover:bg-green-500"}`}
                    >
                        {loading ? "Procesando..." : "COBRAR (F12)"}
                    </button>
                </div>
            </div>
        </div>
    );
}
