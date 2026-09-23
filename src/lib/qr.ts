import QRCode from "qrcode";

/**
 * Generacion de codigos QR (solo servidor).
 * Se usa para enlaces oficiales de pago: cada QR apunta al perfil del negocio.
 */
export async function buildQrDataUrl(
  value: string,
  options: { size?: number } = {},
): Promise<string | null> {
  try {
    return await QRCode.toDataURL(value, {
      width: options.size ?? 320,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#090D16FF", light: "#FFFFFFFF" },
    });
  } catch {
    // Si la libreria falla, la interfaz muestra la URL en texto plano.
    return null;
  }
}