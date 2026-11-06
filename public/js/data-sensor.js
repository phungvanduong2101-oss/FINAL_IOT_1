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
  async function loadSensors() {
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

      if (!response.ok || result.code !== "success") {
        throw new Error(result.message || "Không tải được dữ liệu.");
      }

      tbody.replaceChildren(); // Clear table

      for (const row of result.data) {
        const type = row.measurement_type;

        const sensorConfig = {
          Temperature: { suffix: " °C", color: "temp" },
          Humidity: { suffix: " %", color: "hum" },
          Light: { suffix: " Lux", color: "lux" },
          N2: { suffix: " %", color: "n2", model: "N2" },
          CO2: { suffix: " ppm", color: "co2", model: "MH-Z19B" },
          CH4: { suffix: " ppm", color: "ch4", model: "MQ-4" },
        };

        const config = sensorConfig[type] ?? {
          suffix: "",
          color: "",
        };

        const tr = document.createElement("tr");

        const cells = [
          { text: row.sensor_id },
          { text: config.model ?? row.sensor?.type ?? "" },
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
            text: new Date(row.created_at).toLocaleString("vi-VN", {
              timeZone: "Asia/Ho_Chi_Minh",
            }),
            className: "sensor-data-col-time",
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

      dsSummary.textContent = `Hiển thị ${result.skip + 1} - ${result.skip + result.data.length} trên tổng số ${result.totalItems} bản ghi.`;

      currentPage = Number(result.currentPage);
      renderPagination(currentPage, Number(result.totalPages));
      if (result.data.length === 0) {
        showMessage("Không có dữ liệu.");
      }
    } catch (error) {
      showMessage(error.message);
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

    // Chỉ hiện trang đầu, cuối và các trang gần trang hiện tại.
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
    search.placeholder = "Search by " + searchBy.value;
    currentPage = 1;
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
    items.value = 10;
    currentPage = 1;   
    search.placeholder = "Search by ALL";
    loadSensors();
  });

  loadSensors();
})();