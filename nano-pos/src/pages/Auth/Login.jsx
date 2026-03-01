import { useState } from "react";
import { supabase } from "../../services/supabase";
import { useNavigate } from "react-router-dom";
import { Lock, Mail, Loader2 } from "lucide-react";


export default function Login() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState(null);
    const navigate = useNavigate();

   const handleLogin = async (e) => {
       e.preventDefault();
       setLoading(true);
       setErrorMsg(null);

       try {
           // 1. Intentamos loguear con Supabase
           const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
               email,
               password,
           });

           if (authError) throw authError;

           // 2. Buscamos qué rol tiene este usuario en la base de datos
           const { data: perfil, error: perfilError } = await supabase
               .from('profiles')
               .select('rol')
               .eq('id', authData.user.id)
               .single();

           if (perfilError) throw perfilError;

           console.log('Usuario logueado como:', perfil?.rol);

           // 3. LA MAGIA DE RUTAS: Al dueño al panel, al empleado a la caja
           if (perfil?.rol === 'dueño') {
               navigate('/dashboard');
           } else {
               navigate('/pos');
           }
       } catch (err) {
           console.error('Error en login:', err);
           setErrorMsg('Credenciales incorrectas. Intenta de nuevo.');
       } finally {
           setLoading(false);
       }
   };

    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-950 px-4">
            <div className="w-full max-w-sm space-y-8 bg-gray-900 p-8 rounded-2xl border border-gray-800 shadow-2xl">
                {/* Encabezado */}
                <div className="text-center">
                    <h1 className="text-3xl font-bold tracking-tight text-white">
                        NANO POS
                    </h1>
                    <p className="mt-2 text-sm text-gray-400">
                        Ingresa tus credenciales de vendedor
                    </p>
                </div>

                {/* Mensaje de Error */}
                {errorMsg && (
                    <div className="bg-red-900/50 border border-red-800 text-red-200 text-sm p-3 rounded text-center">
                        {errorMsg}
                    </div>
                )}

                {/* Formulario */}
                <form onSubmit={handleLogin} className="mt-8 space-y-6">
                    <div className="space-y-4 rounded-md shadow-sm">
                        <div className="relative">
                            <Mail className="absolute left-3 top-3 h-5 w-5 text-gray-500" />
                            <input
                                type="email"
                                required
                                className="block w-full rounded-md border-0 bg-gray-800 py-3 pl-10 text-white placeholder:text-gray-500 focus:ring-2 focus:ring-blue-600 sm:text-sm"
                                placeholder="nombre@local.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>
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
                        className="group relative flex w-full justify-center rounded-md bg-blue-600 px-3 py-3 text-sm font-semibold text-white hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                        {loading ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                            "INICIAR TURNO"
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
}
