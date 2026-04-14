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
        /* 👇 MAGIA 1: min-h-[100dvh] en lugar de min-h-screen y agregamos py-6 por si la pantalla es enana */
        <div className="flex min-h-[100dvh] items-center justify-center bg-gray-950 px-4 py-6 relative">
            <button
                type="button"
                onClick={handleConfigurarDispositivo}
                className="absolute top-6 right-6 text-gray-600 hover:text-gray-300 transition-colors"
                title="Configurar Hardware">
                <Settings size={28} />
            </button>

            {/* 👇 MAGIA 2: p-6 para móvil, p-8 para PC. space-y-6 para móvil, space-y-8 para PC */}
            <div className="w-full max-w-sm space-y-6 md:space-y-8 bg-gray-900 p-6 md:p-8 rounded-2xl border border-gray-800 shadow-2xl">
                <div className="text-center">
                    {/* 👇 MAGIA 3: text-2xl en móvil, text-3xl en PC */}
                    <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">NANO POS</h1>
                    <p className="mt-1 md:mt-2 text-xs md:text-sm text-gray-400">
                        Ingresa tus credenciales de vendedor
                    </p>
                </div>

                {dispositivoLocalId && (
                    <div className="flex items-center justify-center gap-2 bg-indigo-900/30 text-indigo-400 p-2.5 md:p-3 rounded-xl border border-indigo-800/50">
                        <MonitorSmartphone size={16} className="md:w-5 md:h-5" />
                        <span className="text-xs md:text-sm font-medium">
                            Terminal de <b>Local {dispositivoLocalId}</b>
                        </span>
                    </div>
                )}

                {errorMsg && (
                    <div className="bg-red-900/50 border border-red-800 text-red-200 text-xs md:text-sm p-3 rounded text-center">
                        {errorMsg}
                    </div>
                )}

                <form onSubmit={handleLogin} className="mt-6 md:mt-8 space-y-5 md:space-y-6">
                    <div className="space-y-4 rounded-md shadow-sm">
                        <div className="relative mb-3 md:mb-4">
                            <label className="block text-gray-300 text-xs md:text-sm font-bold mb-1.5 md:mb-2">
                                DNI o Correo Electrónico
                            </label>
                            <div className="relative">
                                {/* Ajuste del ícono para que quede centrado con el nuevo alto del input */}
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 md:h-5 md:w-5 text-gray-500" />
                                <input
                                    type="text"
                                    autoComplete="username"
                                    value={identificacion}
                                    onChange={(e) => setIdentificacion(e.target.value)}
                                    /* 👇 MAGIA 4: py-2.5 en móvil, py-3 en PC. Letra más chica en móvil */
                                    className="w-full py-2.5 md:py-3 pl-9 md:pl-10 pr-3 rounded bg-gray-700 text-white border border-gray-600 focus:outline-none focus:border-blue-500 text-sm md:text-base"
                                    placeholder="Ej: 35123456 o admin@galeria.com"
                                    required
                                />
                            </div>
                        </div>

                        <div className="relative">
                            <label className="block text-gray-300 text-xs md:text-sm font-bold mb-1.5 md:mb-2">
                                Contraseña
                            </label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 md:h-5 md:w-5 text-gray-500" />
                                <input
                                    type="password"
                                    required
                                    /* 👇 Igual acá: py-2.5 y text-sm para móvil */
                                    className="w-full py-2.5 md:py-3 pl-9 md:pl-10 pr-3 rounded bg-gray-700 text-white border border-gray-600 focus:outline-none focus:border-blue-500 text-sm md:text-base"
                                    placeholder="••••••••"
                                    autoComplete="current-password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    <button
                        disabled={loading}
                        type="submit"
                        /* 👇 py-2.5 en móvil, py-3 en PC */
                        className="group relative flex w-full justify-center rounded-md bg-blue-600 px-3 py-2.5 md:py-3 text-sm md:text-base font-semibold text-white hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg">
                        {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'INICIAR TURNO'}
                    </button>
                </form>
            </div>
        </div>
    );
}
