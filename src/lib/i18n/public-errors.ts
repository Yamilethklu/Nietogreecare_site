const englishErrors: Record<string, string> = {
  "Ingrese la dirección del servicio.": "Enter the service address.",
  "El codigo postal debe tener 5 digitos.": "The ZIP code must contain 5 digits.",
  "Por el momento no damos servicio en ese código postal. Atendemos Liberty Hill, Cedar Park, Leander, Georgetown, Hutto, Round Rock y Jarrell.": "We do not currently serve that ZIP code. We serve Liberty Hill, Cedar Park, Leander, Georgetown, Hutto, Round Rock and Jarrell.",
  "Revise los datos del trabajo.": "Check the service request details.",
  "No se pudo conectar al panel.": "Could not connect to the dashboard.",
  "No se pudo registrar la solicitud.": "Could not register your request.",
  "Revise los campos requeridos.": "Check the required fields.",
  "La conexión de base de datos no está configurada.": "The database connection is not configured.",
  "Seleccione una fecha del 1 al 14, de hoy en adelante y con cobertura para su ciudad.": "Select a date from the 1st through the 14th, today or later, with service coverage for your city.",
  "El área marcada debe estar junto a la propiedad seleccionada.": "The selected area must be next to the selected property.",
  "Revise la medición del césped.": "Check the lawn measurement.",
  "No se pudieron obtener los precios.": "Could not retrieve prices.",
  "Todavía no hay un precio configurado para esta medida y frecuencia. Contáctenos para recibir ayuda.": "No price has been configured for this lawn size and frequency yet. Contact us for help.",
  "La tarifa cambió desde que abrió el cotizador. Revise el nuevo precio y confirme de nuevo.": "The rate has changed since you opened the quote form. Review the new price and confirm again.",
  "Tarifa no disponible.": "Rate unavailable.",
  "No se pudo guardar la solicitud.": "Could not save your request."
};

export function publicError(message: string | undefined, isEs: boolean, fallback: string): string {
  if (!message) return fallback;
  return isEs ? message : englishErrors[message] ?? fallback;
}
