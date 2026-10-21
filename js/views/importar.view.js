/* Importación de CSV: cargar, revisar el informe, decidir y aplicar. */

import { el, vaciar, avisar } from '../utils/dom.js';
import { leerArchivo } from '../services/csv.service.js';
import { previsualizar, aplicar } from '../services/importacion.service.js';
import * as repo from '../db/clientes.repo.js';

export async function render(contenedor) {
  vaciar(contenedor);

  const existentes = await repo.contar();
  const panel = el('div');

  const entrada = el('input', {
    type: 'file',
    accept: '.csv,text/csv,text/plain',
    onchange: (evento) => {
      const archivo = evento.target.files && evento.target.files[0];
      if (archivo) cargar(archivo);
      evento.target.value = '';
    }
  });

  const zona = el('label', { class: 'zona-archivo' }, [
    entrada,
    el('strong', { texto: 'Elegir archivo CSV' }),
    el('span', {
      class: 'pista',
      texto: 'Columnas obligatorias: referencia de pago y nombre. Opcionales: documento, ' +
        'barrio, dirección, teléfonos, campaña, tarifa, cuota, saldo, facturas debidas, ' +
        'último pago, día de cobro, hora de cobro y notas.'
    })
  ]);

  contenedor.append(
    zona,
    el('p', {
      class: 'resumen',
      style: 'margin-top:12px',
      texto: existentes === 0
        ? 'Hoy no hay clientes guardados en el dispositivo.'
        : `Hoy tienes ${existentes} ${existentes === 1 ? 'cliente guardado' : 'clientes guardados'} en el dispositivo.`
    }),
    panel
  );

  async function cargar(archivo) {
    vaciar(panel).append(el('p', { class: 'vacio', texto: 'Leyendo el archivo…' }));

    try {
      const texto = await leerArchivo(archivo);
      const informe = await previsualizar(texto);
      mostrarInforme(informe, archivo.name);
    } catch (error) {
      vaciar(panel);
      avisar(error.message || 'No se pudo leer el archivo.', 'error');
    }
  }

  function mostrarInforme(informe, nombreArchivo) {
    vaciar(panel);

    if (informe.bloqueado) {
      panel.append(el('div', { class: 'bloque' }, [
        el('h2', { texto: 'Faltan columnas obligatorias' }),
        el('p', {
          texto: `El archivo no tiene ${informe.faltantes.join(' ni ')}. Agrega esa columna al CSV y vuelve a cargarlo.`
        })
      ]));
      return;
    }

    const porImportar = informe.nuevos.length + informe.repetidos.length;

    panel.append(el('div', { class: 'bloque' }, [
      el('h2', { texto: nombreArchivo }),
      el('ul', { class: 'conteos' }, [
        el('li', { class: 'ok' }, [
          el('b', { texto: String(informe.nuevos.length) }),
          el('span', { texto: 'nuevos' })
        ]),
        el('li', {}, [
          el('b', { texto: String(informe.repetidos.length) }),
          el('span', { texto: 'se actualizan' })
        ]),
        el('li', {}, [
          el('b', { texto: String(informe.choquesManuales.length) }),
          el('span', { texto: 'creados a mano' })
        ]),
        el('li', { class: informe.invalidos.length ? 'mal' : '' }, [
          el('b', { texto: String(informe.invalidos.length) }),
          el('span', { texto: 'con error' })
        ])
      ]),
      informe.sinReconocer.length
        ? el('p', {
            style: 'margin:6px 0 0;font-size:14px;color:var(--tinta-suave)',
            texto: `Columnas que se ignoran: ${informe.sinReconocer.join(', ')}.`
          })
        : null,
      informe.invalidos.length
        ? el('ul', { class: 'errores' }, informe.invalidos.slice(0, 40).map((item) =>
            el('li', { texto: `Fila ${item.fila}: ${item.motivo}` })
          ))
        : null
    ]));

    // --- Decisión: fusionar o reemplazar ---
    const modoFusion = el('input', { type: 'radio', name: 'modo', value: 'fusionar', checked: true });
    const modoReemplazo = el('input', { type: 'radio', name: 'modo', value: 'reemplazar' });
    const casillaManuales = el('input', { type: 'checkbox' });

    const bloqueManuales = el('div', { class: 'opcion', style: 'border-top:1px solid var(--linea)' }, [
      casillaManuales,
      el('span', { class: 'texto' }, [
        'Sobrescribir los clientes que creé a mano',
        el('small', {
          texto: `${informe.choquesManuales.length} ${informe.choquesManuales.length === 1 ? 'cliente coincide' : 'clientes coinciden'} con el archivo. Sin marcar, se quedan como están.`
        })
      ])
    ]);

    panel.append(el('div', { class: 'bloque' }, [
      el('h2', { texto: '¿Qué hago con lo que ya está guardado?' }),
      el('label', { class: 'opcion' }, [
        modoFusion,
        el('span', { class: 'texto' }, [
          'Fusionar',
          el('small', { texto: 'Agrego los nuevos y actualizo los que ya venían de un CSV.' })
        ])
      ]),
      el('label', { class: 'opcion' }, [
        modoReemplazo,
        el('span', { class: 'texto' }, [
          'Reemplazar la cartera',
          el('small', { texto: 'Borro lo importado antes y dejo solo este archivo.' })
        ])
      ]),
      informe.choquesManuales.length ? bloqueManuales : null,
      el('div', { class: 'acciones' }, [
        el('button', {
          type: 'button',
          class: 'btn-primario',
          texto: `Importar ${porImportar} ${porImportar === 1 ? 'cliente' : 'clientes'}`,
          disabled: porImportar === 0 && informe.choquesManuales.length === 0,
          onclick: async (evento) => {
            const boton = evento.currentTarget;
            boton.disabled = true;
            boton.textContent = 'Importando…';

            try {
              const resultado = await aplicar(informe, {
                modo: modoReemplazo.checked ? 'reemplazar' : 'fusionar',
                sobrescribirManuales: casillaManuales.checked
              });

              const partes = [
                `${resultado.creados} agregados`,
                `${resultado.actualizados} actualizados`
              ];
              if (resultado.respetados) partes.push(`${resultado.respetados} manuales intactos`);
              if (resultado.descartados) partes.push(`${resultado.descartados} con error`);

              avisar(partes.join(' · '), 'exito');
              location.hash = '#/clientes';
            } catch (error) {
              boton.disabled = false;
              boton.textContent = 'Reintentar importación';
              avisar(error.message || 'No se pudo importar.', 'error');
            }
          }
        })
      ])
    ]));
  }
}
