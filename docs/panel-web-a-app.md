# Panel web actual y migracion a la app

Este documento describe todo lo que contiene hoy el panel de control del sitio web de Nieto Green Care LLC y como debe integrarse en la app. Tambien deja definido el camino para que el dueno pueda modificar el sitio manualmente desde una interfaz, sin tocar codigo, claves ni archivos del proyecto.

## Objetivo

1. Mantener el sitio web como pagina publica y cotizador.
2. Eliminar el panel administrativo del sitio solo cuando la app ya tenga las mismas funciones.
3. Mover el control diario del negocio a la app.
4. Agregar un editor del sitio para que el dueno pueda cambiar textos, servicios, precios, imagenes y contenido sin pedir cambios de codigo.

## Regla importante de migracion

No se debe borrar el panel web hasta que la app tenga todas estas funciones probadas:

- Acceso del dueno.
- Acceso de trabajadores.
- Solicitudes del cotizador.
- Clientes e historial.
- Precios del corte de cesped.
- Agenda y ordenes de trabajo.
- Facturas.
- Galeria.
- Opiniones.
- Calendario.
- Codigo QR del cotizador.
- Editor del contenido publico del sitio.

## Como modificar el sitio sin tocar codigo

Actualmente el dueno ya puede modificar algunas partes desde el panel web:

| Area editable hoy | Donde se modifica | Resultado |
|---|---|---|
| Precios del corte | Panel > Precios | Cambia las tarifas usadas por el cotizador |
| Galeria | Panel > Galeria | Publica u oculta fotos y videos en la pagina principal |
| Opiniones | Panel > Opiniones | Aprueba, oculta o elimina opiniones |
| Solicitudes | Panel > Solicitudes | Cambia estado, precio final y fecha programada |
| Calendario | Panel > Calendario / Casas y trabajos | Muestra trabajos programados y completados |
| Trabajadores | Panel > Casas y trabajos > Trabajadores | Agrega correos de trabajadores y activa/desactiva acceso |
| Facturas | Panel > Casas y trabajos > Facturas | Genera, descarga y envia facturas al cliente |

Todavia dependen del codigo:

- Textos principales de la pagina.
- Titulos y descripciones de secciones.
- Colores del sitio.
- Logo y marca.
- Lista publica de servicios si no esta conectada a base de datos.
- Preguntas frecuentes.
- Notas legales o notas de pago.
- Zonas de cobertura.
- Informacion de contacto.

Para que el dueno pueda modificar todo eso manualmente, la app debe incluir un modulo llamado **Editor del sitio**.

## Editor del sitio requerido en la app

El modulo **Editor del sitio** debe permitir editar:

| Seccion | Campos editables |
|---|---|
| Marca | Logo, nombre comercial, telefono, correo, direccion, redes sociales |
| Colores | Color principal, color secundario, color de botones, color de texto |
| Inicio | Titulo principal, subtitulo, texto de botones, imagenes destacadas |
| Servicios | Nombre, descripcion, precio base opcional, orden, visible/oculto |
| Cotizador | Notas visibles, textos de ayuda, textos de confirmacion |
| Zonas de servicio | Ciudades, dias de cobertura, notas del calendario |
| Metodos de pago | Zelle, Venmo, Cash App, texto de instrucciones |
| Preguntas frecuentes | Pregunta, respuesta, orden, visible/oculto |
| Galeria | Fotos, videos, titulo, visible/oculto |
| Opiniones | Aprobar, ocultar, eliminar |

## Tablas sugeridas para el editor del sitio

Estas tablas permiten que el contenido viva en Supabase y no dentro de archivos TSX:

| Tabla | Proposito |
|---|---|
| `site_settings` | Datos generales: logo, telefono, correo, colores, redes |
| `site_sections` | Textos por seccion: inicio, servicios, contacto, pagos |
| `site_services` | Servicios visibles para el publico y para el cotizador |
| `site_faqs` | Preguntas frecuentes editables |
| `site_coverage` | Ciudades y dias de servicio |
| `site_payment_methods` | Metodos de pago y notas visibles |
| `gallery_items` | Fotos y videos del sitio |
| `customer_reviews` | Opiniones publicas |

## Panel web actual

El panel actual se encuentra en `/admin` y esta protegido por correo y contrasena de Supabase. Tambien permite acceso con Google OAuth para administradores autorizados.

### Inicio de sesion del dueno

Funciones actuales:

- Ingreso con correo y contrasena.
- Validacion contra lista de correos administradores autorizados.
- Opcion de continuar con Google.
- Boton para volver al sitio.
- Boton para cerrar sesion.

### Tarjetas de resumen

El panel muestra metricas generales:

| Tarjeta | Que muestra |
|---|---|
| Ingresos totales | Suma de trabajos cobrados |
| Trabajos realizados | Cantidad de trabajos completados |
| Solicitudes pendientes | Cotizaciones pendientes |
| Area medida | Total de area medida en pies cuadrados |

## Modulos del panel que deben pasar a la app

### 1. Solicitudes

Muestra las solicitudes que llegan desde el cotizador.

