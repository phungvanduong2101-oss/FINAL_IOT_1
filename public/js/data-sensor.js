"use strict";

(() => {
  const search = document.getElementById("ds-search");
  const searchBy = document.getElementById("ds-search-by");
  const sort = document.getElementById("ds-sort");
  const items = document.getElementById("ds-items");
  const reset = document.getElementById("ds-reset");
  const tbody = document.getElementById("ds-table-body");
  const dsSummary = document.getElementById("ds-summary");
  const dsPagination = document.getElementById("ds-pagination");

  let keyword = "";
  let currentPage = 1;
  let requestId = 0;

  const sensorConfig = {
    Temperature: { suffix: " °C", color: "temp" },
    Humidity: { suffix: " %", color: "hum" },
    Light: { suffix: " Lux", color: "lux" },
    N2: { suffix: " %", color: "n2" },
    CO2: { suffix: " ppm", color: "co2" },
    CH4: { suffix: " ppm", color: "ch4" },
  };

  // Khớp backend: %e/%m/%Y %H:%i:%s
  // Ví dụ: 8/11/2026 15:38:02
  const dateFormatter = new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "numeric",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  function formatTime(value) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "";

    const parts = {};

    for (const part of dateFormatter.formatToParts(date)) {
      parts[part.type] = part.value;
    }

    return (
      `${Number(parts.day)}/${parts.month}/${parts.year} ` +
      `${parts.hour}:${parts.minute}:${parts.second}`
    );
  }

  function updatePlaceholder() {
    search.placeholder = searchBy.value === "Time"
      ? "Ví dụ: 8/11/2026 15:38"
      : "Search by " + searchBy.value;
  }

  async function loadSensors() {
    const thisRequestId = ++requestId;

    const params = new URLSearchParams({
      search: keyword,
      searchBy: searchBy.value,
      items: items.value,
      sort: sort.value,
      page: currentPage,
    });

    try {
      const response = await fetch(`/api/sensors-data?${params}`);
      const result = await response.json();

      // Bỏ kết quả cũ nếu đã có yêu cầu mới.
      if (thisRequestId !== requestId) return;

      if (!response.ok || result.code !== "success") {
        throw new Error(result.message || "Không tải được dữ liệu.");
      }

      tbody.replaceChildren();

      for (const row of result.data) {
        const type = row.measurement_type;
        const config = sensorConfig[type] ?? {
          suffix: "",
          color: "",
        };

        const tr = document.createElement("tr");

        const cells = [
          { text: row.sensor_id },
          { text: row.sensor?.type ?? "" },
          {
            text: type,
            className: config.color
              ? `sensor-data-type-${config.color}`
              : "",
          },
          {
            text: `${row.value}${config.suffix}`,
            className: config.color
              ? `sensor-data-val-${config.color}`
              : "",
          },
          {
            text: formatTime(row.created_at),
            className: "sensor-data-col-time",
          },
        ];

        for (const cell of cells) {
          const td = document.createElement("td");

          td.textContent = cell.text;

          if (cell.className) {
            td.className = cell.className;
          }

          tr.append(td);
        }

        tbody.append(tr);
      }

      const skip = Number(result.skip);
      const totalItems = Number(result.totalItems);
      const firstItem = result.data.length > 0 ? skip + 1 : 0;
      const lastItem = result.data.length > 0
        ? skip + result.data.length
        : 0;

      dsSummary.textContent =
        `Hiển thị ${firstItem} - ${lastItem} ` +
        `trên tổng số ${totalItems} bản ghi.`;

      currentPage = Number(result.currentPage);
      renderPagination(currentPage, Number(result.totalPages));

      if (result.data.length === 0) {
        showMessage("Không có dữ liệu.");
      }
    } catch (error) {
      if (thisRequestId !== requestId) return;

      showMessage(error.message);
      dsSummary.textContent = "";
      dsPagination.replaceChildren();
    }
  }

  function showMessage(message) {
    const tr = document.createElement("tr");
    tr.className = "sensor-data-empty-row";

    const td = document.createElement("td");
    td.colSpan = 5;
    td.textContent = message;

    tr.append(td);
    tbody.replaceChildren(tr);
  }

  function renderPagination(currentPage, totalPages) {
    dsPagination.replaceChildren();

    if (totalPages <= 1) return;

    function addButton(text, page, disabled = false) {
      const button = document.createElement("button");

      button.type = "button";
      button.textContent = text;
      button.className = "sensor-data-pg-btn";
      button.disabled = disabled;

      if (page === currentPage && text === String(page)) {
        button.classList.add("sensor-data-active");
      }

      button.addEventListener("click", () => {
        loadPage(page);
      });

      dsPagination.append(button);
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
    loadSensors();
  }

  search.addEventListener("input", () => {
    keyword = search.value.trim();
    currentPage = 1;
    loadSensors();
  });

  searchBy.addEventListener("change", () => {
    search.value = "";
    keyword = "";
    currentPage = 1;

    updatePlaceholder();
    loadSensors();
  });

  sort.addEventListener("change", () => {
    currentPage = 1;
    loadSensors();
  });

  items.addEventListener("change", () => {
    currentPage = 1;
    loadSensors();
  });

  reset.addEventListener("click", () => {
    search.value = "";
    keyword = "";
    searchBy.value = "ALL";
    sort.value = "DESC";
    items.value = "10";
    currentPage = 1;

    updatePlaceholder();
    loadSensors();
  });

  updatePlaceholder();
  loadSensors();
})();