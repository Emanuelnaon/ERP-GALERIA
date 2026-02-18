import { createClient } from "@supabase/supabase-js";

// REEMPLAZA ESTO CON TUS CLAVES DE SUPABASE
const supabaseUrl = "https://qdzkuplssafeqxkagecf.supabase.co";
const supabaseKey ="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFkemt1cGxzc2FmZXF4a2FnZWNmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzNjk2MDksImV4cCI6MjA4Njk0NTYwOX0.nxEJpPyUfEBfXHeIu9O4dWwedCLZ1l07ZBULcbouSOY";

export const supabase = createClient(supabaseUrl, supabaseKey);
