import React from 'react';
import { Printer, CheckCircle } from 'lucide-react';

export default function TicketVentaModal({ cart, total, numVenta, localNombre, vendedorEmail, onClose }) {
    const handlePrint = () => {
        window.print();
    };

    const fechaActual = new Date().toLocaleString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });

    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 print:static print:block print:p-0 print:bg-transparent">
            {/* FONDO OSCURO DEL MODAL */}
            <div className="fixed inset-0 bg-black/80 flex justify-center items-center z-50 p-4 print:p-0 print:bg-transparent">
                {/* CONTENEDOR PRINCIPAL: Limita la altura al 90% de la pantalla para que nunca se salga */}
                <div className="flex flex-col w-full max-w-sm md:max-w-md lg:max-w-xl max-h-[90vh] print:max-h-none print:max-w-none">
                    {/* 👇 EL TICKET (Acá está la clase "impresion-ticket" y "overflow-y-auto" para el scroll) 👇 */}
                    <div className="bg-gray-900 text-gray-200 border border-gray-700 font-mono p-6 md:p-8 shadow-2xl overflow-y-auto flex-1 impresion-ticket print:border-none print:shadow-none print:w-full print:max-w-[300px] print:p-0 print:bg-white print:text-black print:scale-100">
                        <div className="text-center mb-6 md:mb-10">
                            <h2 className="text-3xl md:text-4xl font-bold uppercase tracking-wider print:text-xl">
                                {localNombre}
                            </h2>
                            <p className="text-base md:text-lg text-gray-400 print:text-xs print:text-gray-600 mt-2">
                                Galería Esquina Multirubro
                            </p>
                            <p className="text-base md:text-lg text-gray-400 print:text-xs print:text-gray-600">
                                IVA Responsable Inscripto
                            </p>

                            <div className="border-b-2 border-dashed border-gray-600 print:border-black my-4 md:my-6"></div>

                            <p className="text-base md:text-xl print:text-xs">
                                Ticket N°: {numVenta.toString().padStart(8, '0')}
                            </p>
                            <p className="text-base md:text-xl print:text-xs">Fecha: {fechaActual}</p>
                            <p className="text-base md:text-xl truncate print:text-xs">Cajero: {vendedorEmail}</p>

                            <div className="border-b-2 border-dashed border-gray-600 print:border-black my-4 md:my-6"></div>
                        </div>

                        <div className="mb-6 md:mb-10">
                            <table className="w-full text-left text-base md:text-xl print:text-xs">
                                <thead>
                                    <tr className="border-b border-gray-600 print:border-black">
                                        <th className="pb-3 print:pb-1 w-2/4">Cant/Art</th>
                                        <th className="pb-3 print:pb-1 w-1/4 text-right">Precio</th>
                                        <th className="pb-3 print:pb-1 w-1/4 text-right">Subt</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {cart.map((item, index) => (
                                        <tr
                                            key={index}
                                            className="border-b border-gray-800/50 print:border-none last:border-0">
                                            <td className="py-4 print:py-1 align-top pr-2">
                                                <span className="font-bold text-white print:text-black">
                                                    {item.cantidad}x
                                                </span>{' '}
                                                {item.nombre}
                                                {item.talle && (
                                                    <span className="block text-sm md:text-base text-gray-500 mt-1 print:text-[10px] print:mt-0">
                                                        Talle: {item.talle}
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-4 print:py-1 align-top text-right text-gray-400 print:text-black">
                                                ${item.precio}
                                            </td>
                                            <td className="py-4 print:py-1 align-top text-right font-bold text-white print:text-black">
                                                ${item.precio * item.cantidad}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="border-t-2 border-dashed border-gray-600 print:border-black pt-6 md:pt-8 mb-8 md:mb-12">
                            <div className="flex justify-between items-center text-3xl md:text-5xl font-bold">
                                <span>TOTAL:</span>
                                <span className="text-green-400 print:text-black">${total}</span>
                            </div>
                            <p className="text-base md:text-lg text-right mt-2 text-gray-400 print:text-xs print:text-black">
                                Medio: EFECTIVO
                            </p>
                        </div>

                        <div className="text-center text-base md:text-lg text-gray-400 print:text-xs print:text-gray-600 pb-4">
                            <p>¡Gracias por su compra!</p>
                            <p>Conserve este ticket para cambios.</p>
                        </div>
                    </div>
                    {/* 👆 FIN DEL TICKET 👆 */}

                    {/* 👇 LOS BOTONES: Siempre pegados abajo en pantalla, ocultos en la impresora 👇 */}
                    <div className="flex gap-4 mt-4 print:hidden shrink-0">
                        <button
                            onClick={handlePrint}
                            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl flex justify-center items-center gap-3 font-bold shadow-lg text-xl transition-all active:scale-95">
                            {/* <Printer size={28} /> */} Imprimir
                        </button>
                        <button
                            onClick={onClose}
                            className="flex-1 bg-green-600 hover:bg-green-700 text-white py-4 rounded-xl flex justify-center items-center gap-3 font-bold shadow-lg text-xl transition-all active:scale-95">
                            {/* <CheckCircle size={28} /> */} Listo
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
