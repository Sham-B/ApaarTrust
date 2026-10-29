/**
 * DataTable Component (Stripe / IBM Carbon Inspired)
 * Features: live search, sorting, filtering, density toggle, column toggle, pagination, CSV export
 */

import { iconHtml } from './icons.js';

export class DataTable {
  constructor(options = {}) {
    this.container = typeof options.container === 'string' ? document.getElementById(options.container) : options.container;
    this.columns = options.columns || [];
    this.data = options.data || [];
    this.filteredData = [...this.data];
    this.pageSize = options.pageSize || 10;
    this.currentPage = 1;
    this.sortKey = options.initialSortKey || null;
    this.sortDir = options.initialSortDir || 'asc';
    this.searchQuery = options.initialSearchQuery || '';
    this.density = options.density || 'comfortable';
    this.title = options.title || '';
    this.exportFilename = options.exportFilename || 'table_data.csv';
    this.hiddenColumns = new Set();
    this.onRowClick = options.onRowClick || null;

    if (this.searchQuery) {
      this.applyFilters();
    }

    if (this.container) {
      this.render();
    }
  }

  setData(newData) {
    this.data = newData || [];
    this.applyFilters();
    this.render();
  }

  applyFilters() {
    let res = [...this.data];

    // Search query
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase();
      res = res.filter((row) =>
        this.columns.some((col) => {
          const val = row[col.key];
          return val !== undefined && val !== null && String(val).toLowerCase().includes(q);
        })
      );
    }

    // Sort
    if (this.sortKey) {
      res.sort((a, b) => {
        let va = a[this.sortKey];
        let vb = b[this.sortKey];
        if (typeof va === 'string') va = va.toLowerCase();
        if (typeof vb === 'string') vb = vb.toLowerCase();

        if (va < vb) return this.sortDir === 'asc' ? -1 : 1;
        if (va > vb) return this.sortDir === 'asc' ? 1 : -1;
        return 0;
      });
    }

