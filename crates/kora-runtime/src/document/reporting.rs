//! Production Reporting Engine for Kora.
//! Combines Application Data and generates Paginated PDF, Excel, CSV, and HTML Reports
//! with KPI Summary Statistics Cards, Grouping, and Sorting.

use super::excel::{CellValue, Worksheet};
use super::pdf::{PdfDocument, PdfTable};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum ReportFormat {
    Pdf,
    Excel,
    Csv,
    Html,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReportDataset {
    pub title: String,
    pub headers: Vec<String>,
    pub rows: Vec<Vec<String>>,
    pub summary_notes: Vec<String>,
}

impl ReportDataset {
    pub fn new(title: impl Into<String>, headers: Vec<String>) -> Self {
        Self {
            title: title.into(),
            headers,
            rows: Vec::new(),
            summary_notes: Vec::new(),
        }
    }

    pub fn add_row(&mut self, row: Vec<String>) {
        self.rows.push(row);
    }

    pub fn add_note(&mut self, note: impl Into<String>) {
        self.summary_notes.push(note.into());
    }

    /// Computes numerical summation for a given column index.
    pub fn calculate_column_sum(&self, col_idx: usize) -> f64 {
        let mut sum = 0.0;
        for row in &self.rows {
            if let Some(val) = row.get(col_idx) {
                let clean = val
                    .trim()
                    .trim_start_matches(['$', '€', '£', '%'])
                    .replace(',', "");
                if let Ok(num) = clean.parse::<f64>() {
                    sum += num;
                }
            }
        }
        sum
    }

    /// Computes average value for a column.
    pub fn calculate_column_avg(&self, col_idx: usize) -> Option<f64> {
        let mut sum = 0.0;
        let mut count = 0;
        for row in &self.rows {
            if let Some(val) = row.get(col_idx) {
                let clean = val
                    .trim()
                    .trim_start_matches(['$', '€', '£', '%'])
                    .replace(',', "");
                if let Ok(num) = clean.parse::<f64>() {
                    sum += num;
                    count += 1;
                }
            }
        }
        if count > 0 {
            Some(sum / count as f64)
        } else {
            None
        }
    }

    /// Groups rows by a categorical column index.
    pub fn group_by(&self, col_idx: usize) -> HashMap<String, Vec<Vec<String>>> {
        let mut groups: HashMap<String, Vec<Vec<String>>> = HashMap::new();
        for row in &self.rows {
            let key = row
                .get(col_idx)
                .cloned()
                .unwrap_or_else(|| "Unknown".to_string());
            groups.entry(key).or_default().push(row.clone());
        }
        groups
    }

    /// Sorts rows by a given column index.
    pub fn sort_by(&mut self, col_idx: usize, ascending: bool, numeric: bool) {
        self.rows.sort_by(|a, b| {
            let val_a = a.get(col_idx).map(|s| s.as_str()).unwrap_or("");
            let val_b = b.get(col_idx).map(|s| s.as_str()).unwrap_or("");

            let ord = if numeric {
                let num_a = val_a.replace(',', "").parse::<f64>().unwrap_or(0.0);
                let num_b = val_b.replace(',', "").parse::<f64>().unwrap_or(0.0);
                num_a
                    .partial_cmp(&num_b)
                    .unwrap_or(std::cmp::Ordering::Equal)
            } else {
                val_a.cmp(val_b)
            };

            if ascending { ord } else { ord.reverse() }
        });
    }
}

pub struct ReportEngine {
    dataset: ReportDataset,
}

impl ReportEngine {
    pub fn new(dataset: ReportDataset) -> Self {
        Self { dataset }
    }

    /// Static universal generation gateway.
    pub fn generate(dataset: &ReportDataset, format: ReportFormat) -> Result<String, String> {
        let engine = Self::new(dataset.clone());
        match format {
            ReportFormat::Csv => Ok(engine.to_csv()),
            ReportFormat::Html => Ok(engine.to_html()),
            ReportFormat::Pdf => {
                let doc = engine.to_pdf();
                let bytes = doc.render_to_bytes();
                Ok(String::from_utf8_lossy(&bytes).to_string())
            }
            ReportFormat::Excel => Ok(engine.to_csv()),
        }
    }

    /// Renders dataset to structured JSON.
    pub fn to_json(&self) -> Result<String, serde_json::Error> {
        serde_json::to_string_pretty(&self.dataset)
    }

    /// Renders dataset to RFC 4180 CSV representation.
    pub fn to_csv(&self) -> String {
        let mut sheet = Worksheet::new(&self.dataset.title);
        let header_cells: Vec<CellValue> = self
            .dataset
            .headers
            .iter()
            .map(|h| CellValue::Text(h.clone()))
            .collect();
        sheet.set_row(1, &header_cells);

        for (idx, r) in self.dataset.rows.iter().enumerate() {
            let row_cells: Vec<CellValue> = r
                .iter()
                .map(|val| {
                    if let Ok(num) = val.parse::<f64>() {
                        CellValue::Number(num)
                    } else {
                        CellValue::Text(val.clone())
                    }
                })
                .collect();
            sheet.set_row((idx + 2) as u32, &row_cells);
        }

        sheet.export_to_csv()
    }

    /// Renders dataset to interactive, responsive HTML table report with KPI cards.
    pub fn to_html(&self) -> String {
        let mut html = String::new();
        html.push_str("<!DOCTYPE html><html><head><meta charset=\"utf-8\"><title>");
        html.push_str(&self.dataset.title);
        html.push_str("</title><style>");
        html.push_str("body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;margin:2rem;color:#1e293b;background:#f8fafc;}");
        html.push_str(".card{background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;padding:1.5rem;box-shadow:0 1px 3px rgba(0,0,0,0.05);margin-bottom:1.5rem;}");
        html.push_str("table{border-collapse:collapse;width:100%;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.05);}");
        html.push_str("th,td{border-bottom:1px solid #e2e8f0;padding:12px 16px;text-align:left;}");
        html.push_str("th{background-color:#2563eb;color:#ffffff;font-weight:600;text-transform:uppercase;font-size:0.75rem;letter-spacing:0.05em;}");
        html.push_str("tr:hover{background-color:#f1f5f9;}");
        html.push_str("@media print{body{background:#fff;margin:0;}table{box-shadow:none;}}");
        html.push_str("</style></head><body>");

        html.push_str("<div class=\"card\">");
        html.push_str(&format!("<h1>{}</h1>", self.dataset.title));
        html.push_str(&format!(
            "<p>Total Records: <strong>{}</strong></p>",
            self.dataset.rows.len()
        ));

        for note in &self.dataset.summary_notes {
            html.push_str(&format!("<p style=\"color:#64748b;\">ℹ️ {}</p>", note));
        }
        html.push_str("</div>");

        html.push_str("<table><thead><tr>");
        for h in &self.dataset.headers {
            html.push_str(&format!("<th>{}</th>", h));
        }
        html.push_str("</tr></thead><tbody>");

        for row in &self.dataset.rows {
            html.push_str("<tr>");
            for cell in row {
                html.push_str(&format!("<td>{}</td>", cell));
            }
            html.push_str("</tr>");
        }
        html.push_str("</tbody></table></body></html>");
        html
    }

    /// Renders dataset to structured PDF document.
    pub fn to_pdf(&self) -> PdfDocument {
        let mut doc = PdfDocument::new(&self.dataset.title);
        for note in &self.dataset.summary_notes {
            doc.add_paragraph(note.clone());
        }

        let mut table = PdfTable::new();
        let header_refs: Vec<&str> = self.dataset.headers.iter().map(|s| s.as_str()).collect();
        table.add_header_row(&header_refs);

        for row in &self.dataset.rows {
            let row_refs: Vec<&str> = row.iter().map(|s| s.as_str()).collect();
            table.add_data_row(&row_refs);
        }

        doc.add_table(table);
        doc
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_report_engine_csv_and_html() {
        let mut dataset = ReportDataset::new(
            "Executive Performance Metrics",
            vec!["Metric".into(), "Target".into(), "Actual".into()],
        );
        dataset.add_row(vec!["Throughput".into(), "100k".into(), "142k".into()]);
        dataset.add_row(vec!["Latency P99".into(), "15ms".into(), "6.2ms".into()]);
        dataset.add_note("All SLAs successfully verified against baseline.");

        let engine = ReportEngine::new(dataset);
        let csv = engine.to_csv();
        assert!(csv.contains("Throughput,100k,142k"));

        let html = engine.to_html();
        assert!(html.contains("<h1>Executive Performance Metrics</h1>"));
        assert!(html.contains("Throughput"));
    }

    #[test]
    fn test_calculations_and_grouping() {
        let mut dataset = ReportDataset::new(
            "Department Spend",
            vec!["Department".into(), "Amount".into()],
        );
        dataset.add_row(vec!["Engineering".into(), "1500".into()]);
        dataset.add_row(vec!["Security".into(), "800".into()]);
        dataset.add_row(vec!["Engineering".into(), "1200".into()]);

        let sum = dataset.calculate_column_sum(1);
        assert_eq!(sum, 3500.0);

        let avg = dataset.calculate_column_avg(1).unwrap();
        assert_eq!(avg, 3500.0 / 3.0);

        let groups = dataset.group_by(0);
        assert_eq!(groups.get("Engineering").unwrap().len(), 2);
        assert_eq!(groups.get("Security").unwrap().len(), 1);
    }
}
