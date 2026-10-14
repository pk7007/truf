import { expect, test } from "vitest";
import { Workbook } from "exceljs";
import { buildExcel } from "../src/lib/excel-export";
test("Excel preserves numeric INR, text safety, scope and demo disclosure", async () => {
  const buffer = await buildExcel(
    [
      {
        id: "cash",
        title: "Collections/refunds",
        kind: "bar",
        basis: "Capture date · INR",
        series: ["Captured", "Refunded"],
        rows: [{ date: "=1+1", Captured: 21000, Refunded: 3000 }],
        href: "/app/payments",
      },
    ],
    {
      from: "2026-10-06",
      to: "2026-10-12",
      generatedAt: "2026-10-13T00:00:00Z",
      view: "owner",
      filters: "sport=Football",
      demo: true,
    },
  );
  const workbook = new Workbook();
  await workbook.xlsx.load(buffer);
  expect(workbook.worksheets).toHaveLength(2);
  expect(workbook.worksheets[0].getCell("B5").value).toBe("sport=Football");
  expect(workbook.worksheets[0].getCell("B6").value).toContain("FICTIONAL");
  const sheet = workbook.worksheets[1];
  expect(sheet.getCell("A6").value).toBe("=1+1");
  expect(sheet.getCell("B6").value).toBe(21000);
  expect(sheet.getCell("B6").numFmt).toContain("₹");
  expect(sheet.getCell("C6").value).toBe(3000);
});
test("Excel supports empty data without inventing zero records", async () => {
  const buffer = await buildExcel(
    [
      {
        id: "empty",
        title: "Attendance",
        kind: "bar",
        basis: "Game date",
        series: ["Attended"],
        rows: [],
        href: "/app/matches",
      },
    ],
    {
      from: "2026-10-06",
      to: "2026-10-12",
      generatedAt: "2026-10-13T00:00:00Z",
      view: "player",
      filters: "",
      demo: false,
    },
  );
  const workbook = new Workbook();
  await workbook.xlsx.load(buffer);
  expect(workbook.worksheets[1].getCell("A6").value).toBe(
    "No records in the selected period",
  );
});
