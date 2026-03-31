import { useState } from 'react';
import { supabase } from '../services/supabase';
import { UploadCloud, AlertCircle, CheckCircle, Info, Store } from 'lucide-react';

const LOCALES = [
    { id: 1, nombre: 'Zapatería' },
    { id: 2, nombre: 'Ropa' },
    { id: 3, nombre: 'Librería' },
    { id: 4, nombre: 'Regalería' },
];

// 👇 EL CEREBRO DEL IMPORTADOR: Diccionario de sinónimos 👇
const DICCIONARIO_COLUMNAS = {
    nombre: ['nombre', 'prenda', 'articulo', 'art', 'descripción', 'descripcion', 'detalle', 'producto'],
    precio: ['precio', 'precio x mayor', 'costo', 'p.unit', 'importe', 'valor'],
    stock: ['stock', 'cant', 'cantidad', 'disponible', 'unidades'],
    codigo: ['codigo', 'códig', 'cod', 'ean', 'sku', 'barra'],
    talle: ['talle', 'talles', 'size', 'tamaño', 'medida'],
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
            const texto = evento.target.result;
            // Detectar separador
            const primeraLinea = texto.split('\n')[0];
            const separador = primeraLinea.includes(';') ? ';' : ',';

            const lineas = texto.split('\n').filter((linea) => linea.trim() !== '');

            if (lineas.length < 2) {
                setResultado('Error: El archivo está vacío o no tiene el formato correcto.');
                setCargando(false);
                return;
            }

            // Normalizamos los títulos de la primera fila
            const titulos = lineas[0].split(separador).map((t) => t.trim().toLowerCase().replace(/"/g, ''));

            // 👇 FUNCIÓN CAZADORA: Busca si alguna columna coincide con nuestro diccionario
            const encontrarIndice = (sinonimos) => {
                return titulos.findIndex((tituloExcel) => sinonimos.some((sinonimo) => tituloExcel.includes(sinonimo)));
            };

            // Buscamos las columnas usando la inteligencia del diccionario
            const idxNombre = encontrarIndice(DICCIONARIO_COLUMNAS.nombre);
            const idxPrecio = encontrarIndice(DICCIONARIO_COLUMNAS.precio);
            const idxStock = encontrarIndice(DICCIONARIO_COLUMNAS.stock);
            const idxCodigo = encontrarIndice(DICCIONARIO_COLUMNAS.codigo);
            const idxTalle = encontrarIndice(DICCIONARIO_COLUMNAS.talle);

            if (idxNombre === -1 || idxPrecio === -1) {
                setResultado(
                    "Error crítico: No se detectaron columnas válidas para 'Nombre' o 'Precio'. Verificá los títulos de tu archivo.",
                );
                setCargando(false);
                return;
            }

            let exitosos = 0;
            let fallados = 0;
            let detalles = [];

            // Procesamos desde la línea 1 (salteando los títulos)
            for (let i = 1; i < lineas.length; i++) {
                const celdas = lineas[i]
                    .split(separador)
                    .map((c) => c.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));

                const nombreRaw = celdas[idxNombre];
                const precioRaw = celdas[idxPrecio];

                // Si la columna existe extraemos el valor, sino null/0
                const stockRaw = idxStock !== -1 ? celdas[idxStock] : '0';
                const codigoRaw = idxCodigo !== -1 ? celdas[idxCodigo] : null;
                const talleRaw = idxTalle !== -1 ? celdas[idxTalle] : null;

                if (!nombreRaw || !precioRaw) {
                    fallados++;
                    detalles.push(`Fila ${i + 1}: Nombre o precio vacíos.`);
                    continue;
                }

                try {
                    // Limpieza de moneda y formato
                    const precioLimpio = precioRaw.replace(/[^0-9,-]+/g, '').replace(',', '.');
                    const precioFinal = Number(precioLimpio);

                    // Limpieza de Stock (Por si viene con letras como "10 un.")
                    const stockLimpio = stockRaw.replace(/[^0-9]+/g, '');
                    const stockFinal = Number(stockLimpio) || 0; // Si falla, queda en 0 por defecto

                    if (isNaN(precioFinal)) throw new Error(`Precio inválido: ${precioRaw}`);

                    // 1. Inyectar Producto
                    const { data: pData, error: pErr } = await supabase
                        .from('productos')
                        .insert([{ nombre: nombreRaw, precio_base: precioFinal, local_id: localDestino }])
                        .select('id')
                        .single();
                    if (pErr) throw pErr;

                    // 2. Inyectar Variante (AHORA CON TALLE Y STOCK SEGURO)
                    const { error: vErr } = await supabase.from('variantes').insert([
                        {
                            producto_id: pData.id,
                            local_id: localDestino, // Buena práctica vincular la variante al local también
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
            e.target.value = ''; // Resetea el input file
        };
        lector.readAsText(archivo);
    };

    return (
        <div className="bg-gray-800 p-6 rounded-xl border border-gray-600 mb-6 shadow-xl">
            <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <UploadCloud className="text-blue-400" /> Carga Masiva de Catálogo
            </h3>

            {/* 👇 SELECTOR GLOBAL DE LOCAL 👇 */}
            <div className="bg-gray-900 p-4 rounded-xl border border-gray-700 mb-6">
                <label className="text-gray-300 font-bold mb-2 flex items-center gap-2">
                    <Store size={18} className="text-blue-400" /> ¿A qué local vas a importar este Excel?
                </label>
                <select
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

            {/* 👇 MANUAL DE INSTRUCCIONES ACTUALIZADO 👇 */}
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
                        <b className="text-white">"prenda", "art", "detalle", "cant", "precio x mayor"</b>, etc. ¡Ya no
                        hace falta renombrarlas a mano!
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
