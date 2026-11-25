/**
 * Exportación a Excel (.xlsx) sin dependencias: arma el libro (OOXML) y lo
 * empaqueta en un ZIP sin compresión.
 *
 * Diseño de marca Mouregal: membrete con logo, título, período y fecha;
 * franja lila; resumen (KPIs); cabecera morada con filtro; filas cebra;
 * soles, cantidades y % con formato numérico (Excel puede sumarlos); fila de
 * totales con fórmulas; sin cuadrícula, horizontal y ajustado a una página de
 * ancho al imprimir, con la cabecera repetida y "Página X de Y".
 */

export type Celda = string | number | boolean | null | undefined;
export type FilaExcel = Record<string, Celda>;

/** Cómo se muestra una columna numérica. Sin indicarlo se deduce del nombre. */
export type FormatoColumna = "moneda" | "cantidad" | "porcentaje" | "texto";

export interface MetaReporte {
  /** Título del documento; por defecto sale del nombre del archivo. */
  titulo?: string;
  /** "Del 01/11/2026 al 23/11/2026". */
  periodo?: string;
  /** Cifras destacadas bajo el título. */
  resumen?: { etiqueta: string; valor: string }[];
  /** Columnas que se suman en la fila de totales. */
  totales?: string[];
  /** Formato de columnas cuando el nombre no basta para deducirlo. */
  formatos?: Record<string, FormatoColumna>;
}

export const MARCA = "Mouregal · Flores y Detalles Deluxe";
const LOGO_URL = "logo-mouregal.png";
const LOGO_PROPORCION = 480 / 361;

/** Descarga `filas` como `<nombre>.xlsx`. Las columnas salen de las claves de la primera fila. */
export async function descargarExcel(nombre: string, filas: FilaExcel[], meta: MetaReporte = {}): Promise<void> {
  if (filas.length === 0) return;
  const logo = await cargarLogo();
  const blob = libroXlsx(filas, { ...meta, titulo: meta.titulo ?? titulo(nombre) }, logo);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${nombre}-${fechaArchivo()}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function cargarLogo(): Promise<Uint8Array | null> {
  try {
    const r = await fetch(LOGO_URL);
    return r.ok ? new Uint8Array(await r.arrayBuffer()) : null;
  } catch {
    return null; // sin conexión y sin caché: el Excel sale sin logo
  }
}

function fechaArchivo(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Lima" });
}

export function fechaGenerado(): string {
  return new Date().toLocaleString("es-PE", { timeZone: "America/Lima", dateStyle: "long", timeStyle: "short" });
}

const PALABRAS: Record<string, string> = {
  pct: "%",
  metodo: "método",
  telefono: "teléfono",
  vehiculo: "vehículo",
  direccion: "dirección",
  codigo: "código",
  categoria: "categoría",
  descripcion: "descripción",
  envio: "envío",
  envios: "envíos",
  minimo: "mínimo",
  produccion: "producción",
  cancelacion: "cancelación",
  lineas: "líneas",
  num: "n.º",
  ordenes: "órdenes",
};

/** "fechaEntrega" → "Fecha entrega", "margenPct" → "Margen %", "metodo" → "Método". */
export function titulo(clave: string): string {
  const t = clave
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .split(" ")
    .map((p) => PALABRAS[p] ?? p)
    .join(" ");
  return t.charAt(0).toUpperCase() + t.slice(1);
}

/** Formato de una columna: el indicado o, si no, deducido de su nombre y valores. */
export function formatoColumna(clave: string, filas: FilaExcel[], formatos?: Record<string, FormatoColumna>): FormatoColumna {
  if (formatos?.[clave]) return formatos[clave];
  if (!filas.every((f) => f[clave] == null || f[clave] === "" || typeof f[clave] === "number")) return "texto";
  if (!filas.some((f) => typeof f[clave] === "number")) return "texto";
  if (/pct|porcentaje/i.test(clave)) return "porcentaje";
  if (/total|pagado|saldo|ingreso|costo|margen|monto|precio|valor|ajuste|tarifa|moto|carro|cobrad|diferencia|descuento|subtotal|envio/i.test(clave))
    return "moneda";
  return "cantidad";
}

function xml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    // Caracteres de control no válidos en XML
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
}

