import fs from "node:fs";
import XLSX from "xlsx";

const excelPath = "src/data/Poliomielite_2026.xlsx";
const jsonPath = "src/data/vacinacao.json";

const workbook = XLSX.readFile(excelPath, { cellDates: true });
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

const headerMonths = rows[1] ?? [];
const monthColumns = [];
for (let c = 2; c < headerMonths.length; c += 3) {
  const value = headerMonths[c];
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const month = `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}`;
    monthColumns.push({ month, coverageCol: c, vaccinatedCol: c + 1, populationCol: c + 2 });
  }
}

if (!monthColumns.length) throw new Error("Nenhum mês foi encontrado na planilha.");

let oldData = { rows: [] };
if (fs.existsSync(jsonPath)) {
  try {
    oldData = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  } catch {
    oldData = { rows: [] };
  }
}

const municipalityMap = new Map();
for (const item of oldData.rows ?? []) {
  if (item?.code && item?.name && item?.uf) {
    municipalityMap.set(String(item.code).padStart(6, "0"), { name: item.name, uf: item.uf });
  }
}

const dataRows = rows.slice(4).filter((r) => /^\d{6}$/.test(String(r?.[1] ?? "").trim()));

// If the copied Tríplice Viral JSON does not contain a municipality name/UF,
// use the official IBGE locality API as a fallback.
const missingCodes = [...new Set(dataRows.map((r) => String(r[1]).trim()).filter((code) => !municipalityMap.has(code)))];
if (missingCodes.length) {
  const response = await fetch("https://servicodados.ibge.gov.br/api/v1/localidades/municipios");
  if (!response.ok) throw new Error(`IBGE retornou HTTP ${response.status}`);
  const municipalities = await response.json();
  for (const m of municipalities) {
    const code = String(m.id).padStart(6, "0");
    const uf = m?.microrregiao?.mesorregiao?.UF?.sigla;
    if (m?.nome && uf) municipalityMap.set(code, { name: m.nome, uf });
  }
}

const outputRows = dataRows.map((r) => {
  const code = String(r[1]).trim().padStart(6, "0");
  const municipality = municipalityMap.get(code);
  if (!municipality) throw new Error(`Município não encontrado para o código IBGE ${code}`);

  const months = {};
  for (const { month, vaccinatedCol, populationCol } of monthColumns) {
    const v = Number(r[vaccinatedCol] ?? 0);
    const p = Number(r[populationCol] ?? 0);
    months[month] = {
      v: Number.isFinite(v) ? v : 0,
      p: Number.isFinite(p) ? p : 0,
    };
  }

  return { code, name: municipality.name, uf: municipality.uf, months };
});

const output = { months: monthColumns.map((x) => x.month), rows: outputRows };
fs.writeFileSync(jsonPath, JSON.stringify(output, null, 2) + "\n", "utf8");
console.log(`Gerado ${jsonPath}: ${outputRows.length} municípios, ${output.months.length} meses.`);
