import { useState } from 'react';
import { supabase } from '../services/supabase';
import { UploadCloud, AlertCircle, CheckCircle, Info, Store, Target } from 'lucide-react';

const LOCALES = [
    { id: 1, nombre: 'Zapatería' },
    { id: 2, nombre: 'Ropa' },
    { id: 3, nombre: 'Librería' },
    { id: 4, nombre: 'Regalería' },
];

// 👇 HELPER 1: Convierte Letras de Excel a Índice de Array (Ej: A->0, B->1, AA->26)
const letraAIndice = (letra) => {
    if (!letra) return -1;
    // Limpiamos todo lo que no sea letra (por si el usuario escribe "Columna A" o "A5")
    const limpia = letra.toUpperCase().replace(/[^A-Z]/g, '');
    if (limpia.length === 0) return -1;

    let indice = 0;
    for (let i = 0; i < limpia.length; i++) {
        indice = indice * 26 + limpia.charCodeAt(i) - 64;
    }
    return indice - 1;
};

// 👇 HELPER 2: Parser CSV robusto (para que las comas internas no rompan todo)
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
    const [resultado, setResultado] = useState(null);
    const [erroresDetalle, setErroresDetalle] = useState([]);

    // 👇 ESTADO CENTRAL: La configuración del Francotirador 👇
    const [config, setConfig] = useState({
        local_id: 1,
        filaInicio: 2, // Por defecto asume que la 1 es el título y la 2 empieza la data
        colNombre: 'A',
        colPrecio: 'B',
        colStock: '',
        colCodigo: '',
        colTalle: '',
    });

    const handleConfigChange = (e) => {
        setConfig({ ...config, [e.target.name]: e.target.value });
    };

    const procesarArchivo = async (e) => {
        const archivo = e.target.files[0];
        if (!archivo) return;

        setCargando(true);
        setResultado(null);
        setErroresDetalle([]);

        // Traducimos las letras a índices matemáticos
        const idxNombre = letraAIndice(config.colNombre);
        const idxPrecio = letraAIndice(config.colPrecio);
        const idxStock = letraAIndice(config.colStock);
        const idxCodigo = letraAIndice(config.colCodigo);
        const idxTalle = letraAIndice(config.colTalle);
        const filaArranque = parseInt(config.filaInicio) - 1; // -1 porque el array empieza en 0

        if (idxNombre === -1 || idxPrecio === -1) {
            setResultado('Error crítico: Debes definir en qué letra de columna están el Nombre y el Precio.');
            setCargando(false);
            e.target.value = '';
            return;
        }

        const lector = new FileReader();
        lector.onload = async (evento) => {
            // Limpieza de basura invisible de Excel (BOM)
            const textoLimpio = evento.target.result.replace(/^\uFEFF/, '');

            const primeraLinea = textoLimpio.split('\n')[0];
            const separador = primeraLinea.includes(';') ? ';' : ',';

            const lineas = textoLimpio.split('\n').filter((linea) => linea.trim() !== '');

            if (lineas.length <= filaArranque) {
                setResultado(
                    `Error: Le dijiste al sistema que empiece en la fila ${config.filaInicio}, pero el archivo no tiene tantas filas.`,
                );
                setCargando(false);
                return;
            }

            let exitosos = 0;
            let fallados = 0;
            let detalles = [];

            // 👇 BARRIDO VERTICAL: Empezamos exactamente donde el usuario nos dijo 👇
            for (let i = filaArranque; i < lineas.length; i++) {
                const celdas = parseCSVLine(lineas[i], separador);

                const nombreRaw = celdas[idxNombre];
                const precioRaw = celdas[idxPrecio];
                const stockRaw = idxStock !== -1 ? celdas[idxStock] : '0';
                const codigoRaw = idxCodigo !== -1 ? celdas[idxCodigo] : null;
                const talleRaw = idxTalle !== -1 ? celdas[idxTalle] : null;

                // Validación Estricta 1: Fila vacía
                if (!nombreRaw && !precioRaw) continue; // Ignora la fila si está toda vacía

                // Validación Estricta 2: Faltan datos obligatorios
                if (!nombreRaw || !precioRaw) {
                    fallados++;
                    detalles.push(`Fila Excel ${i + 1}: Faltan datos obligatorios (Nombre o Precio).`);
                    continue;
                }

                try {
                    // Limpieza estricta de precio
                    const precioLimpio = precioRaw.replace(/[^0-9,-]+/g, '').replace(',', '.');
                    const precioFinal = Number(precioLimpio);

                    if (isNaN(precioFinal) || precioFinal <= 0) {
                        throw new Error(`El precio ingresado no es un número válido: "${precioRaw}"`);
                    }

                    // Limpieza estricta de stock
                    const stockLimpio = (stockRaw || '0').replace(/[^0-9]+/g, '');
                    const stockFinal = Number(stockLimpio) || 0;

                    // 1. Inyectar Producto
                    const { data: pData, error: pErr } = await supabase
                        .from('productos')
                        .insert([
                            {
                                nombre: nombreRaw.trim(),
                                precio_base: precioFinal,
                                local_id: Number(config.local_id),
                            },
                        ])
                        .select('id')
                        .single();

                    if (pErr) throw pErr;

                    // 2. Inyectar Variante
                    const { error: vErr } = await supabase.from('variantes').insert([
                        {
                            producto_id: pData.id,
                            local_id: Number(config.local_id),
                            stock_actual: stockFinal,
                            codigo_barras: codigoRaw ? codigoRaw.trim() : null,
                            talle: talleRaw ? talleRaw.trim() : null,
                        },
                    ]);

                    if (vErr) throw vErr;

                    exitosos++;
                } catch (error) {
                    fallados++;
                    detalles.push(`Fila Excel ${i + 1} (${nombreRaw}): ${error.message}`);
                }
            }

            setResultado(`Proceso finalizado. Importados: ${exitosos} | Fallidos: ${fallados}`);
            setErroresDetalle(detalles);
            setCargando(false);
            e.target.value = ''; // Resetea el input file
        };
        lector.readAsText(archivo);
    };

    return (
        <div className="bg-gray-800 p-6 rounded-xl border border-gray-600 mb-6 shadow-xl max-w-4xl mx-auto">
            <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <Target className="text-red-500" /> Extractor de Coordenadas Excel
            </h3>

            {/* 👇 PANEL DE CONFIGURACIÓN DEL FRANCOTIRADOR 👇 */}
            <div className="bg-gray-900 p-5 rounded-xl border border-gray-700 mb-6 shadow-inner">
                <div className="flex items-center gap-2 mb-4">
                    <Store size={18} className="text-blue-400" />
                    <label className="text-gray-300 font-bold">Local de Destino:</label>
                    <select
                        name="local_id"
                        className="bg-gray-800 text-white p-2 rounded-lg border border-gray-600 focus:border-blue-500 outline-none ml-2"
                        value={config.local_id}
                        onChange={handleConfigChange}>
                        {LOCALES.map((l) => (
                            <option key={l.id} value={l.id}>
                                {l.nombre}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="border-t border-gray-700 my-4"></div>

                <h4 className="text-blue-400 font-bold mb-3">Mapeo de Columnas (Ej: A, B, C)</h4>
                <p className="text-xs text-gray-400 mb-4">
                    Abre tu archivo CSV/Excel e indica en qué letra está cada dato.
                </p>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-400 mb-1">
                            Nombre <span className="text-red-400">*</span>
                        </label>
                        <input
                            type="text"
                            name="colNombre"
                            value={config.colNombre}
                            onChange={handleConfigChange}
                            placeholder="A"
                            className="w-full bg-gray-800 text-white p-2 rounded border border-gray-600 uppercase text-center"
                            maxLength="2"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-400 mb-1">
                            Precio <span className="text-red-400">*</span>
                        </label>
                        <input
                            type="text"
                            name="colPrecio"
                            value={config.colPrecio}
                            onChange={handleConfigChange}
                            placeholder="B"
                            className="w-full bg-gray-800 text-white p-2 rounded border border-gray-600 uppercase text-center"
                            maxLength="2"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-400 mb-1">Talle</label>
                        <input
                            type="text"
                            name="colTalle"
                            value={config.colTalle}
                            onChange={handleConfigChange}
                            placeholder="Opcional"
                            className="w-full bg-gray-800 text-white p-2 rounded border border-gray-600 uppercase text-center"
                            maxLength="2"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-400 mb-1">Stock</label>
                        <input
                            type="text"
                            name="colStock"
                            value={config.colStock}
                            onChange={handleConfigChange}
                            placeholder="Opcional"
                            className="w-full bg-gray-800 text-white p-2 rounded border border-gray-600 uppercase text-center"
                            maxLength="2"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-400 mb-1">Código</label>
                        <input
                            type="text"
                            name="colCodigo"
                            value={config.colCodigo}
                            onChange={handleConfigChange}
                            placeholder="Opcional"
                            className="w-full bg-gray-800 text-white p-2 rounded border border-gray-600 uppercase text-center"
                            maxLength="2"
                        />
                    </div>
                </div>

                <div className="border-t border-gray-700 my-4"></div>

                <div>
                    <label className="block text-sm font-bold text-blue-400 mb-1">
                        ¿En qué número de FILA empiezan los productos?
                    </label>
                    <p className="text-xs text-gray-400 mb-2">
                        Esto permite ignorar logos, títulos gigantes o cabeceras inútiles.
                    </p>
                    <input
                        type="number"
                        name="filaInicio"
                        value={config.filaInicio}
                        onChange={handleConfigChange}
                        min="1"
                        className="w-32 bg-gray-800 text-white p-2 rounded border border-gray-600 text-center text-lg font-bold"
                    />
                </div>
            </div>

            {/* 👇 ZONA DE DROP / UPLOAD 👇 */}
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
                    }}
                />
                <label
                    htmlFor="archivo-csv"
                    className={`cursor-pointer flex flex-col items-center gap-3 ${cargando ? 'opacity-50 pointer-events-none' : ''}`}>
                    <div className="bg-blue-600/20 p-4 rounded-full text-blue-400">
                        <UploadCloud size={32} />
                    </div>
                    <span className="text-lg font-bold text-white">
                        {cargando ? 'Disparando extracción...' : 'Clic aquí para subir tu archivo .CSV y extraer'}
                    </span>
                    <span className="text-sm text-gray-500">Asegúrate de haber configurado las coordenadas arriba</span>
                </label>
            </div>

            {/* 👇 RESULTADOS 👇 */}
            {resultado && (
                <div
                    className={`mt-6 p-4 rounded-lg font-bold flex flex-col gap-3 ${resultado.includes('Error:') || (resultado.includes('Fallidos: ') && !resultado.includes('Fallidos: 0')) ? 'bg-orange-900/50 text-orange-400 border border-orange-800' : 'bg-green-900/50 text-green-400 border border-green-800'}`}>
                    <div className="flex items-center gap-2 text-lg">
                        {resultado.includes('Fallidos: 0') ? <CheckCircle /> : <AlertCircle />} {resultado}
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
