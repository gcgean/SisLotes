// Leitura simples de User-Agent — sem dependência nova. Cobre os casos comuns
// (Chrome/Firefox/Safari/Edge em Windows/Mac/Linux/Android/iOS). Não pretende
// ser exaustivo: é para o admin da plataforma ter uma ideia rápida do acesso,
// não um fingerprint preciso.

export interface InfoDispositivo {
  dispositivo: "Celular" | "Tablet" | "Desktop" | "Desconhecido";
  navegador: string;
  sistemaOperacional: string;
}

export function analisarUserAgent(userAgent: string | undefined | null): InfoDispositivo {
  const ua = userAgent ?? "";

  let dispositivo: InfoDispositivo["dispositivo"] = "Desconhecido";
  if (!ua) {
    dispositivo = "Desconhecido";
  } else if (/ipad|tablet(?!.*mobile)/i.test(ua)) {
    dispositivo = "Tablet";
  } else if (/mobi|iphone|android.*mobile/i.test(ua)) {
    dispositivo = "Celular";
  } else {
    dispositivo = "Desktop";
  }

  let sistemaOperacional = "Desconhecido";
  if (/windows nt/i.test(ua)) sistemaOperacional = "Windows";
  else if (/mac os x/i.test(ua) && !/iphone|ipad/i.test(ua)) sistemaOperacional = "macOS";
  else if (/android/i.test(ua)) sistemaOperacional = "Android";
  else if (/iphone|ipad|ios/i.test(ua)) sistemaOperacional = "iOS";
  else if (/linux/i.test(ua)) sistemaOperacional = "Linux";

  let navegador = "Desconhecido";
  if (/edg\//i.test(ua)) navegador = "Edge";
  else if (/opr\/|opera/i.test(ua)) navegador = "Opera";
  else if (/chrome\//i.test(ua) && !/edg\//i.test(ua)) navegador = "Chrome";
  else if (/firefox\//i.test(ua)) navegador = "Firefox";
  else if (/safari\//i.test(ua) && !/chrome\//i.test(ua)) navegador = "Safari";

  return { dispositivo, navegador, sistemaOperacional };
}
