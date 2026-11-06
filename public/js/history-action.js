"use strict";

(() => {
  const search = document.getElementById("ha-search");
  const device = document.getElementById("ha-device");
  const status = document.getElementById("ha-status");
  const sort = document.getElementById("ha-sort");
  const items = document.getElementById("ha-items");
  const reset = document.getElementById("ha-reset");
  const tbody = document.getElementById("ha-table-body");
  const summary = document.getElementById("ha-summary");
  const pagination = document.getElementById("ha-pagination");

  let keyword = "";
  let currentPage = 1;
  let requestController;

  async function loadActions() {
    // Hủy request cũ để kết quả tìm kiếm cũ không ghi đè kết quả mới.
    requestController?.abort();
    const controller = new AbortController();
    requestController = controller;

    const params = new URLSearchParams({
      search: keyword,
      device: device.value,
      status: status.value,
      items: items.value,
      sort: sort.value,
      page: currentPage,
    });

    try {
      const response = await fetch(`/api/actions-history?${params}`, {
        signal: controller.signal,
      });

      const result = await response.json();

      if (!response.ok || result.code !== "success") {
        throw new Error(result.message || "Không tải được lịch sử thao tác.");
      }

      if (controller.signal.aborted) return;

      tbody.replaceChildren();

      for (const row of result.data) {
        const actionClass = row.action === "ON"
          ? "history-action-action-on"
          : "history-action-action-off";

        const statusClass = {
          SUCCESS: "history-action-status-success",
          FAILED: "history-action-status-failed",
          WAITING: "history-action-status-waiting", 
          TIMEOUT: "history-action-status-timeout",
        }[row.status] || "";

        const tr = document.createElement("tr");

        const cells = [
          {
            text: row.device_id,
            className: "history-action-col-id",
          },
          {
            text: row.device?.name ?? "—",
            className: "history-action-col-name",
          },
          {
            text: row.action,
            className: `history-action-col-action ${actionClass}`,
          },
          {
            text: row.status === "WAITING" ? "WAITING" : row.status,
            className: `history-action-col-status ${statusClass}`,
          },
          {
            text: new Date(row.created_at).toLocaleString("vi-VN"),
            className: "history-action-col-time",
          },
        ];

        for (const cell of cells) {
          const td = document.createElement("td");

          td.textContent = cell.text;
          if (cell.className) td.className = cell.className;

          tr.append(td);
        }

        tbody.append(tr);
      }

      const start = result.data.length ? Number(result.skip) + 1 : 0;
      const end = Number(result.skip) + result.data.length;

      summary.textContent =
        `Hiển thị ${start} - ${end} trên tổng số ${result.total} bản ghi.`;

      currentPage = Number(result.currentPage);
      renderPagination(currentPage, Number(result.totalPages));

      if (result.data.length === 0) {
        showMessage("Không có dữ liệu.");
      }
    } catch (error) {
      if (error.name === "AbortError") return;

      showMessage(error.message);
      pagination.replaceChildren();
      summary.textContent = "";
    }
  }

  function showMessage(message) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");

    td.colSpan = 5;
    td.textContent = message;

    tr.append(td);
    tbody.replaceChildren(tr);
  }

  function renderPagination(currentPage, totalPages) {
    pagination.replaceChildren();

    if (totalPages <= 1) return;

    function addButton(text, page, disabled = false) {
      const button = document.createElement("button");

      button.type = "button";
      button.textContent = text;
      button.className = "history-action-pg-btn";
      button.disabled = disabled;

      if (page === currentPage && text === String(page)) {
        button.classList.add("history-action-active");
      }

      button.addEventListener("click", () => {
        loadPage(page);
      });

      pagination.append(button);
    }

    addButton("<", currentPage - 1, currentPage <= 1);

    const pages = [...new Set([
      1,
      currentPage - 1,
      currentPage,
      currentPage + 1,
      totalPages,
    ])]
      .filter(page => page >= 1 && page <= totalPages)
      .sort((a, b) => a - b);

    let previousPage = 0;

    for (const page of pages) {
      if (previousPage && page - previousPage > 1) {
        addButton("...", 0, true);
      }

      addButton(String(page), page);
      previousPage = page;
    }

    addButton(">", currentPage + 1, currentPage >= totalPages);
  }

  function loadPage(page) {
    currentPage = page;
    loadActions();
  }

  search.addEventListener("input", () => {
    keyword = search.value.trim();
    currentPage = 1;
    loadActions();
  });

  device.addEventListener("change", () => {
    currentPage = 1;
    loadActions();
  });

  status.addEventListener("change", () => {
    currentPage = 1;
    loadActions();
  });

  sort.addEventListener("change", () => {
    currentPage = 1;
    loadActions();
  });

  items.addEventListener("change", () => {
    currentPage = 1;
    loadActions();
  });

  reset.addEventListener("click", () => {
    search.value = "";
    keyword = "";
    device.value = "ALL";
    status.value = "ALL";
    sort.value = "DESC";
    items.value = "10";
    currentPage = 1;
    loadActions();
  });

  loadActions();
})();