function columna(i: number): string {
  let s = "";
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

// ---------- Estilos (índices de cellXfs en styles.xml) ----------

const E = {
  marca: 1,
  titulo: 2,
  periodo: 3,
  generado: 4,
  franja: 5,
  kpiEtiqueta: 6,
  kpiValor: 7,
  cabecera: 8,
  cabeceraDerecha: 9,
  pie: 10,
  /** Datos: 11 + cebra * 5 + formato. */
  dato: 11,
  /** Totales: 21 + formato. */
  total: 21,
  /** Resto de una tarjeta KPI combinada (relleno, sin la raya lila). */
  kpiEtiquetaResto: 26,
  kpiValorResto: 27,
} as const;

/** Variante de formato dentro de cada bloque de 5 estilos. */
const F = { texto: 0, entero: 1, decimal: 2, moneda: 3, porcentaje: 4 } as const;

function varianteFormato(formato: FormatoColumna, v: Celda): number {
  if (typeof v !== "number") return F.texto;
  if (formato === "moneda") return F.moneda;
  if (formato === "porcentaje") return F.porcentaje;
  return Number.isInteger(v) ? F.entero : F.decimal;
}

const ESTILOS = (() => {
  const color = (hex: string) => `<color rgb="FF${hex}"/>`;
  const fuente = (sz: number, hex: string, extra = "") => `<font>${extra}<sz val="${sz}"/>${color(hex)}<name val="Calibri"/><family val="2"/></font>`;
  const fuentes = [
    fuente(11, "2C2B2D"), // 0 base
    fuente(9, "9B73A1", "<b/>"), // 1 marca
    fuente(20, "4E345A", "<b/>"), // 2 título
    fuente(11, "73607C"), // 3 período
    fuente(9, "987F9C", "<i/>"), // 4 generado / pie
    fuente(9, "73607C"), // 5 etiqueta KPI
    fuente(14, "4E345A", "<b/>"), // 6 valor KPI
    fuente(10, "FFFFFF", "<b/>"), // 7 cabecera
    fuente(10, "2C2B2D"), // 8 dato
    fuente(10, "4E345A", "<b/>"), // 9 total
  ];
  const relleno = (hex: string) => `<fill><patternFill patternType="solid"><fgColor rgb="FF${hex}"/><bgColor indexed="64"/></patternFill></fill>`;
  const rellenos = [
    `<fill><patternFill patternType="none"/></fill>`,
    `<fill><patternFill patternType="gray125"/></fill>`,
    relleno("B584B9"), // 2 franja
    relleno("F4EDF5"), // 3 KPI
    relleno("4E345A"), // 4 cabecera
    relleno("FAF6FB"), // 5 cebra
  ];
  const linea = (lado: string, estilo: string, hex: string) => `<${lado} style="${estilo}">${color(hex)}</${lado}>`;
  const bordes = [
    `<border><left/><right/><top/><bottom/><diagonal/></border>`,
    `<border><left/><right/><top/>${linea("bottom", "thin", "ECE4EE")}<diagonal/></border>`, // 1 dato
    `<border><left/><right/>${linea("top", "medium", "4E345A")}${linea("bottom", "double", "4E345A")}<diagonal/></border>`, // 2 total
    `<border>${linea("left", "thick", "B584B9")}<right/><top/><bottom/><diagonal/></border>`, // 3 KPI
  ];
  const fmtNumero = [0, 3, 4, 164, 165]; // texto, #,##0, #,##0.00, S/, %
  const xf = (fmt: number, font: number, fill: number, border: number, alin = "") =>
    `<xf numFmtId="${fmt}" fontId="${font}" fillId="${fill}" borderId="${border}" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">${alin}</xf>`;
  const al = (h: string, v = "center", wrap = false, indent = 0) =>
    `<alignment horizontal="${h}" vertical="${v}"${wrap ? ' wrapText="1"' : ""}${indent ? ` indent="${indent}"` : ""}/>`;

  const xfs = [
    xf(0, 0, 0, 0), // 0
    xf(0, 1, 0, 0, al("left", "bottom")), // 1 marca
    xf(0, 2, 0, 0, al("left", "center")), // 2 título
    xf(0, 3, 0, 0, al("left", "center")), // 3 período
    xf(0, 4, 0, 0, al("left", "top")), // 4 generado
    xf(0, 0, 2, 0), // 5 franja
    xf(0, 5, 3, 3, al("left", "bottom", false, 1)), // 6 etiqueta KPI
    xf(0, 6, 3, 3, al("left", "top", false, 1)), // 7 valor KPI
    xf(0, 7, 4, 0, al("left", "center", true, 1)), // 8 cabecera
    xf(0, 7, 4, 0, al("right", "center", true, 1)), // 9 cabecera numérica
    xf(0, 4, 0, 0, al("left", "center")), // 10 pie
  ];
  for (const cebra of [0, 5]) {
    fmtNumero.forEach((fmt, i) => xfs.push(xf(fmt, 8, cebra, 1, al(i === 0 ? "left" : "right", "center", i === 0, 1))));
  }
  fmtNumero.forEach((fmt, i) => xfs.push(xf(fmt, 9, 0, 2, al(i === 0 ? "left" : "right", "center", false, 1))));
  xfs.push(xf(0, 5, 3, 0), xf(0, 6, 3, 0)); // 26, 27 resto de la tarjeta KPI

  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<numFmts count="2"><numFmt numFmtId="164" formatCode="&quot;S/ &quot;#,##0.00;[Red]&quot;-S/ &quot;#,##0.00"/><numFmt numFmtId="165" formatCode="0.0&quot; %&quot;"/></numFmts>` +
    `<fonts count="${fuentes.length}">${fuentes.join("")}</fonts>` +
    `<fills count="${rellenos.length}">${rellenos.join("")}</fills>` +
    `<borders count="${bordes.length}">${bordes.join("")}</borders>` +
    `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
    `<cellXfs count="${xfs.length}">${xfs.join("")}</cellXfs>` +
    `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`
  );
})();

