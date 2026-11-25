import { MARCA } from "./excel";

/**
 * Imprime (o guarda en PDF con el diálogo del navegador) un elemento de la
 * página con el formato de documento Mouregal: A4, márgenes, colores exactos
 * y pie con la marca y "Página X de Y" en cada hoja.
 *
 * Copia el elemento a un iframe oculto con los mismos estilos. Los gráficos
 * (canvas) no se copian con el HTML, así que se reemplazan por una imagen
 * de su contenido actual.
 */
export function imprimirElemento(elemento: HTMLElement, nombreArchivo: string, orientacion: "landscape" | "portrait" = "landscape"): void {
  const copia = elemento.cloneNode(true) as HTMLElement;
  const originales = elemento.querySelectorAll("canvas");
  copia.querySelectorAll("canvas").forEach((canvas, i) => {
    const original = originales[i];
    if (!original) return;
    const img = document.createElement("img");
    img.src = original.toDataURL("image/png");
    img.alt = original.getAttribute("aria-label") ?? "";
    img.style.width = `${original.clientWidth}px`;
    img.style.maxWidth = "100%";
    img.style.height = "auto";
    img.style.display = "block";
    canvas.replaceWith(img);
  });

  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:fixed;width:0;height:0;border:0;";
  document.body.appendChild(iframe);
  const win = iframe.contentWindow!;
  const estilos = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
    .map((e) => e.outerHTML)
    .join("");
  const titulo = nombreArchivo.replace(/[<>&"]/g, "");
  const pie = (contenido: string, extra: string) => `${contenido};font:${extra} Roboto,sans-serif;color:#987f9c`;
  const css =
    `@page{size:A4 ${orientacion};margin:12mm 12mm 16mm;` +
    `@bottom-left{${pie(`content:"${MARCA}"`, "600 8px")};letter-spacing:.18em;text-transform:uppercase;color:#9b73a1}` +
    `@bottom-right{${pie('content:"Página " counter(page) " de " counter(pages)', "9px")}}}` +
    `html,body{background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact}` +
    `.hoja{border:0!important;border-radius:0!important;padding:0!important;box-shadow:none!important}` +
    `tr,.no-cortar{break-inside:avoid}thead{display:table-header-group}tfoot{display:table-row-group}` +
    `.salto-antes{break-before:page}`;
  win.document.open();
  win.document.write(
    `<!doctype html><html lang="es"><head><meta charset="utf-8"><base href="${document.baseURI}"><title>${titulo}</title>${estilos}<style>${css}</style></head>` +
      `<body>${copia.outerHTML}</body></html>`,
  );
  win.document.close();
  // Espera estilos, fuentes y logo antes de abrir el diálogo.
  const lanzar = () => {
    void win.document.fonts?.ready.then(() => {
      win.focus();
      win.print();
      setTimeout(() => iframe.remove(), 1000);
    });
  };
  if (win.document.readyState === "complete") lanzar();
  else win.addEventListener("load", lanzar, { once: true });
}