    this.filteredData = res;
    this.currentPage = 1;
  }

  exportCSV() {
    const visibleCols = this.columns.filter((c) => !this.hiddenColumns.has(c.key));
    const headers = visibleCols.map((c) => `"${c.label.replace(/"/g, '""')}"`).join(',');

    const rows = this.filteredData.map((row) => {
      return visibleCols
        .map((c) => {
          let val = row[c.key];
          if (val === null || val === undefined) val = '';
          return `"${String(val).replace(/"/g, '""')}"`;
        })
        .join(',');
    });

    const csvContent = [headers, ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = this.exportFilename;
    link.click();
  }

  render() {
    if (!this.container) return;

    const visibleCols = this.columns.filter((c) => !this.hiddenColumns.has(c.key));
    const totalPages = Math.ceil(this.filteredData.length / this.pageSize) || 1;
    const startIndex = (this.currentPage - 1) * this.pageSize;
    const pageRows = this.filteredData.slice(startIndex, startIndex + this.pageSize);

    this.container.innerHTML = `
      <div class="table-container">
        <div class="table-toolbar">
          <div class="table-search">
            ${iconHtml('search', 'icon-sm')}
            <input type="text" placeholder="Search table..." value="${this.searchQuery}" class="table-search-input" />
          </div>

          <div class="table-actions">
            <!-- Density Toggle -->
            <button class="btn btn-secondary btn-sm btn-density-toggle" title="Toggle table density">
              ${iconHtml('sliders-horizontal', 'icon-sm')}
              ${this.density === 'comfortable' ? 'Comfortable' : 'Compact'}
            </button>

            <!-- CSV Export -->
            <button class="btn btn-secondary btn-sm btn-export-csv" title="Export as CSV">
              ${iconHtml('download', 'icon-sm')} Export CSV
            </button>
          </div>
        </div>

        <div class="table-wrapper">
          <table class="data-table ${this.density === 'compact' ? 'density-compact' : ''}">
            <thead>
              <tr>
                ${visibleCols
                  .map(
                    (col) => `
                  <th class="${col.sortable !== false ? 'sortable' : ''}" data-key="${col.key}">
                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 4px;">
                      <span>${col.label}</span>
                      ${col.sortable !== false ? iconHtml('arrow-up-down', 'icon-sm') : ''}
                    </div>
                  </th>
                `
                  )
                  .join('')}
              </tr>
            </thead>
            <tbody>
              ${
                pageRows.length > 0
                  ? pageRows
                      .map(
                        (row, rowIdx) => `
                  <tr data-row-index="${startIndex + rowIdx}" style="${this.onRowClick ? 'cursor: pointer;' : ''}">
                    ${visibleCols
                      .map((col) => {
                        const raw = row[col.key];
                        const content = col.render ? col.render(raw, row) : raw !== undefined && raw !== null ? raw : '—';
                        return `<td>${content}</td>`;
                      })
                      .join('')}
                  </tr>
                `
                      )
                      .join('')
                  : `
                  <tr>
                    <td colspan="${visibleCols.length}" style="text-align: center; padding: var(--space-8); color: var(--text-muted);">
                      No matching records found.
                    </td>
                  </tr>
                `
              }
            </tbody>
          </table>
        </div>

        <div class="table-pagination">
          <div>
            Showing <span class="tabular font-semibold">${pageRows.length ? startIndex + 1 : 0}</span> to
            <span class="tabular font-semibold">${Math.min(startIndex + this.pageSize, this.filteredData.length)}</span> of
            <span class="tabular font-semibold">${this.filteredData.length}</span> records
          </div>
          <div style="display: flex; gap: var(--space-2);">
            <button class="btn btn-secondary btn-sm btn-prev-page" ${this.currentPage <= 1 ? 'disabled' : ''}>
              ${iconHtml('chevron-right', 'icon-sm' + ' style="transform: rotate(180deg);"') } Previous
            </button>
            <span style="display: flex; align-items: center; padding: 0 var(--space-2);" class="tabular">
              Page ${this.currentPage} of ${totalPages}
            </span>
            <button class="btn btn-secondary btn-sm btn-next-page" ${this.currentPage >= totalPages ? 'disabled' : ''}>
              Next ${iconHtml('chevron-right', 'icon-sm')}
            </button>
          </div>
        </div>
      </div>
    `;

    // Bind event listeners
    const searchInput = this.container.querySelector('.table-search-input');
    searchInput.addEventListener('input', (e) => {
      this.searchQuery = e.target.value;
      this.applyFilters();
      this.render();
      // Keep focus
      const updatedInput = this.container.querySelector('.table-search-input');
      if (updatedInput) {
        updatedInput.focus();
        updatedInput.setSelectionRange(this.searchQuery.length, this.searchQuery.length);
      }
    });

    const densityBtn = this.container.querySelector('.btn-density-toggle');
    densityBtn.addEventListener('click', () => {
      this.density = this.density === 'comfortable' ? 'compact' : 'comfortable';
      this.render();
    });

    const exportBtn = this.container.querySelector('.btn-export-csv');
    exportBtn.addEventListener('click', () => this.exportCSV());

    // Sort headers
    this.container.querySelectorAll('th.sortable').forEach((th) => {
      th.addEventListener('click', () => {
        const key = th.dataset.key;
        if (this.sortKey === key) {
          this.sortDir = this.sortDir === 'asc' ? 'desc' : 'asc';
        } else {
          this.sortKey = key;
          this.sortDir = 'asc';
        }
        this.applyFilters();
        this.render();
      });
    });

    // Pagination
    const prevBtn = this.container.querySelector('.btn-prev-page');
    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        if (this.currentPage > 1) {
          this.currentPage--;
          this.render();
        }
      });
    }

    const nextBtn = this.container.querySelector('.btn-next-page');
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        if (this.currentPage < totalPages) {
          this.currentPage++;
          this.render();
        }
      });
    }

    // Row clicks
    if (this.onRowClick) {
      this.container.querySelectorAll('tbody tr').forEach((tr) => {
        tr.addEventListener('click', () => {
          const idx = parseInt(tr.dataset.rowIndex, 10);
          if (!isNaN(idx) && this.filteredData[idx]) {
            this.onRowClick(this.filteredData[idx]);
          }
        });
      });
    }
  }
}