Datos visibles:

- Nombre del cliente.
- Telefono.
- Direccion.
- Codigo de referencia.
- Servicios seleccionados.
- Area en pies cuadrados.
- Detalles del trabajo.
- Notas adicionales.
- Codigo de porton si existe.
- Estado.
- Precio final.
- Fecha y hora programada.

Acciones:

- Cambiar estado: pendiente, programado, completado o cancelado.
- Modificar precio final.
- Programar fecha y hora.
- Guardar cambios.
- Descargar archivo `.ics`.
- Abrir evento en Google Calendar.

### 2. Clientes

Muestra historial resumido por cliente.

Datos visibles:

- Nombre.
- Telefono.
- Total de solicitudes.
- Trabajos realizados.
- Total pagado.

### 3. Casas y trabajos

Este modulo es el centro operativo del negocio.

Submodulos actuales:

- Ordenes.
- Casas.
- Trabajadores.
- Facturas.

#### Ordenes

Funciones:

- Filtrar por fecha.
- Filtrar por estado.
- Filtrar por trabajador.
- Ver visitas programadas.
- Ver visitas en proceso.
- Ver visitas finalizadas.
- Ver visitas canceladas.
- Ver visitas sin liquidar.

Cada orden permite:

- Cambiar estado.
- Asignar trabajador.
- Modificar precio de factura.
- Registrar pago recibido.
- Registrar metodo de pago.
- Agregar notas.
- Guardar visita, precio y pago.
- Crear factura.
- Actualizar factura.
- Descargar factura.
- Enviar factura al cliente.

Aviso especial:

- Si un cliente tiene dos o mas cortes terminados sin liquidar, el panel muestra advertencia antes de continuar con otro servicio.

#### Casas

Actualmente el historial de casas se llena automaticamente desde las solicitudes del cotizador.

Datos visibles:

- Cliente.
- Direccion.
- Ciudad.
- Codigo postal.
- Telefono.
- Correo.
- Folio.

Acciones:

- Seleccionar casa.
- Asignar trabajador.
- Elegir frecuencia: semanal, quincenal o una vez.
- Elegir primera visita.
- Elegir hora de inicio.
- Definir duracion.
- Definir precio acordado por corte.
- Agregar instrucciones.
- Crear plan y organizar visitas.
- Pausar futuras visitas.
- Extender agenda 12 semanas.

#### Trabajadores

Funciones:

- Agregar nombre del trabajador.
- Agregar correo del trabajador.
- Activar acceso.
- Desactivar acceso.
- Ver numero de visitas asignadas.

Regla de acceso:

- El trabajador entra en `/crew`.
- La primera vez usa su correo registrado y crea una contrasena permanente.
- Despues entra con correo y contrasena.

#### Facturas

Funciones:

- La factura se llena automaticamente con cliente, direccion, fecha y precio.
- El precio puede modificarse desde la orden antes de enviar.
- Descargar PDF.
- Enviar factura al correo del cliente.
- Ver si la factura esta enviada.
- Ver saldo pendiente.
- Ver si esta pagada.

### 4. Precios

Funciones actuales:

- Editar reglas de precio para corte semanal.
- Editar reglas de precio para corte quincenal.
- Manejar rangos por area.
- Ver total cobrado.
- Ver pagos por cliente.
- Guardar pago final en la solicitud.

### 5. Galeria

Funciones actuales:

- Subir fotos.
- Subir videos.
- Publicar contenido en la pagina principal.
- Ocultar contenido.
- Eliminar contenido.

Formatos aceptados:

- JPG.
- PNG.
- WEBP.
- AVIF.
- MP4.
- MOV.
- WEBM.

Limite actual:

- 50 MB por archivo.

### 6. Opiniones

Funciones actuales:

- Ver opiniones de clientes.
- Aprobar opiniones.
- Ocultar opiniones.
- Eliminar opiniones.
- Las opiniones nuevas del sitio publico quedan publicadas automaticamente.

### 7. Calendario

Funciones actuales:

- Ver trabajos por dia.
- Filtrar por todos, pendiente, programado o completado.
- Mostrar eventos sincronizados.
- Resaltar dias ocupados con trabajos programados o completados.

### 8. Codigo QR

Funciones actuales:

- Mostrar tarjeta de codigo QR del cotizador.
- Permitir que el dueno comparta el acceso al cotizador.

## Panel de trabajadores actual

El panel de trabajadores se encuentra en `/crew`.

Funciones actuales:

- Ingreso con correo registrado.
- Creacion de contrasena permanente la primera vez.
- Inicio de sesion con correo y contrasena.
- Ver trabajos por dia.
- Ver direccion de la casa.
- Ver cliente.
- Ver telefono.
- Ver ciudad.
- Ver horario.
- Ver duracion.
- Ver precio.
- Ver estado de pago.
- Ver codigo de porton.
- Ver notas del cliente.
- Cambiar estado.
- Registrar pago recibido.
- Registrar metodo de pago.
- Agregar notas de visita.
- Guardar visita.
- Marcar trabajo realizado.

