import type { ChartData } from "@/server/analytics";

export type ExportContext = {
  from: string;
  to: string;
  generatedAt: string;
  view: string;
  filters: string;
  demo: boolean;
};

export async function buildExcel(charts: ChartData[], context: ExportContext) {
  const { Workbook } = await import("exceljs");
  const workbook = new Workbook();
  workbook.creator = "TRUF Innovators";
  workbook.created = new Date(context.generatedAt);
  const info = workbook.addWorksheet("Report information");
  info.columns = [{ width: 26 }, { width: 90 }];
  info.addRows([
    ["TRUF report", context.view],
    ["From (IST)", context.from],
    ["To (IST, inclusive)", context.to],
    ["Generated (UTC)", context.generatedAt],
    ["Applied filters", context.filters || "Default permitted scope"],
    [
      "Data source",
      context.demo
        ? "FICTIONAL DEMO DATA — not real revenue or customer traction"
        : "Authorized application records",
    ],
    [
      "Financial definition",
      "Collections are not profit. Cash series are INR, not paise. Settlements are separate.",
    ],
    [
      "Export scope",
      "Only the currently loaded, filtered chart data. This workbook contains data tables, not chart images.",
    ],
  ]);
  charts.forEach((chart, index) => {
    const name = `${index + 1} ${chart.title}`
      .replace(/[\\/*?:\[\]]/g, " ")
      .slice(0, 31);
    const sheet = workbook.addWorksheet(name);
    sheet.columns = [{ width: 30 }, ...chart.series.map(() => ({ width: 22 }))];
    sheet.addRow([chart.title]);
    sheet.addRow([chart.basis]);
    sheet.addRow([
      context.demo
        ? "Fictional demonstration data"
        : "Filtered application data",
    ]);
    sheet.addRow([]);
    sheet.addRow(["Period / category", ...chart.series]);
    for (const row of chart.rows) {
      // String values stay text, including titles beginning with '='; never create formulas.
      const added = sheet.addRow([
        String(row.date ?? ""),
        ...chart.series.map((key) => row[key] ?? ""),
      ]);
      for (let col = 2; col <= chart.series.length + 1; col++) {
        if (typeof added.getCell(col).value === "number")
          added.getCell(col).numFmt =
            chart.id === "cash"
              ? '"₹" #,##0.00;[Red]("₹" #,##0.00)'
              : chart.id === "utilization"
                ? '0"%"'
                : "#,##0.##";
      }
    }
    if (!chart.rows.length) sheet.addRow(["No records in the selected period"]);
    sheet.views = [{ state: "frozen", ySplit: 5 }];
    if (chart.rows.length)
      sheet.autoFilter = {
        from: { row: 5, column: 1 },
        to: { row: 5 + chart.rows.length, column: 1 + chart.series.length },
      };
    sheet.getRow(5).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(5).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF544279" },
    };
    sheet.getRow(1).font = {
      bold: true,
      size: 16,
      color: { argb: "FF544279" },
    };
  });
  for (const sheet of workbook.worksheets) {
    sheet.eachRow((row) => {
      row.alignment = { vertical: "top", wrapText: true };
    });
  }
  return workbook.xlsx.writeBuffer();
}

export async function downloadExcel(
  charts: ChartData[],
  context: ExportContext,
) {
  const buffer = await buildExcel(charts, context);
  const url = URL.createObjectURL(
    new Blob([new Uint8Array(buffer)], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = `TRUF-${context.view}-${context.from}-${context.to}.xlsx`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
