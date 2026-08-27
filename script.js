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

    // Form Handling
    const leadForm = document.getElementById('leadForm');
    if (leadForm) {
        leadForm.addEventListener('submit', (e) => {
            e.preventDefault();

            // Segunda capa explícita de validación del consentimiento:
            // el atributo `required` del checkbox #consent ya impide que
            // este listener se dispare si no está marcado (validación
            // nativa HTML5), pero se verifica también aquí de forma
            // defensiva, sin reemplazar esa validación nativa.
            const consentCheckbox = document.getElementById('consent');
            if (!consentCheckbox || !consentCheckbox.checked) {
                return;
            }

            const btn = leadForm.querySelector('button');
            const originalText = btn.textContent;

            // Payload listo para que la feature 08-conexion-frontend-api
            // lo envíe con fetch('/api/leads', { method: 'POST', body:
            // JSON.stringify(leadPayload) }); no se transmite todavía en
            // esta feature.
            const leadPayload = {
                nombre: document.getElementById('name').value.trim(),
                email: document.getElementById('email').value.trim(),
                telefono: null, // el formulario actual no tiene campo de teléfono
                servicio: document.getElementById('service').value,
                mensaje: document.getElementById('message').value.trim() || null,
                consentimiento_privacidad: consentCheckbox.checked,
                version_politica_privacidad: POLITICA_PRIVACIDAD_VERSION,
            };

            btn.disabled = true;
            btn.textContent = 'Enviando solicitud...';
            btn.style.opacity = '0.7';
            btn.style.backgroundColor = 'var(--primary)';

            // Evitar solicitudes duplicadas
            if (btn.dataset.submitting) {
                btn.disabled = false;
                btn.textContent = originalText;
                btn.style.opacity = '1';
                btn.style.backgroundColor = 'var(--primary)';
                return;
            }
            btn.dataset.submitting = 'true';

            fetch('/api/leads', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(leadPayload)
            })
                .then(response => {
                    if (!response.ok) {
                        if (response.status === 429) {
                            btn.textContent = 'Demasiados intentos, espere unos minutos';
                            throw new Error('rate_limit');
                        }
                        throw new Error('connection');
                    }
                    return response.json();
                })
                .then((data) => {
                    btn.textContent = 'Solicitud recibida. La clínica se comunicará para confirmar el turno';
                    leadForm.reset();
                    setTimeout(() => {
                        btn.disabled = false;
                        btn.textContent = originalText;
                        btn.style.opacity = '1';
                        btn.style.backgroundColor = 'var(--primary)';
                        delete btn.dataset.submitting;
                    }, 3000);
                })
                .catch((error) => {
                    // Mover foco al botón para que el usuario pueda volver a intentar
                    btn.focus();

                    if (error.message === 'rate_limit') {
                        btn.textContent = 'Demasiados intentos, espere unos minutos';
                        setTimeout(() => {
                            btn.disabled = false;
                            btn.textContent = originalText;
                            btn.style.opacity = '1';
                            btn.style.backgroundColor = 'var(--primary)';
                            delete btn.dataset.submitting;
                        }, 5000);
                    } else {
                        btn.textContent = 'Error en la conexión, intente más tarde';
                        setTimeout(() => {
                            btn.disabled = false;
                            btn.textContent = originalText;
                            btn.style.opacity = '1';
                            btn.style.backgroundColor = 'var(--primary)';
                            delete btn.dataset.submitting;
                        }, 5000);
                    }
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