## APIs actuales que la app debe consumir o reemplazar

| Ruta | Uso |
|---|---|
| `/api/admin/leads` | Listar y actualizar solicitudes del cotizador |
| `/api/admin/metrics` | Cargar metricas, clientes y eventos |
| `/api/admin/pricing` | Leer y modificar reglas de precio |
| `/api/admin/gallery` | Administrar galeria |
| `/api/admin/gallery/upload-url` | Crear URL firmada para subir archivos |
| `/api/admin/reviews` | Administrar opiniones |
| `/api/admin/operations` | Casas, agenda, trabajadores, ordenes y planes |
| `/api/admin/operations/invoices` | Crear y enviar facturas |
| `/api/admin/operations/invoice-file` | Descargar PDF de factura |
| `/api/crew/orders` | Trabajos asignados al trabajador |

## Tablas principales que usa o debe usar la app

| Tabla | Proposito |
|---|---|
| `leads` | Solicitudes del cotizador |
| `pricing_rules` | Tarifas del corte de cesped |
| `gallery_items` | Fotos y videos |
| `customer_reviews` | Opiniones |
| `crew_members` | Trabajadores |
| `service_plans` | Planes recurrentes por casa |
| `work_orders` | Visitas individuales |
| `work_invoices` | Facturas de visitas |

## Flujo principal del negocio

1. Cliente llena el cotizador en el sitio.
2. Se crea una solicitud en `leads`.
3. El dueno revisa la solicitud en el panel o app.
4. El dueno ajusta precio, estado y fecha.
5. El dueno crea o actualiza el plan de servicio.
6. Se generan ordenes de trabajo.
7. El trabajador entra a la app o `/crew`.
8. El trabajador ve los trabajos del dia.
9. El trabajador marca el trabajo como realizado.
10. El dueno ve el trabajo completado.
11. Se genera factura.
12. La factura se envia al correo del cliente.

## Requisitos para la app del dueno

La app del dueno debe tener estas secciones:

| Seccion app | Debe incluir |
|---|---|
| Dashboard | Metricas, ingresos, pendientes, trabajos completados |
| Solicitudes | Cotizaciones recibidas y edicion de precio/estado/fecha |
| Clientes | Historial de clientes |
| Agenda | Calendario, visitas, filtros por fecha y trabajador |
| Casas | Historial automatico y planes de servicio |
| Trabajadores | Crear, activar, desactivar y ver asignaciones |
| Precios | Tarifas por frecuencia y area |
| Galeria | Subir, publicar, ocultar y eliminar fotos/videos |
| Opiniones | Aprobar, ocultar y eliminar |
| Facturas | Crear, descargar y enviar al cliente |
| QR | Compartir cotizador |
| Editor del sitio | Cambiar textos, colores, servicios, cobertura y metodos de pago |

## Requisitos para la app del trabajador

La app del trabajador debe tener:

- Login con correo y contrasena.
- Pantalla de trabajos del dia.
- Filtro por fecha.
- Detalle de cada casa.
- Boton de trabajo realizado.
- Campo de notas.
- Registro de pago recibido.
- Metodo de pago.
- Sin acceso a precios generales, otros trabajadores, clientes completos ni configuracion del sitio.

## Seguridad recomendada

- El dueno debe tener rol `admin`.
- Los trabajadores deben tener rol `worker`.
- Los trabajadores solo deben ver sus ordenes asignadas.
- El editor del sitio solo debe estar disponible para el dueno.
- Las claves de API no deben mostrarse ni editarse desde la app.
- Las variables de entorno deben seguir en Vercel/Supabase, no en pantallas publicas.

## Checklist antes de eliminar el panel web

- [ ] La app permite iniciar sesion como dueno.
- [ ] La app muestra solicitudes reales del cotizador.
- [ ] La app permite cambiar precio, estado y fecha.
- [ ] La app muestra clientes e historial.
- [ ] La app permite crear planes de servicio.
- [ ] La app genera ordenes de trabajo.
- [ ] La app permite agregar trabajadores.
- [ ] La app permite que trabajadores entren con contrasena.
- [ ] La app muestra trabajos por dia al trabajador.
- [ ] La app permite marcar trabajo realizado.
- [ ] La app genera factura.
- [ ] La app envia factura al cliente.
- [ ] La app administra galeria.
- [ ] La app administra opiniones.
- [ ] La app administra precios.
- [ ] La app incluye editor del sitio.
- [ ] La app fue probada en celular.
- [ ] El dueno confirma que ya no necesita `/admin`.

## Recomendacion final

La forma mas segura es no borrar el panel del sitio inmediatamente. Primero se debe construir la app con las mismas funciones, probarla con datos reales y despues ocultar o retirar `/admin`.

Para que el dueno pueda modificar el sitio a su gusto, la prioridad debe ser crear el modulo **Editor del sitio** dentro de la app. Ese modulo debe guardar textos, servicios, colores, cobertura, preguntas frecuentes, metodos de pago, galeria y opiniones en Supabase. Asi el sitio publico solo lee el contenido guardado y deja de depender de cambios manuales en codigo.
