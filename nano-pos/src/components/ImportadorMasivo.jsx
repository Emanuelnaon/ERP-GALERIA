import { useState } from 'react';
import { supabase } from '../services/supabase';
import { UploadCloud, AlertCircle, CheckCircle, Info, Store } from 'lucide-react';

const LOCALES = [
    { id: 1, nombre: 'Zapatería' },
    { id: 2, nombre: 'Ropa' },
    { id: 3, nombre: 'Librería' },
    { id: 4, nombre: 'Regalería' },
];

// 👇 DICCIONARIO MEJORADO: Sin palabras cruzadas 👇
const DICCIONARIO_COLUMNAS = {
    codigo: ['cod', 'codigo', 'ean', 'sku', 'barra', 'art', 'articulo', 'referencia'],
    precio: ['precio', 'costo', 'valor', 'importe', 'mayor', 'menor'],
    stock: ['stock', 'cant', 'cantidad', 'disponible', 'unidades'],
    talle: ['talle', 'talles', 'size', 'tamaño', 'medida'],
    nombre: ['nombre', 'prenda', 'descripcion', 'detalle', 'producto', 'titulo', 'modelo'],
};

// 👇 PARSER CSV ROBUSTO (Evita que las comas dentro de un texto rompan las columnas) 👇
const parseCSVLine = (line, separator) => {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === separator && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current.trim());
    return result.map((c) => c.replace(/^"|"$/g, '').replace(/""/g, '"'));
};

