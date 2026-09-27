# Control de casas, trabajadores y facturas

Este panel está en **/admin → Casas y trabajos**. La app Android abre el mismo sitio web, así que comparte solicitudes y cambios sin duplicar datos. Los trabajadores acceden desde **/crew** con Google y solamente ven las órdenes asignadas a su correo. Los correos de administración existentes conservan el acceso exclusivo a /admin.

## Activación de la base de datos

Aplicar la migración `supabase/migrations/20260926011329_crew_schedule_and_invoices.sql` al proyecto Supabase usado por el sitio, antes de fusionar/desplegar este cambio. Esta migración agrega `crew_members`, `service_plans`, `work_orders` y `work_invoices` sin modificar claves, clientes, solicitudes ni pagos existentes. Las tablas nuevas tienen RLS y permiten acceso únicamente desde rutas del servidor con `service_role`; el navegador nunca recibe esa clave. Se deben verificar la identidad del proyecto y una copia de seguridad de la base antes de aplicarla. La conexión Supabase de esta sesión no incluye este proyecto y por ello aún no se ejecutó la migración.

Tras aplicar, entrar en /admin con uno de los dos correos administradores y abrir **Casas y trabajos**: registrar trabajadores con su correo de Google, registrar casas adicionales o seleccionar solicitudes existentes, crear un plan con la frecuencia (semanal, quincenal o una visita), fecha inicial, hora preferida, duración en minutos, tarifa acordada y trabajador. Se generan hasta 12 semanas de visitas futuras; el botón **Extender agenda** repone el horizonte. La hora se guarda como horario local de Texas, por lo que el cambio de horario de verano no desplaza la fecha de servicio. Si una casa no cabe en el día del trabajador, se presenta un aviso para reasignarla.

En cada visita se guarda por separado el estado, importe pagado, método y notas. Los trabajadores pueden marcar las casas como iniciadas/terminadas y registrar el pago; si un cliente tiene dos cortes terminados sin liquidar, se bloquea iniciar un tercero desde /crew hasta hablar con el dueño. El dueño ve la alerta y puede revisar el caso. Pausar un plan cancela sus visitas futuras sin borrar el historial.

Una factura se crea **manualmente** desde una orden finalizada con precio y se descarga en PDF. El envío por correo también requiere una acción explícita y una dirección del cliente. Se guarda la fecha del envío solamente si el proveedor de correo confirma el éxito. Reutiliza la configuración de Resend o SMTP ya existente; sin ella las facturas pueden descargarse, pero el envío indicará que falta configurar correo. No se inventan impuestos ni se procesan pagos dentro de la aplicación.

## Verificación antes de habilitar al cliente

1. `npx tsc --noEmit`, `npm run build` y `node --experimental-strip-types --test tests/operations-schedule.test.mjs`.
2. Aplicar la migración en la base correcta y comprobar que la pestaña de operaciones devuelve las cuatro tablas sin error.
3. Crear una casa de prueba, trabajador y plan semanal de 60 minutos, y otro de 90 minutos en el mismo día para verificar la asignación de horas.
4. Iniciar sesión con el correo del trabajador y comprobar que solamente ve sus casas.
5. Marcar una visita terminada, registrar su pago, crear el PDF y enviar una factura a una dirección de prueba bajo control del dueño. Verificar que se guarda el estado enviado solo después de entregar el correo.
6. Eliminar únicamente los registros de prueba desde la consola autorizada, conservando los datos existentes.