// ---------- Libro ----------

function libroXlsx(filas: FilaExcel[], meta: MetaReporte & { titulo: string }, logo: Uint8Array | null): Blob {
  const claves = Object.keys(filas[0]);
  const n = claves.length;
  const formatos = claves.map((k) => formatoColumna(k, filas, meta.formatos));
  const anchos = claves.map((k, i) => {
    const largo = Math.max(titulo(k).length + 2, ...filas.map((f) => formatoValor(f[k], formatos[i]).length));
    return Math.min(48, Math.max(10, largo + 3));
  });
  // La primera columna lleva el logo encima: necesita ~130 px.
  if (logo) anchos[0] = Math.max(anchos[0], 19);

  const celda = (ref: string, v: Celda, estilo = 0): string => {
    const s = estilo ? ` s="${estilo}"` : "";
    if (v === null || v === undefined || v === "") return `<c r="${ref}"${s}/>`;
    if (typeof v === "number" && Number.isFinite(v)) return `<c r="${ref}"${s}><v>${v}</v></c>`;
    if (typeof v === "boolean") return `<c r="${ref}" t="b"${s}><v>${v ? 1 : 0}</v></c>`;
    return `<c r="${ref}" t="inlineStr"${s}><is><t xml:space="preserve">${xml(String(v))}</t></is></c>`;
  };
  const vacias = (r: number, estilo: number, desde = 0) =>
    Array.from({ length: n - desde }, (_, i) => `<c r="${columna(i + desde)}${r}" s="${estilo}"/>`).join("");

  const filasXml: string[] = [];
  const combinadas: string[] = [];
  const fila = (r: number, alto: number | null, contenido: string) =>
    filasXml.push(`<row r="${r}"${alto ? ` ht="${alto}" customHeight="1"` : ""}>${contenido}</row>`);

  // Membrete: el texto va a la derecha del logo (columna B) o desde A si no hay logo.
  const colTexto = logo && n > 1 ? 1 : 0;
  const ultimaCol = columna(n - 1);
  const textoMembrete = (r: number, alto: number, v: string, estilo: number) => {
    fila(r, alto, celda(`${columna(colTexto)}${r}`, v, estilo));
    if (n - 1 > colTexto) combinadas.push(`${columna(colTexto)}${r}:${ultimaCol}${r}`);
  };
  textoMembrete(1, 20, MARCA.toUpperCase(), E.marca);
  textoMembrete(2, 34, meta.titulo, E.titulo);
  textoMembrete(3, 20, meta.periodo ?? "", E.periodo);
  textoMembrete(4, 20, `Generado el ${fechaGenerado()}`, E.generado);
  fila(5, 6, "");
  fila(6, 5, vacias(6, E.franja));
  fila(7, 12, "");
  let r = 8;

  // Resumen: tarjetas que reparten el ancho de la tabla (hasta 4 por renglón).
  const resumen = meta.resumen ?? [];
  const porRenglon = Math.max(1, Math.min(4, n));
  for (let i = 0; i < resumen.length; i += porRenglon) {
    const grupo = resumen.slice(i, i + porRenglon);
    // Cortes por ancho real: cada tarjeta ocupa ~el mismo ancho de hoja.
    const total = anchos.reduce((t, w) => t + w, 0);
    const inicios = [0];
    for (let j = 1; j < grupo.length; j++) {
      const objetivo = (total * j) / grupo.length;
      let c = inicios[j - 1] + 1;
      let acumulado = anchos.slice(0, c).reduce((t, w) => t + w, 0);
      while (c < n - (grupo.length - j) && acumulado + anchos[c] / 2 < objetivo) acumulado += anchos[c++];
      inicios.push(c);
    }
    const tarjetas = (fr: number, texto: (d: { etiqueta: string; valor: string }) => string, estilo: number, resto: number) =>
      grupo
        .map((d, j) => {
          const desde = inicios[j];
          const hasta = j === grupo.length - 1 ? n - 1 : inicios[j + 1] - 1;
          if (hasta > desde) combinadas.push(`${columna(desde)}${fr}:${columna(hasta)}${fr}`);
          return (
            celda(`${columna(desde)}${fr}`, texto(d), estilo) +
            Array.from({ length: hasta - desde }, (_, k) => `<c r="${columna(desde + k + 1)}${fr}" s="${resto}"/>`).join("")
          );
        })
        .join("");
    fila(r, 18, tarjetas(r, (d) => d.etiqueta.toUpperCase(), E.kpiEtiqueta, E.kpiEtiquetaResto));
    fila(r + 1, 26, tarjetas(r + 1, (d) => d.valor, E.kpiValor, E.kpiValorResto));
    r += 2;
  }
  if (resumen.length) {
    fila(r, 14, "");
    r++;
  }

  // Tabla
  const filaCabecera = r;
  fila(
    r,
    28,
    claves.map((k, i) => celda(`${columna(i)}${r}`, titulo(k), formatos[i] === "texto" ? E.cabecera : E.cabeceraDerecha)).join(""),
  );
  r++;
  const primeraDato = r;
  filas.forEach((f, idx) => {
    const cebra = idx % 2;
    fila(
      r,
      20,
      claves.map((k, i) => celda(`${columna(i)}${r}`, f[k], E.dato + cebra * 5 + varianteFormato(formatos[i], f[k]))).join(""),
    );
    r++;
  });
  const ultimaDato = r - 1;

  const totales = (meta.totales ?? []).filter((k) => claves.includes(k));
  if (totales.length) {
    const contenido = claves
      .map((k, i) => {
        const ref = `${columna(i)}${r}`;
        if (i === 0) return celda(ref, "Total", E.total + F.texto);
        if (!totales.includes(k)) return `<c r="${ref}" s="${E.total + F.texto}"/>`;
        const fmt = formatos[i] === "moneda" ? F.moneda : formatos[i] === "porcentaje" ? F.porcentaje : F.decimal;
        const suma = filas.reduce((t, f) => t + (typeof f[k] === "number" ? (f[k] as number) : 0), 0);
        const estilo = E.total + (fmt === F.decimal && Number.isInteger(suma) ? F.entero : fmt);
        return `<c r="${ref}" s="${estilo}"><f>SUBTOTAL(9,${columna(i)}${primeraDato}:${columna(i)}${ultimaDato})</f><v>${suma}</v></c>`;
      })
      .join("");
    fila(r, 24, contenido);
    r++;
  }
  fila(r, 10, "");
  r++;
  fila(r, 16, celda(`A${r}`, `${MARCA} · Documento generado por el ERP`, E.pie));

  const cols = anchos.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("");
  const rangoTabla = `A${filaCabecera}:${ultimaCol}${ultimaDato}`;
  const pie = `&amp;L&amp;8&amp;K987F9C${xml(MARCA)}&amp;R&amp;8&amp;K987F9CPágina &amp;P de &amp;N`;

  const hoja =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>` +
    `<sheetViews><sheetView showGridLines="0" workbookViewId="0"><pane ySplit="${filaCabecera}" topLeftCell="A${filaCabecera + 1}" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>` +
    `<sheetFormatPr defaultRowHeight="15"/>` +
    `<cols>${cols}</cols><sheetData>${filasXml.join("")}</sheetData>` +
    `<autoFilter ref="${rangoTabla}"/>` +
    (combinadas.length ? `<mergeCells count="${combinadas.length}">${combinadas.map((m) => `<mergeCell ref="${m}"/>`).join("")}</mergeCells>` : "") +
    `<printOptions horizontalCentered="1"/>` +
    `<pageMargins left="0.4" right="0.4" top="0.5" bottom="0.6" header="0.3" footer="0.3"/>` +
    `<pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/>` +
    `<headerFooter><oddFooter>${pie}</oddFooter></headerFooter>` +
    (logo ? `<drawing r:id="rId1"/>` : "") +
    `</worksheet>`;

  // Logo: 98 px de alto, anclado en A1 (las 4 filas del membrete miden ~126 px).
  const altoPx = 98;
  const emu = (px: number) => Math.round(px * 9525);
  const dibujo =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<xdr:oneCellAnchor><xdr:from><xdr:col>0</xdr:col><xdr:colOff>${emu(4)}</xdr:colOff><xdr:row>0</xdr:row><xdr:rowOff>${emu(10)}</xdr:rowOff></xdr:from>` +
    `<xdr:ext cx="${emu(altoPx * LOGO_PROPORCION)}" cy="${emu(altoPx)}"/>` +
    `<xdr:pic><xdr:nvPicPr><xdr:cNvPr id="2" name="Logo Mouregal" descr="Mouregal"/><xdr:cNvPicPr><a:picLocks noChangeAspect="1"/></xdr:cNvPicPr></xdr:nvPicPr>` +
    `<xdr:blipFill><a:blip r:embed="rId1"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill>` +
    `<xdr:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${emu(altoPx * LOGO_PROPORCION)}" cy="${emu(altoPx)}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr>` +
    `</xdr:pic><xdr:clientData/></xdr:oneCellAnchor></xdr:wsDr>`;

  const nombreHoja = xml(meta.titulo.replace(/[\\/?*[\]:]/g, " ").slice(0, 31) || "Datos");
  const rel = (id: string, tipo: string, destino: string) =>
    `<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/${tipo}" Target="${destino}"/>`;
  const rels = (contenido: string) =>
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${contenido}</Relationships>`;

  const archivos: [string, string | Uint8Array][] = [
    [
      "[Content_Types].xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
        `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/>` +
        `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
        `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
        `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
        (logo ? `<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>` : "") +
        `</Types>`,
    ],
    ["_rels/.rels", rels(rel("rId1", "officeDocument", "xl/workbook.xml"))],
    [
      "xl/workbook.xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
        `<sheets><sheet name="${nombreHoja}" sheetId="1" r:id="rId1"/></sheets><definedNames>` +
        `<definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">'${nombreHoja}'!$A$${filaCabecera}:$${ultimaCol}$${ultimaDato}</definedName>` +
        `<definedName name="_xlnm.Print_Titles" localSheetId="0">'${nombreHoja}'!$${filaCabecera}:$${filaCabecera}</definedName>` +
        `</definedNames></workbook>`,
    ],
    ["xl/_rels/workbook.xml.rels", rels(rel("rId1", "worksheet", "worksheets/sheet1.xml") + rel("rId2", "styles", "styles.xml"))],
    ["xl/styles.xml", ESTILOS],
    ["xl/worksheets/sheet1.xml", hoja],
  ];
  if (logo) {
    archivos.push(
      ["xl/worksheets/_rels/sheet1.xml.rels", rels(rel("rId1", "drawing", "../drawings/drawing1.xml"))],
      ["xl/drawings/drawing1.xml", dibujo],
      ["xl/drawings/_rels/drawing1.xml.rels", rels(rel("rId1", "image", "../media/image1.png"))],
      ["xl/media/image1.png", logo],
    );
  }
  return new Blob([zipSinCompresion(archivos) as BlobPart], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

/** Texto de un valor tal como se ve (para calcular anchos y para el PDF). */
export function formatoValor(v: Celda, formato: FormatoColumna): string {
  if (v == null || v === "") return "—";
  if (typeof v !== "number") return String(v);
  if (formato === "moneda") return `S/ ${v.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (formato === "porcentaje") return `${v.toLocaleString("es-PE", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;
  const dec = Number.isInteger(v) ? 0 : 2;
  return v.toLocaleString("es-PE", { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

// ---------- ZIP (método "stored") ----------

const TABLA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(datos: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < datos.length; i++) c = TABLA_CRC[(c ^ datos[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function zipSinCompresion(archivos: [string, string | Uint8Array][]): Uint8Array {
  const enc = new TextEncoder();
  const locales: Uint8Array[] = [];
  const centrales: Uint8Array[] = [];
  let offset = 0;

  for (const [ruta, contenido] of archivos) {
    const nombre = enc.encode(ruta);
    const datos = typeof contenido === "string" ? enc.encode(contenido) : contenido;
    const crc = crc32(datos);

    const local = new Uint8Array(30 + nombre.length + datos.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, 0x0800, true); // nombres en UTF-8
    lv.setUint16(8, 0, true); // sin compresión
    lv.setUint32(14, crc, true);
    lv.setUint32(18, datos.length, true);
    lv.setUint32(22, datos.length, true);
    lv.setUint16(26, nombre.length, true);
    local.set(nombre, 30);
    local.set(datos, 30 + nombre.length);
    locales.push(local);

    const central = new Uint8Array(46 + nombre.length);
    const cv = new DataView(central.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x0800, true);
    cv.setUint16(10, 0, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, datos.length, true);
    cv.setUint32(24, datos.length, true);
    cv.setUint16(28, nombre.length, true);
    cv.setUint32(42, offset, true);
    central.set(nombre, 46);
    centrales.push(central);

    offset += local.length;
  }

  const tamCentral = centrales.reduce((a, c) => a + c.length, 0);
  const fin = new Uint8Array(22);
  const fv = new DataView(fin.buffer);
  fv.setUint32(0, 0x06054b50, true);
  fv.setUint16(8, archivos.length, true);
  fv.setUint16(10, archivos.length, true);
  fv.setUint32(12, tamCentral, true);
  fv.setUint32(16, offset, true);

  const total = new Uint8Array(offset + tamCentral + fin.length);
  let p = 0;
  for (const parte of [...locales, ...centrales, fin]) {
    total.set(parte, p);
    p += parte.length;
  }
  return total;
}
