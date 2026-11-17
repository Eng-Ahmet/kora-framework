# Example 23: Enterprise Reporting, PDF/Excel Generation & Transactional Email

<p align="center">
  <img src="https://img.shields.io/badge/Architecture-Clean_Architecture-2563EB?style=for-the-badge" alt="Clean Architecture" />
  <img src="https://img.shields.io/badge/Entities-entities%2F-10B981?style=for-the-badge" alt="Entities Folder" />
  <img src="https://img.shields.io/badge/Reporting-PDF_%7C_CSV_%7C_Email-7C3AED?style=for-the-badge" alt="Reporting Engine" />
</p>

This example demonstrates Kora's enterprise document generation, reporting, and transactional email capabilities built according to strict Clean Architecture standards:

1. **Entities Segregation (`entities/`)**:
   - `entities/invoice.entity.kora`: Persistent database schema decorated with `@table("invoices")`.
2. **DTO & Transport Models (`models/`)**:
   - `models/invoice.dto.kora`: `CreateInvoiceDto`, `InvoiceResponseDto`, `ReportSummaryDto`.
3. **Domain Service (`services/`)**:
   - `services/reporting.service.kora`: Handles native PDF building, CSV dataset generation, and TLS email transmission.
4. **HTTP Controller (`controllers/`)**:
   - `controllers/reporting.controller.kora`: Exposes clean endpoints with Dependency Injection.

## 🚀 Running the Example

```bash
# Check syntax, types, and architectural purity
kora check examples/23_enterprise_reporting_media_email/main.kora

# Execute the reporting pipeline
kora run examples/23_enterprise_reporting_media_email/main.kora
```