export default function ImportadorMasivo() {
    const [cargando, setCargando] = useState(false);
    const [localDestino, setLocalDestino] = useState(1);
    const [resultado, setResultado] = useState(null);
    const [erroresDetalle, setErroresDetalle] = useState([]);

    const procesarArchivo = async (e) => {
        const archivo = e.target.files[0];
        if (!archivo) return;

        setCargando(true);
        setResultado(null);
        setErroresDetalle([]);

        const lector = new FileReader();
        lector.onload = async (evento) => {
            // 1. Limpiamos la "basura invisible" que deja Excel (BOM)
            const textoLimpio = evento.target.result.replace(/^\uFEFF/, '');

            const primeraLinea = textoLimpio.split('\n')[0];
            const separador = primeraLinea.includes(';') ? ';' : ',';

            const lineas = textoLimpio.split('\n').filter((linea) => linea.trim() !== '');

            if (lineas.length < 2) {
                setResultado('Error: El archivo está vacío o no tiene el formato correcto.');
                setCargando(false);
                return;
            }

            // Normalizamos los títulos (minúsculas y sin tildes)
            const titulos = parseCSVLine(lineas[0], separador).map((t) =>
                t
                    .toLowerCase()
                    .normalize('NFD')
                    .replace(/[\u0300-\u036f]/g, ''),
            );

            // 👇 ASIGNACIÓN INTELIGENTE CON ORDEN DE PRIORIDAD 👇
            let indices = { codigo: -1, precio: -1, stock: -1, talle: -1, nombre: -1 };
            let columnasDisponibles = titulos.map((_, i) => i); // Ej: [0, 1, 2, 3, 4]

            const buscarYAsignar = (clave, sinonimos) => {
                for (let idx of columnasDisponibles) {
                    const titulo = titulos[idx];
                    if (sinonimos.some((s) => titulo.includes(s))) {
                        indices[clave] = idx;
                        // Sacamos esta columna de la lista para que otra no se la robe
                        columnasDisponibles = columnasDisponibles.filter((i) => i !== idx);
                        return;
                    }
                }
            };

            // EL ORDEN ES CLAVE: Buscamos Código primero, para que Nombre no se confunda con "Código del Producto"
            buscarYAsignar('codigo', DICCIONARIO_COLUMNAS.codigo);
            buscarYAsignar('precio', DICCIONARIO_COLUMNAS.precio);
            buscarYAsignar('stock', DICCIONARIO_COLUMNAS.stock);
            buscarYAsignar('talle', DICCIONARIO_COLUMNAS.talle);
            buscarYAsignar('nombre', DICCIONARIO_COLUMNAS.nombre);

            if (indices.nombre === -1 || indices.precio === -1) {
                setResultado(
                    "Error crítico: No se detectaron columnas válidas para 'Nombre' o 'Precio'. Verificá los títulos de tu archivo.",
                );
                setCargando(false);
                return;
            }

            // 👇 EL ESCUDO ANTI-REACT PARA EL LOCAL 👇
            // Leemos el valor directo del HTML para que no haya errores de memoria
            const localElegidoReal = Number(document.getElementById('selector-local').value);

            let exitosos = 0;
            let fallados = 0;
            let detalles = [];

            // Procesamos los datos
            for (let i = 1; i < lineas.length; i++) {
                const celdas = parseCSVLine(lineas[i], separador);

                const nombreRaw = indices.nombre !== -1 ? celdas[indices.nombre] : null;
                const precioRaw = indices.precio !== -1 ? celdas[indices.precio] : null;
                const stockRaw = indices.stock !== -1 ? celdas[indices.stock] : '0';
                const codigoRaw = indices.codigo !== -1 ? celdas[indices.codigo] : null;
                const talleRaw = indices.talle !== -1 ? celdas[indices.talle] : null;

                if (!nombreRaw || !precioRaw) {
                    fallados++;
                    detalles.push(`Fila ${i + 1}: Nombre o precio vacíos.`);
                    continue;
                }

                try {
                    // Limpieza de moneda y formato
                    const precioLimpio = precioRaw.replace(/[^0-9,-]+/g, '').replace(',', '.');
                    const precioFinal = Number(precioLimpio);

                    // Limpieza estricta de Stock (Saca textos como "un." o "pares")
                    const stockLimpio = stockRaw.replace(/[^0-9]+/g, '');
                    const stockFinal = Number(stockLimpio) || 0;

                    if (isNaN(precioFinal)) throw new Error(`Precio inválido: ${precioRaw}`);

                    // 1. Inyectar Producto (Con el Local Real)
                    const { data: pData, error: pErr } = await supabase
                        .from('productos')
                        .insert([{ nombre: nombreRaw, precio_base: precioFinal, local_id: localElegidoReal }])
                        .select('id')
                        .single();
                    if (pErr) throw pErr;

                    // 2. Inyectar Variante (Con Talle, Stock y el Local Real)
                    const { error: vErr } = await supabase.from('variantes').insert([
                        {
                            producto_id: pData.id,
                            local_id: localElegidoReal,
                            stock_actual: stockFinal,
                            codigo_barras: codigoRaw,
                            talle: talleRaw,
                        },
                    ]);
                    if (vErr) throw vErr;

                    exitosos++;
                } catch (error) {
                    fallados++;
                    detalles.push(`Fila ${i + 1} (${nombreRaw}): ${error.message}`);
                }
            }

            setResultado(`Proceso finalizado. Guardados: ${exitosos} | Ignorados/Error: ${fallados}`);
            setErroresDetalle(detalles);
            setCargando(false);
            e.target.value = ''; // Resetea el input para poder subir el mismo archivo si hubo error
        };
        lector.readAsText(archivo);
    };

    return (
        <div className="bg-gray-800 p-6 rounded-xl border border-gray-600 mb-6 shadow-xl">
            <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <UploadCloud className="text-blue-400" /> Carga Masiva de Catálogo
            </h3>

            {/* 👇 SELECTOR GLOBAL DE LOCAL (Ahora con ID para lectura directa) 👇 */}
            <div className="bg-gray-900 p-4 rounded-xl border border-gray-700 mb-6">
                <label className="text-gray-300 font-bold mb-2 flex items-center gap-2">
                    <Store size={18} className="text-blue-400" /> ¿A qué local vas a importar este Excel?
                </label>
                <select
                    id="selector-local"
                    className="w-full bg-gray-800 text-white p-3 rounded-lg border border-gray-600 focus:border-blue-500 outline-none font-bold"
                    value={localDestino}
                    onChange={(e) => setLocalDestino(Number(e.target.value))}>
                    {LOCALES.map((l) => (
                        <option key={l.id} value={l.id}>
                            {l.nombre}
                        </option>
                    ))}
                </select>
            </div>

            <div className="bg-blue-900/20 border border-blue-800 p-5 rounded-xl mb-6">
                <h4 className="font-bold text-blue-400 flex items-center gap-2 mb-3">
                    <Info size={18} /> ¿Cómo preparar tu archivo antes de subirlo?
                </h4>
                <ol className="list-decimal list-inside text-sm text-gray-300 space-y-2 marker:text-blue-500 marker:font-bold">
                    <li>
                        Abrí tu lista en Excel. <b>Eliminá cualquier fila vacía, logo o membrete</b> que esté arriba de
                        todo. La Fila 1 tiene que contener los títulos.
                    </li>
                    <li>
                        El sistema es inteligente y detectará automáticamente columnas llamadas:{' '}
                        <b className="text-white">"prenda", "art", "detalle", "cant", "precio x mayor"</b>, etc.
                    </li>
                    <li>
                        Andá a "Archivo" &gt; "Guardar como..." y elegí el formato <b>CSV (delimitado por comas)</b> o{' '}
                        <b>CSV (UTF-8)</b>.
                    </li>
                </ol>
            </div>

            <div className="border-2 border-dashed border-gray-600 p-8 rounded-xl text-center hover:border-blue-500 transition-colors bg-gray-900/50">
                <input
                    type="file"
                    accept=".csv"
                    onChange={procesarArchivo}
                    id="archivo-csv"
                    disabled={cargando}
                    className="hidden"
                    onClick={(e) => {
                        e.target.value = null;
                    }} // Truco para permitir subir el mismo archivo 2 veces seguidas
                />
                <label
                    htmlFor="archivo-csv"
                    className={`cursor-pointer flex flex-col items-center gap-3 ${cargando ? 'opacity-50 pointer-events-none' : ''}`}>
                    <div className="bg-blue-600/20 p-4 rounded-full text-blue-400">
                        <UploadCloud size={32} />
                    </div>
                    <span className="text-lg font-bold text-white">
                        {cargando ? 'Inyectando datos, no cierres...' : 'Clic aquí para subir tu archivo .CSV'}
                    </span>
                </label>
            </div>

            {/* 👇 RESULTADOS 👇 */}
            {resultado && (
                <div
                    className={`mt-6 p-4 rounded-lg font-bold flex flex-col gap-3 ${resultado.includes('Error:') || (resultado.includes('Ignorados/Error: ') && !resultado.includes('Ignorados/Error: 0')) ? 'bg-orange-900/50 text-orange-400 border border-orange-800' : 'bg-green-900/50 text-green-400 border border-green-800'}`}>
                    <div className="flex items-center gap-2 text-lg">
                        {resultado.includes('Ignorados/Error: 0') ? <CheckCircle /> : <AlertCircle />} {resultado}
                    </div>
                    {erroresDetalle.length > 0 && (
                        <div className="bg-black/40 p-3 rounded-lg max-h-40 overflow-y-auto mt-2">
                            <ul className="text-sm font-normal space-y-1 text-gray-300">
                                {erroresDetalle.map((err, idx) => (
                                    <li key={idx}>❌ {err}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
