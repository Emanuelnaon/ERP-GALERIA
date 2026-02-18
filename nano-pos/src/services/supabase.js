import { createClient } from "@supabase/supabase-js";

// Ahora el sistema las busca de forma segura en el entorno
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Si faltan las variables, el cliente avisará en la consola
if (!supabaseUrl || !supabaseKey) {
    console.error("❌ Error: Faltan las variables de entorno de Supabase");
}

export const supabase = createClient(supabaseUrl, supabaseKey);
