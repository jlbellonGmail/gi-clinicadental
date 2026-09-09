// Version de la politica que se envia junto al consentimiento.
//
// Antes era una constante de este archivo y habia que acordarse de
// moverla a mano cada vez que cambiaba el texto publicado. Ahora sale de
// `config/clinic.json`, el generador la escribe en un `<meta>` del HTML y
// aca solo se lee: la version enviada y la version publicada son el mismo
// dato, no dos copias que alguien tiene que mantener sincronizadas.
//
// El valor de reserva cubre un HTML sin ese `<meta>` (por ejemplo una
// copia vieja en cache). Enviar una version equivocada seria peor que
// enviar una declaradamente desconocida.
const POLITICA_PRIVACIDAD_VERSION_DESCONOCIDA = 'v0-0000-00-00';

function leerVersionPolitica(documento) {
    const meta = documento.querySelector('meta[name="politica-privacidad-version"]');
    const valor = meta && meta.getAttribute('content');
    return valor && valor.trim() ? valor.trim() : POLITICA_PRIVACIDAD_VERSION_DESCONOCIDA;
}

document.addEventListener('DOMContentLoaded', () => {
    // Header Scroll Effect
    const header = document.querySelector('header');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            header.style.padding = '10px 0';
            header.style.background = 'rgba(255, 255, 255, 0.98)';
        } else {
            header.style.padding = '0';
            header.style.background = 'rgba(255, 255, 255, 0.95)';
        }
    });

    // Smooth Scroll
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                window.scrollTo({
                    top: target.offsetTop - 80,
                    behavior: 'smooth'
                });
            }
        });
    });

    // Menu movil (hamburguesa). Correccion del punto 16, V12: en
    // pantallas chicas la navegacion horizontal no cabia y se salia del
    // viewport. El boton solo existe en las paginas que lo declaran; si
    // no esta, este bloque no hace nada.
    const navToggle = document.querySelector('.nav-toggle');
    const headerConNav = document.querySelector('header.has-mobile-nav');

    if (navToggle && headerConNav) {
        const cerrarMenu = () => {
            headerConNav.classList.remove('nav-open');
            navToggle.setAttribute('aria-expanded', 'false');
            navToggle.setAttribute('aria-label', 'Abrir menú de navegación');
        };

        navToggle.addEventListener('click', () => {
            const abierto = headerConNav.classList.toggle('nav-open');
            navToggle.setAttribute('aria-expanded', abierto ? 'true' : 'false');
            navToggle.setAttribute(
                'aria-label',
                abierto ? 'Cerrar menú de navegación' : 'Abrir menú de navegación'
            );
        });

        // Al elegir un destino el menu se cierra: si no, tapa el
        // contenido al que se acaba de navegar.
        headerConNav.querySelectorAll('.nav-links a, .header-cta a').forEach((enlace) => {
            enlace.addEventListener('click', cerrarMenu);
        });

        // Escape cierra, como cualquier menu desplegable.
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && headerConNav.classList.contains('nav-open')) {
                cerrarMenu();
                navToggle.focus();
            }
        });
    }

    // ---- Dialogos modales -------------------------------------------
    //
    // Un solo comportamiento para los dos dialogos del sitio: el del
    // resultado del envio y el de la politica de privacidad. Antes esta
    // logica vivia suelta dentro del bloque del formulario; se extrajo
    // porque duplicarla para el segundo dialogo habria significado dos
    // trampas de foco distintas que se separan con el tiempo.
    //
    // Lo que garantiza:
    //   - `hidden` como unica fuente de verdad de abierto/cerrado;
    //   - el foco vuelve al elemento exacto que lo abrio;
    //   - la posicion de scroll se conserva;
    //   - `Escape` y los disparadores de cierre cierran;
    //   - el Tab no se escapa del dialogo mientras esta abierto.
    const ENFOCABLES = [
        'a[href]',
        'button:not([disabled])',
        'input:not([disabled])',
        'select:not([disabled])',
        'textarea:not([disabled])',
        '[tabindex]:not([tabindex="-1"])',
    ].join(', ');

    function crearDialogo(modal, opciones) {
        if (!modal) return null;

        const config = opciones || {};
        const selectorCierre = config.selectorCierre || '[data-cerrar-modal]';
        let focoPrevio = null;
        let scrollPrevio = 0;

        function estaAbierto() {
            return !modal.hidden;
        }

        function abrir() {
            if (estaAbierto()) return;

            focoPrevio = document.activeElement;
            // El scroll se guarda y se restaura explicitamente.
            // `body.con-modal` aplica `overflow: hidden`, y aunque los
            // navegadores actuales conservan la posicion, dejarlo librado a
            // eso significaria que abrir la politica a mitad del formulario
            // pueda devolver al visitante al principio de la pagina.
            scrollPrevio = typeof window.scrollY === 'number' ? window.scrollY : 0;

            modal.hidden = false;
            // Bloqueo de scroll del fondo mientras el dialogo esta abierto.
            // NO es una mascara de desborde: va sobre `body.con-modal`, solo
            // existe mientras el modal esta visible, y se quita al cerrarlo.
            document.body.classList.add('con-modal');

            const inicial = typeof config.foco === 'function' ? config.foco() : null;
            if (inicial && typeof inicial.focus === 'function') {
                inicial.focus();
            }
        }

        function cerrar() {
            if (!estaAbierto()) return;

            modal.hidden = true;
            document.body.classList.remove('con-modal');

            if (typeof window.scrollTo === 'function') {
                window.scrollTo(0, scrollPrevio);
            }
            // Devolver el foco a donde estaba evita que un lector de
            // pantalla quede al principio del documento.
            if (focoPrevio && typeof focoPrevio.focus === 'function') {
                focoPrevio.focus();
            }
            focoPrevio = null;
        }

        modal.querySelectorAll(selectorCierre).forEach((elemento) => {
            elemento.addEventListener('click', cerrar);
        });

        document.addEventListener('keydown', (e) => {
            if (!estaAbierto()) return;

            if (e.key === 'Escape') {
                cerrar();
                return;
            }

            // Trampa de foco. Con `aria-modal="true"` el resto del documento
            // se anuncia como inerte, pero el Tab del teclado igual se escapa
            // si nadie lo retiene: el foco terminaba en la pagina de atras,
            // que visualmente esta tapada.
            if (e.key !== 'Tab') return;

            const caja = modal.querySelector('.modal__caja');
            const items = caja ? Array.from(caja.querySelectorAll(ENFOCABLES)) : [];
            if (items.length === 0) {
                e.preventDefault();
                return;
            }

            const primero = items[0];
            const ultimo = items[items.length - 1];
            const activo = document.activeElement;

            if (!caja.contains(activo)) {
                e.preventDefault();
                primero.focus();
            } else if (e.shiftKey && activo === primero) {
                e.preventDefault();
                ultimo.focus();
            } else if (!e.shiftKey && activo === ultimo) {
                e.preventDefault();
                primero.focus();
            }
        });

        return { abrir, cerrar, estaAbierto };
    }

    // ---- Politica de privacidad (capa 2, sin salir del formulario) ----
    //
    // El requisito es que abrir la politica con el formulario a medio
    // completar NO haga perder nada. La forma de garantizarlo no es guardar
    // y restaurar los valores -eso obligaria a persistir nombre, correo y
    // mensaje en algun lado-, sino **no navegar**: se cancela la navegacion
    // y el formulario nunca se desmonta. Por eso aca no hay ningun
    // `localStorage`, y no debe agregarse.
    //
    // El `href` real se conserva en el HTML: sin JavaScript el enlace sigue
    // llevando a la pagina completa, que es la direccion canonica.
    const modalPolitica = document.getElementById('modalPolitica');
    const dialogoPolitica = crearDialogo(modalPolitica, {
        selectorCierre: '[data-cerrar-politica]',
        foco: () => document.getElementById('politicaCerrarX'),
    });

    if (dialogoPolitica) {
        document.querySelectorAll('a[data-abrir-politica]').forEach((enlace) => {
            enlace.addEventListener('click', (e) => {
                // Si el visitante pidio explicitamente otra pestaña
                // (Ctrl/Cmd/Shift o boton del medio), se respeta y se deja
                // que el navegador haga lo suyo.
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
                e.preventDefault();
                dialogoPolitica.abrir();
            });
        });
    }

    // Envio del formulario.
    //
    // Tres resultados terminales, no dos, y esa es la correccion central
    // de esta version: un 201 significa "el lead quedo registrado", NO
    // que las dos notificaciones hayan salido. El backend ahora lo dice
    // en la respuesta (`comunicacion_completa`), y aca se traduce a tres
    // mensajes distintos:
    //
    //   exito   -> lead registrado y ambos correos enviados
    //   parcial -> lead registrado, alguna notificacion sin completar
    //   error   -> el lead NO se pudo registrar
    //
    // La diferencia que importa: en `parcial` el lead YA existe, asi que
    // el mensaje dice explicitamente que no hace falta reenviar. Invitar
    // a reenviar ahi generaria un duplicado.
    const leadForm = document.getElementById('leadForm');
    const botonEnvio = document.getElementById('submitLead');
    const etiquetaEnvio = document.getElementById('submitLeadLabel');

    if (leadForm && botonEnvio && etiquetaEnvio) {
        const TEXTO_INICIAL = etiquetaEnvio.textContent;
        const TEXTO_ENVIANDO = 'Enviando solicitud...';

        // La fuente de verdad del estado de envio. `disabled` y
        // `aria-busy` son su reflejo en el DOM, no el estado en si.
        let enviando = false;

        const modal = document.getElementById('modalResultado');
        const cajaModal = document.getElementById('modalCaja');
        const dialogoResultado = crearDialogo(modal, {
            selectorCierre: '[data-cerrar-modal]',
            foco: () => document.getElementById('modalCerrar'),
        });

        function bloquearEnvio() {
            enviando = true;
            botonEnvio.disabled = true;
            botonEnvio.setAttribute('aria-busy', 'true');
            botonEnvio.setAttribute('aria-disabled', 'true');
            etiquetaEnvio.textContent = TEXTO_ENVIANDO;
        }

        function liberarEnvio() {
            enviando = false;
            botonEnvio.disabled = false;
            botonEnvio.removeAttribute('aria-busy');
            botonEnvio.removeAttribute('aria-disabled');
            etiquetaEnvio.textContent = TEXTO_INICIAL;
        }

        /**
         * Muestra una de las tres variantes del dialogo.
         * @param {'exito'|'parcial'|'error'} resultado
         */
        function mostrarResultado(resultado) {
            if (!dialogoResultado) return;

            let visible = null;
            modal.querySelectorAll('.modal__variante').forEach((variante) => {
                const corresponde = variante.dataset.resultado === resultado;
                variante.hidden = !corresponde;
                if (corresponde) visible = variante;
            });
            if (!visible) return;

            // El nombre accesible del dialogo tiene que ser el titulo de la
            // variante que se esta mostrando, no uno fijo.
            const titulo = visible.querySelector('.modal__titulo');
            if (cajaModal && titulo && titulo.id) {
                cajaModal.setAttribute('aria-labelledby', titulo.id);
            }

            dialogoResultado.abrir();
        }

        // Segunda barrera, por si algun navegador dejara pasar el click
        // sobre un boton ya deshabilitado. El guard real es el del submit.
        botonEnvio.addEventListener('click', (e) => {
            if (enviando) {
                e.preventDefault();
                e.stopPropagation();
            }
        });

        leadForm.addEventListener('submit', (e) => {
            e.preventDefault();

            // Guard central: cubre el click, el Enter y cualquier submit
            // programatico. Sale sin tocar nada, para no pisar el estado
            // del envio que ya esta en curso.
            if (enviando) {
                return;
            }

            // Segunda capa explícita de validación del consentimiento:
            // el atributo `required` del checkbox #consent ya impide que
            // este listener se dispare si no está marcado (validación
            // nativa HTML5), pero se verifica también aquí de forma
            // defensiva, sin reemplazar esa validación nativa.
            const consentCheckbox = document.getElementById('consent');
            if (!consentCheckbox || !consentCheckbox.checked) {
                return;
            }

            const leadPayload = {
                nombre: document.getElementById('name').value.trim(),
                email: document.getElementById('email').value.trim(),
                telefono: null, // el formulario actual no tiene campo de teléfono
                servicio: document.getElementById('service').value,
                mensaje: document.getElementById('message').value.trim() || null,
                consentimiento_privacidad: consentCheckbox.checked,
                version_politica_privacidad: leerVersionPolitica(document),
            };

            bloquearEnvio();

            fetch('/api/leads', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(leadPayload),
            })
                .then((response) => {
                    // Los dos caminos de exito del endpoint responden 201,
                    // incluido el de idempotencia. Cualquier otra cosa
                    // significa que el lead NO quedo registrado.
                    if (response.status !== 201) {
                        throw new Error('registro_fallido');
                    }
                    // Aca SI se lee el cuerpo, y solo para distinguir
                    // exito completo de parcial. Si viniera ilegible se
                    // asume lo conservador: parcial, que le dice al
                    // usuario que no reenvie. El lead esta registrado.
                    return response.json().catch(() => ({}));
                })
                .then((datos) => {
                    const completa = datos && datos.comunicacion_completa === true;
                    // El lead quedo registrado en los dos casos, asi que
                    // en los dos se limpia el formulario: dejarlo lleno
                    // invitaria a reenviar y duplicar.
                    leadForm.reset();
                    liberarEnvio();
                    mostrarResultado(completa ? 'exito' : 'parcial');
                })
                .catch(() => {
                    // Se conserva TODO lo escrito y se permite reintentar.
                    // Nunca se muestra detalle tecnico: ni request_id, ni
                    // codigos, ni errores de SMTP o Supabase.
                    //
                    // CASO AMBIGUO, declarado a proposito: si `fetch`
                    // rechaza no hubo respuesta, y la request pudo haber
                    // llegado e insertado el lead antes de perderse. No
                    // hay forma de distinguirlo desde el navegador.
                    //
                    // Reintentar es seguro igualmente porque el formulario
                    // conserva los datos y el endpoint es IDEMPOTENTE:
                    // ante el mismo nombre y email dentro de su ventana
                    // devuelve el lead que ya existe, sin insertar otro ni
                    // reenviar correos. Es la segunda linea de defensa, y
                    // es la que cubre este caso.
                    //
                    // Limite residual: pasada esa ventana, un reintento
                    // sobre un lead que si se habia guardado crea un
                    // duplicado. Queda documentado en
                    // docs/tecnica/estado-comunicacion-leads.md.
                    liberarEnvio();
                    mostrarResultado('error');
                });
        });
    }

    // Scroll Animations
    const observerOptions = {
        threshold: 0.1
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, observerOptions);

    // Initial fade setup
    const sections = document.querySelectorAll('.section, .hero, .service-card');
    sections.forEach(s => {
        s.style.opacity = '0';
        s.style.transform = 'translateY(30px)';
        s.style.transition = 'all 0.8s ease-out';
        observer.observe(s);
    });

    // Handle intersection observer classes manually via JS style if needed
    // or we can add a simple CSS class
    const style = document.createElement('style');
    style.textContent = `
        .visible {
            opacity: 1 !important;
            transform: translateY(0) !important;
        }
    `;
    document.head.appendChild(style);
});
