// Debe coincidir exactamente con el texto "Versión: ..." mostrado en
// politica-privacidad.html. Actualizar ambos valores juntos cada vez
// que cambie el contenido de la política (ver
// docs/tecnica/seguridad-y-politica-privacidad.md).
const POLITICA_PRIVACIDAD_VERSION = 'v1-2026-08-20';

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

    // Envio del formulario. Reescrito en el punto 16 por tres problemas
    // observados en pruebas reales:
    //
    // 1. El guard de doble envio estaba invertido. Ponia `disabled = true`
    //    ANTES de comprobar `dataset.submitting` y, al detectar un segundo
    //    submit, REHABILITABA el boton y restauraba el texto con la
    //    request todavia en vuelo.
    // 2. El unico feedback era reescribir el `textContent` del boton, asi
    //    que durante los segundos que tardan el INSERT y los dos envios
    //    SMTP la pagina parecia trabada.
    // 3. El mensaje de exito, tambien dentro del boton, pasaba
    //    desapercibido.
    //
    // Ahora el estado vive en una variable explicita (`enviando`), no en
    // el atributo `disabled` ni en un `dataset`: el DOM refleja el estado,
    // no lo define.
    const leadForm = document.getElementById('leadForm');
    const botonEnvio = document.getElementById('submitLead');
    const etiquetaEnvio = document.getElementById('submitLeadLabel');
    const cajaError = document.getElementById('formError');

    if (leadForm && botonEnvio && etiquetaEnvio) {
        const TEXTO_INICIAL = etiquetaEnvio.textContent;
        const TEXTO_ENVIANDO = 'Enviando solicitud...';

        // La fuente de verdad del estado de envio. `disabled` y
        // `aria-busy` son su reflejo en el DOM, no el estado en si.
        let enviando = false;

        const modal = document.getElementById('modalExito');
        let focoPrevioAlModal = null;

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

        function mostrarError(mensaje) {
            if (!cajaError) return;
            cajaError.textContent = mensaje;
            cajaError.hidden = false;
        }

        function limpiarError() {
            if (!cajaError) return;
            cajaError.textContent = '';
            cajaError.hidden = true;
        }

        function abrirModal() {
            if (!modal) return;
            focoPrevioAlModal = document.activeElement;
            modal.hidden = false;
            // Bloqueo de scroll del fondo mientras el dialogo esta
            // abierto. NO es una mascara de desborde: va sobre
            // `body.con-modal`, solo existe mientras el modal esta
            // visible, y se quita al cerrarlo.
            document.body.classList.add('con-modal');
            const cerrar = document.getElementById('modalExitoCerrar');
            if (cerrar) cerrar.focus();
        }

        function cerrarModal() {
            if (!modal || modal.hidden) return;
            modal.hidden = true;
            document.body.classList.remove('con-modal');
            // Devolver el foco a donde estaba evita que un lector de
            // pantalla quede al principio del documento.
            if (focoPrevioAlModal && typeof focoPrevioAlModal.focus === 'function') {
                focoPrevioAlModal.focus();
            }
            focoPrevioAlModal = null;
        }

        if (modal) {
            modal.querySelectorAll('[data-cerrar-modal]').forEach((elemento) => {
                elemento.addEventListener('click', cerrarModal);
            });
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && !modal.hidden) {
                    cerrarModal();
                }
            });
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
                version_politica_privacidad: POLITICA_PRIVACIDAD_VERSION,
            };

            limpiarError();
            bloquearEnvio();

            fetch('/api/leads', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(leadPayload),
            })
                .then((response) => {
                    if (response.status === 429) {
                        throw new Error('rate_limit');
                    }
                    // Los dos caminos de exito del endpoint responden 201,
                    // incluido el de idempotencia. Cualquier otra cosa es
                    // un fallo: no se resetea el formulario.
                    if (response.status !== 201) {
                        throw new Error('connection');
                    }
                    return response.json().catch(() => ({}));
                })
                .then(() => {
                    // Recien aca, con el 201 confirmado, se descarta lo
                    // que el usuario escribio.
                    leadForm.reset();
                    liberarEnvio();
                    abrirModal();
                })
                .catch((error) => {
                    // Ante error se conserva TODO lo escrito y se permite
                    // reintentar. Nunca se muestra detalle tecnico:
                    // ni request_id, ni codigos, ni errores de SMTP o
                    // Supabase.
                    mostrarError(
                        error && error.message === 'rate_limit'
                            ? 'Recibimos demasiados intentos desde esta conexión. Esperá unos minutos y volvé a intentarlo.'
                            : 'No pudimos enviar tu solicitud. Revisá tu conexión e intentá nuevamente.'
                    );
                    liberarEnvio();
                    botonEnvio.focus();
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
