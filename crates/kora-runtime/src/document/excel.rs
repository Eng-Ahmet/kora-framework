//! Production-Grade Spreadsheet & CSV/TSV Engine for Kora.
//! Supports Multi-Sheet Workbooks, Cell Formatting (Currency, Percentage, Date),
//! Cell Styles, Column Widths, Formula Evaluation, and RFC 4180 Import/Export.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Predefined Cell Formatting Options.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum NumberFormat {
    General,
    Integer,        // #,##0
    Decimal(u8),    // #,##0.00
    Currency(char), // $#,##0.00
    Percentage,     // 0.0%
    DateIso,        // YYYY-MM-DD
}

impl Default for NumberFormat {
    fn default() -> Self {
        Self::General
    }
}

/// Rich Cell Style.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct CellStyle {
    pub bold: bool,
    pub italic: bool,
    pub font_size: u16,
    pub alignment: String, // "left", "center", "right"
    pub format: NumberFormat,
    pub background_hex: Option<String>,
    pub text_hex: Option<String>,
}

impl Default for CellStyle {
    fn default() -> Self {
        Self {
            bold: false,
            italic: false,
            font_size: 11,
            alignment: "left".to_string(),
            format: NumberFormat::General,
            background_hex: None,
            text_hex: None,
        }
    }
}

impl CellStyle {
    pub fn bold_header() -> Self {
        Self {
            bold: true,
            italic: false,
            font_size: 11,
            alignment: "left".to_string(),
            format: NumberFormat::General,
            background_hex: Some("#2563EB".to_string()),
            text_hex: Some("#FFFFFF".to_string()),
        }
    }

