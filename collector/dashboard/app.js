const element = (id) => document.getElementById(id);
const format = (value) => new Intl.NumberFormat().format(value);
let data = null;
let requestNumber = 0;
let visible = [];

function summary(rows, field) {
  const groups = new Map();
  for (const row of rows) {
    const key = field === "name" ? `${row.kind}:${row.name}` : row[field];
    const group = groups.get(key) ?? { name: row[field], kind: row.kind, count: 0, errors: 0 };
    group.count += row.count;
    if (row.outcome === "error") group.errors += row.count;
    groups.set(key, group);
  }
  return [...groups.values()].sort(
    (left, right) => right.count - left.count || left.name.localeCompare(right.name)
  );
}

function bars(id, groups) {
  const container = element(id);
  container.replaceChildren();
  const max = Math.max(1, ...groups.map((group) => group.count));
  for (const group of groups) {
    const row = document.createElement("div");
    row.className = "bar-row";
    const name = document.createElement("span");
    name.textContent = group.name;
    const meter = document.createElement("meter");
    meter.min = 0;
    meter.max = max;
    meter.value = group.count;
    meter.setAttribute("aria-label", `${group.name}: ${group.count} events`);
    const count = document.createElement("strong");
    count.textContent = format(group.count);
    row.append(name, meter, count);
    container.append(row);
  }
  if (!groups.length) container.textContent = "No recorded events";
}

function chart() {
  const canvas = element("chart");
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const scale = window.devicePixelRatio || 1;
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const context = canvas.getContext("2d");
  context.scale(scale, scale);
  if (!data) return;
  const days = [];
  const start = new Date(`${data.start}T00:00:00Z`);
  for (let index = 0; index < data.days; index++) {
    const date = new Date(start);
    date.setUTCDate(date.getUTCDate() + index);
    const day = date.toISOString().slice(0, 10);
    const rows = visible.filter((row) => row.day === day);
    days.push({
      day,
      total: rows.reduce((sum, row) => sum + row.count, 0),
      errors: rows
        .filter((row) => row.outcome === "error")
        .reduce((sum, row) => sum + row.count, 0),
    });
  }
  const max = Math.max(1, ...days.map((day) => day.total));
  const step = width / days.length;
  const barWidth = Math.max(1, Math.min(35, step - 3));
  for (const [index, day] of days.entries()) {
    const totalHeight = (day.total / max) * (height - 20);
    const errorHeight = (day.errors / max) * (height - 20);
    const left = index * step + (step - barWidth) / 2;
    context.fillStyle = "#087b59";
    context.fillRect(left, height - totalHeight, barWidth, totalHeight);
    context.fillStyle = "#b64444";
    context.fillRect(left, height - errorHeight, barWidth, errorHeight);
  }
  canvas.setAttribute(
    "aria-label",
    `Daily activity, ${data.start} to ${data.end}. ${format(visible.reduce((sum, row) => sum + row.count, 0))} events.`
  );
}

function render() {
  if (!data) return;
  visible = data.rows.filter(
    (row) => !element("version").value || row.package_version === element("version").value
  );
  const total = visible.reduce((sum, row) => sum + row.count, 0);
  const errors = visible
    .filter((row) => row.outcome === "error")
    .reduce((sum, row) => sum + row.count, 0);
  element("total").textContent = format(total);
  element("success").textContent = format(total - errors);
  element("errors").textContent = format(errors);
  element("rate").textContent = total
    ? `${(((total - errors) / total) * 100).toFixed(1)}% success rate`
    : "No recorded outcomes";
  element("period").textContent = `${data.days} days / UTC`;
  element("start").textContent = data.start;
  element("end").textContent = data.end;
  bars("mix", summary(visible, "kind"));
  bars("versions", summary(visible, "package_version"));
  bars(
    "error-categories",
    summary(
      visible.filter((row) => row.outcome === "error"),
      "error_category"
    )
  );
  const names = summary(visible, "name").filter((row) =>
    row.name.toLowerCase().includes(element("search").value.toLowerCase())
  );
  element("rows").replaceChildren();
  for (const row of names) {
    const tr = document.createElement("tr");
    for (const [index, value] of [
      row.name,
      row.kind,
      format(row.count),
      format(row.errors),
      `${(((row.count - row.errors) / row.count) * 100).toFixed(1)}%`,
    ].entries()) {
      const td = document.createElement("td");
      td.textContent = value;
      if (index === 3 && row.errors) td.className = "error-count";
      tr.append(td);
    }
    element("rows").append(tr);
  }
  element("empty").hidden = names.length > 0;
  chart();
}

async function load() {
  const current = ++requestNumber;
  element("refresh").disabled = true;
  element("status").className = "";
  element("status").textContent = "Loading activity...";
  try {
    const params = new URLSearchParams({
      days: element("days").value,
      kind: element("kind").value,
    });
    const response = await fetch(`/api/metrics?${params}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok)
      throw new Error(
        response.status === 403
          ? "Session expired. Sign in again."
          : "Metrics unavailable. Try refreshing."
      );
    const next = await response.json();
    if (current !== requestNumber) return;
    data = next;
    const selected = element("version").value;
    element("version").replaceChildren(new Option("All versions", ""));
    for (const version of [...new Set(data.rows.map((row) => row.package_version))].sort())
      element("version").add(new Option(version, version));
    if ([...element("version").options].some((option) => option.value === selected))
      element("version").value = selected;
    element("status").textContent = data.truncated
      ? "Partial results: 5,000-row limit reached. Select a shorter period."
      : data.rows.length
        ? "Recorded activity for the selected period."
        : "No recorded events in this period.";
    element("updated").textContent = `Updated ${new Date(data.generatedAt).toLocaleTimeString()}`;
    render();
  } catch (error) {
    if (current !== requestNumber) return;
    data = null;
    visible = [];
    for (const id of ["total", "success", "errors", "rate"]) element(id).textContent = "—";
    element("rows").replaceChildren();
    bars("mix", []);
    bars("versions", []);
    bars("error-categories", []);
    chart();
    element("status").className = "error";
    element("status").textContent = error.message || "Metrics unavailable.";
  } finally {
    if (current === requestNumber) element("refresh").disabled = false;
  }
}
element("filters").addEventListener("submit", (event) => {
  event.preventDefault();
  void load();
});
for (const id of ["days", "kind"])
  element(id).addEventListener("change", () => {
    void load();
  });
element("version").addEventListener("change", render);
element("search").addEventListener("input", render);
new ResizeObserver(chart).observe(element("chart").parentElement);
void load();
