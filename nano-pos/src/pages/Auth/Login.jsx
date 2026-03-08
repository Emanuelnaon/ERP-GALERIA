import { useState, useEffect } from 'react';
import { supabase } from '../../services/supabase';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, Loader2, LogIn, AlertCircle, Settings, MonitorSmartphone } from 'lucide-react';

export default function Login() {
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState(null);
    const [identificacion, setIdentificacion] = useState('');
    const navigate = useNavigate();
    // --- ESTADOS PARA EL BAUTISMO DE DISPOSITIVO ---
    const [dispositivoLocalId, setDispositivoLocalId] = useState(localStorage.getItem('nano_pos_device_local') || null);

    // --- AUTO-REDIRECCIÓN SI YA ESTÁ LOGUEADO ---
    useEffect(() => {
        const chequearSesion = async () => {
            const {
                data: { session },
            } = await supabase.auth.getSession();
            if (session) {
                navigate('/pos');
            }
        };
        chequearSesion();
    }, [navigate]);

    const handleConfigurarDispositivo = () => {
        // 1. Pedimos el PIN maestro (Podés cambiar "1234" por la clave que quieras)
        const pin = window.prompt('🔒 MODO ADMIN: Ingresá el PIN maestro para enlazar este dispositivo físico:');
        if (pin !== '1234') {
            if (pin !== null) alert('PIN incorrecto.');
            return;
        }

        // 2. Si el PIN es correcto, elegimos qué local es esta tablet/PC
        const opciones =
            '1: Zapatería | 2: Ropa | 3: Librería | 4: Regalería\n\nIngresá el NÚMERO del local para este mostrador:';
        const localElegido = window.prompt(opciones);

        if (['1', '2', '3', '4'].includes(localElegido)) {
            localStorage.setItem('nano_pos_device_local', localElegido);
            setDispositivoLocalId(localElegido);
            alert(`✅ Dispositivo enlazado exitosamente. Esta máquina ahora es la caja del Local ${localElegido}.`);
        } else if (localElegido !== null) {
            alert('❌ Opción inválida.');
        }
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setErrorMsg(null); // Limpiamos errores viejos al reintentar

        const esCorreo = identificacion.includes('@');
        const emailFinal = esCorreo ? identificacion : `${identificacion}@nanopos.com`;

        // 👇 Le sacamos el "data" porque solo nos importa si hay error
        const { error } = await supabase.auth.signInWithPassword({
            email: emailFinal,
            password: password,
        });

        if (error) {
            // 👇 Usamos setErrorMsg en vez de alert()
            setErrorMsg('Error al iniciar sesión: Verificá tus credenciales.');
            setLoading(false);
            return;
        }

        setLoading(false);
        navigate('/pos'); // 👇 Usamos navigate para mandarlo directo al sistema
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-950 px-4 relative">
            {/* 👇 Botón de configuración oculto a simple vista (Arriba a la derecha) */}
            <button
                type="button"
                onClick={handleConfigurarDispositivo}
                className="absolute top-6 right-6 text-gray-600 hover:text-gray-300 transition-colors"
                title="Configurar Hardware">
                <Settings size={28} />
            </button>

            <div className="w-full max-w-sm space-y-8 bg-gray-900 p-8 rounded-2xl border border-gray-800 shadow-2xl">
                {/* Encabezado */}
                <div className="text-center">
                    <h1 className="text-3xl font-bold tracking-tight text-white">NANO POS</h1>
                    <p className="mt-2 text-sm text-gray-400">Ingresa tus credenciales de vendedor</p>
                </div>

                {/* 👇 INDICADOR VISUAL: Si la terminal está bautizada, lo mostramos */}
                {dispositivoLocalId && (
                    <div className="flex items-center justify-center gap-2 bg-indigo-900/30 text-indigo-400 p-3 rounded-xl border border-indigo-800/50">
                        <MonitorSmartphone size={18} />
                        <span className="text-sm font-medium">
                            Terminal de <b>Local {dispositivoLocalId}</b>
                        </span>
                    </div>
                )}

                {/* Mensaje de Error */}
                {errorMsg && (
                    <div className="bg-red-900/50 border border-red-800 text-red-200 text-sm p-3 rounded text-center">
                        {errorMsg}
                    </div>
                )}

                {/* Formulario */}
                <form onSubmit={handleLogin} className="mt-8 space-y-6">
                    <div className="space-y-4 rounded-md shadow-sm">
                        {/* Input DNI / Email */}
                        <div className="relative mb-4">
                            {/* Le sacamos el absolute al ícono para que no se superponga con el label, o lo dejamos estético */}
                            <label className="block text-gray-300 text-sm font-bold mb-2">
                                DNI o Correo Electrónico
                            </label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-3.5 h-5 w-5 text-gray-500" />
                                <input
                                    type="text"
                                    value={identificacion}
                                    onChange={(e) => setIdentificacion(e.target.value)}
                                    className="w-full py-3 pl-10 pr-3 rounded bg-gray-700 text-white border border-gray-600 focus:outline-none focus:border-blue-500"
                                    placeholder="Ej: 35123456 o admin@galeria.com"
                                    required
                                />
                            </div>
                        </div>

                        {/* Input Contraseña */}
                        <div className="relative">
                            <Lock className="absolute left-3 top-3 h-5 w-5 text-gray-500" />
                            <input
                                type="password"
                                required
                                className="block w-full rounded-md border-0 bg-gray-800 py-3 pl-10 text-white placeholder:text-gray-500 focus:ring-2 focus:ring-blue-600 sm:text-sm"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>
                    </div>

                    <button
                        disabled={loading}
                        type="submit"
                        className="group relative flex w-full justify-center rounded-md bg-blue-600 px-3 py-3 text-sm font-semibold text-white hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'INICIAR TURNO'}
                    </button>
                </form>
            </div>
        </div>
    );
}