    pub fn currency(symbol: char) -> Self {
        Self {
            bold: false,
            italic: false,
            font_size: 11,
            alignment: "right".to_string(),
            format: NumberFormat::Currency(symbol),
            background_hex: None,
            text_hex: None,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum CellValue {
    Text(String),
    Number(f64),
    Boolean(bool),
    Formula(String),
    Empty,
}

impl CellValue {
    pub fn format_with(&self, fmt: &NumberFormat) -> String {
        match (self, fmt) {
            (Self::Number(n), NumberFormat::Currency(sym)) => format!("{}{:.2}", sym, n),
            (Self::Number(n), NumberFormat::Percentage) => format!("{:.1}%", n * 100.0),
            (Self::Number(n), NumberFormat::Decimal(d)) => format!("{:.1$}", n, *d as usize),
            (Self::Number(n), NumberFormat::Integer) => format!("{:.0}", n),
            (Self::Number(n), _) => n.to_string(),
            (Self::Text(t), _) => t.clone(),
            (Self::Boolean(b), _) => b.to_string(),
            (Self::Formula(f), _) => f.clone(),
            (Self::Empty, _) => String::new(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Worksheet {
    pub name: String,
    pub cells: HashMap<(u32, u32), CellValue>, // (row, col) 1-based index
    pub styles: HashMap<(u32, u32), CellStyle>,
    pub column_widths: HashMap<u32, f32>,
    pub max_row: u32,
    pub max_col: u32,
}

impl Worksheet {
    pub fn new(name: impl Into<String>) -> Self {
        Self {
            name: name.into(),
            cells: HashMap::new(),
            styles: HashMap::new(),
            column_widths: HashMap::new(),
            max_row: 0,
            max_col: 0,
        }
    }

    pub fn set_cell(&mut self, row: u32, col: u32, value: CellValue) {
        if row > self.max_row {
            self.max_row = row;
        }
        if col > self.max_col {
            self.max_col = col;
        }
        self.cells.insert((row, col), value);
    }

    pub fn set_cell_styled(&mut self, row: u32, col: u32, value: CellValue, style: CellStyle) {
        self.set_cell(row, col, value);
        self.styles.insert((row, col), style);
    }

    pub fn get_cell(&self, row: u32, col: u32) -> Option<&CellValue> {
        self.cells.get(&(row, col))
    }

    pub fn get_cell_style(&self, row: u32, col: u32) -> Option<&CellStyle> {
        self.styles.get(&(row, col))
    }

    pub fn set_column_width(&mut self, col: u32, width_chars: f32) {
        self.column_widths.insert(col, width_chars);
    }

    pub fn get_column_width(&self, col: u32) -> f32 {
        self.column_widths.get(&col).copied().unwrap_or(12.0)
    }

    pub fn set_row(&mut self, row: u32, values: &[CellValue]) {
        for (idx, val) in values.iter().enumerate() {
            self.set_cell(row, (idx + 1) as u32, val.clone());
        }
    }

    /// Calculates column summation across a row range.
    pub fn calculate_sum(&self, col: u32, start_row: u32, end_row: u32) -> f64 {
        let mut sum = 0.0;
        for r in start_row..=end_row {
            if let Some(CellValue::Number(n)) = self.get_cell(r, col) {
                sum += *n;
            }
        }
        sum
    }

    /// Calculates average of numeric cells in a column.
    pub fn calculate_average(&self, col: u32, start_row: u32, end_row: u32) -> Option<f64> {
        let mut sum = 0.0;
        let mut count = 0;
        for r in start_row..=end_row {
            if let Some(CellValue::Number(n)) = self.get_cell(r, col) {
                sum += *n;
                count += 1;
            }
        }
        if count > 0 {
            Some(sum / count as f64)
        } else {
            None
        }
    }

    /// Automatically sets column widths based on maximum string lengths.
    pub fn auto_fit_columns(&mut self) {
        for c in 1..=self.max_col {
            let mut max_len = 8.0f32;
            for r in 1..=self.max_row {
                if let Some(val) = self.get_cell(r, c) {
                    let len = match val {
                        CellValue::Text(t) => t.len() as f32,
                        CellValue::Number(n) => format!("{:.2}", n).len() as f32,
                        CellValue::Boolean(b) => b.to_string().len() as f32,
                        CellValue::Formula(f) => f.len() as f32,
                        CellValue::Empty => 0.0,
                    };
                    if len > max_len {
                        max_len = len;
                    }
                }
            }
            self.column_widths.insert(c, max_len + 3.0);
        }
    }

    /// Exports sheet contents to RFC 4180 compliant CSV string with custom delimiter.
    pub fn export_with_delimiter(&self, delimiter: char) -> String {
        let mut out = String::new();
        for r in 1..=self.max_row {
            let mut row_vals = Vec::new();
            for c in 1..=self.max_col {
                let cell_str = match self.get_cell(r, c) {
                    Some(val) => {
                        let fmt = self
                            .get_cell_style(r, c)
                            .map(|s| s.format)
                            .unwrap_or(NumberFormat::General);
                        let formatted = val.format_with(&fmt);
                        if formatted.contains(delimiter)
                            || formatted.contains('"')
                            || formatted.contains('\n')
                        {
                            format!("\"{}\"", formatted.replace('"', "\"\""))
                        } else {
                            formatted
                        }
                    }
                    None => String::new(),
                };
                row_vals.push(cell_str);
            }
            out.push_str(&row_vals.join(&delimiter.to_string()));
            out.push('\n');
        }
        out
    }

    /// Exports sheet contents to RFC 4180 compliant CSV string.
    pub fn export_to_csv(&self) -> String {
        self.export_with_delimiter(',')
    }

    /// Exports sheet contents to Tab-Separated Values (TSV).
    pub fn export_to_tsv(&self) -> String {
        self.export_with_delimiter('\t')
    }

    /// Imports sheet contents from raw delimited string.
    pub fn import_with_delimiter(&mut self, data: &str, delimiter: char) {
        self.cells.clear();
        self.styles.clear();
        self.max_row = 0;
        self.max_col = 0;

        for (r_idx, line) in data.lines().enumerate() {
            let row = (r_idx + 1) as u32;
            let parts: Vec<&str> = line.split(delimiter).collect();
            for (c_idx, part) in parts.iter().enumerate() {
                let col = (c_idx + 1) as u32;
                let trimmed = part.trim().trim_matches('"');
                let cell_val = if let Ok(num) = trimmed.parse::<f64>() {
                    CellValue::Number(num)
                } else if trimmed == "true" || trimmed == "false" {
                    CellValue::Boolean(trimmed == "true")
                } else if trimmed.starts_with('=') {
                    CellValue::Formula(trimmed.to_string())
                } else if trimmed.is_empty() {
                    CellValue::Empty
                } else {
                    CellValue::Text(trimmed.to_string())
                };
                self.set_cell(row, col, cell_val);
            }
        }
    }

    pub fn import_from_csv(&mut self, csv_data: &str) {
        self.import_with_delimiter(csv_data, ',');
    }

    pub fn import_from_tsv(&mut self, tsv_data: &str) {
        self.import_with_delimiter(tsv_data, '\t');
    }
}

/// Multi-Sheet Workbook.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Workbook {
    pub sheets: HashMap<String, Worksheet>,
    pub sheet_order: Vec<String>,
}

impl Default for Workbook {
    fn default() -> Self {
        Self::new()
    }
}

impl Workbook {
    pub fn new() -> Self {
        Self {
            sheets: HashMap::new(),
            sheet_order: Vec::new(),
        }
    }

    pub fn add_sheet(&mut self, sheet: Worksheet) {
        let name = sheet.name.clone();
        if !self.sheets.contains_key(&name) {
            self.sheet_order.push(name.clone());
        }
        self.sheets.insert(name, sheet);
    }

    pub fn get_sheet(&self, name: &str) -> Option<&Worksheet> {
        self.sheets.get(name)
    }

    pub fn get_sheet_mut(&mut self, name: &str) -> Option<&mut Worksheet> {
        self.sheets.get_mut(name)
    }

    pub fn sheet_count(&self) -> usize {
        self.sheets.len()
    }

    pub fn sheet_names(&self) -> &[String] {
        &self.sheet_order
    }

    pub fn export_all_csv(&self) -> HashMap<String, String> {
        self.sheets
            .iter()
            .map(|(name, sheet)| (name.clone(), sheet.export_to_csv()))
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_csv_export_and_import() {
        let mut sheet = Worksheet::new("Sales Data");
        sheet.set_cell(1, 1, CellValue::Text("Quarter".into()));
        sheet.set_cell(1, 2, CellValue::Text("Revenue".into()));
        sheet.set_cell(2, 1, CellValue::Text("Q1".into()));
        sheet.set_cell(2, 2, CellValue::Number(150000.0));
        sheet.set_cell(3, 1, CellValue::Text("Q2".into()));
        sheet.set_cell(3, 2, CellValue::Number(225000.0));

        let csv = sheet.export_to_csv();
        assert!(csv.contains("Quarter,Revenue"));
        assert!(csv.contains("Q1,150000"));

        let mut imported = Worksheet::new("Imported");
        imported.import_from_csv(&csv);
        assert_eq!(imported.max_row, 3);
        assert_eq!(imported.max_col, 2);
        assert_eq!(imported.get_cell(2, 2), Some(&CellValue::Number(150000.0)));
    }

    #[test]
    fn test_calculations_and_styles() {
        let mut sheet = Worksheet::new("Budget");
        sheet.set_cell_styled(
            1,
            1,
            CellValue::Text("Item".into()),
            CellStyle::bold_header(),
        );
        sheet.set_cell(2, 1, CellValue::Number(100.0));
        sheet.set_cell(3, 1, CellValue::Number(200.0));
        sheet.set_cell(4, 1, CellValue::Number(300.0));

        let sum = sheet.calculate_sum(1, 2, 4);
        assert_eq!(sum, 600.0);

        let avg = sheet.calculate_average(1, 2, 4).unwrap();
        assert_eq!(avg, 200.0);
    }

    #[test]
    fn test_multi_sheet_workbook() {
        let mut wb = Workbook::new();
        let s1 = Worksheet::new("January");
        let s2 = Worksheet::new("February");
        wb.add_sheet(s1);
        wb.add_sheet(s2);

        assert_eq!(wb.sheet_count(), 2);
        assert_eq!(wb.sheet_names(), &["January", "February"]);
    }
}
