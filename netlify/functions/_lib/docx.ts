/* Export Word reprenant la mise en page OneNote de l'agence :
   titre de page avec filet, libellés « … : », champs-clés en couleur, sous-titres gras soulignés,
   consignes NB en gris italique, une page par section. */
import { BorderStyle, Document, Packer, Paragraph, TextRun, UnderlineType } from "docx";
import { PAGES, fieldValue, type Cdc } from "../../../shared/model.ts";

const FONT = "Calibri";
const COLORS = { violet: "7030A0", red: "C00000", grey: "7F7F7F" };

function labelColor(cls = ""): string | undefined {
  if (cls.includes("violet")) return COLORS.violet;
  if (cls.includes("red")) return COLORS.red;
  return undefined;
}

export async function toDocx(c: Cdc): Promise<Buffer> {
  const children: Paragraph[] = [];

  PAGES.forEach((p, i) => {
    children.push(
      new Paragraph({
        pageBreakBefore: i > 0,
        spacing: { after: 240 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "808080", space: 4 } },
        children: [new TextRun({ text: p.title, font: FONT, size: 44 })],
      }),
    );

    for (const g of p.groups) {
      if (g.woo && !c.woo) continue;
      if (g.title) {
        children.push(
          new Paragraph({
            spacing: { before: 320, after: 120 },
            children: [new TextRun({ text: `${g.title} :`, font: FONT, size: 24, bold: true, underline: { type: UnderlineType.SINGLE } })],
          }),
        );
      }
      for (const [k, label] of g.checks ?? []) {
        children.push(new Paragraph({ spacing: { after: 60 }, children: [new TextRun({ text: `${c.checks?.[k] ? "☒" : "☐"}  ${label}`, font: FONT, size: 22 })] }));
      }
      for (const [k, label, o] of g.fields ?? []) {
        const color = labelColor(o?.cls);
        if (!o?.nolabel) {
          children.push(
            new Paragraph({
              spacing: { before: 140, after: 20 },
              keepNext: true,
              children: [new TextRun({ text: `${label} :`, font: FONT, size: 22, bold: !!o?.cls?.includes("key"), color, underline: o?.cls?.includes("red") ? { type: UnderlineType.SINGLE } : undefined })],
            }),
          );
        }
        if (o?.hint) {
          children.push(new Paragraph({ spacing: { after: 20 }, children: [new TextRun({ text: o.hint, font: FONT, size: 20, italics: true, color: COLORS.grey })] }));
        }
        const v = fieldValue(c, k);
        const lines = v ? v.split("\n") : [""];
        for (const line of lines) {
          children.push(new Paragraph({ spacing: { after: 20 }, indent: { left: 240 }, children: [new TextRun({ text: line, font: FONT, size: 22 })] }));
        }
      }
    }
  });

  const doc = new Document({
    creator: "YellowBrief – YellowTie",
    title: `Cahier des charges – ${fieldValue(c, "entreprise") || "Client"}`,
    styles: { default: { document: { run: { font: FONT, size: 22 } } } },
    sections: [{ properties: { page: { margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } }, children }],
  });
  return Packer.toBuffer(doc);
}
