import html from "../dashboard/index.html";
import css from "../dashboard/style.css";
import script from "../dashboard/app.js";
import { dashboardResponse } from "./dashboard.js";

const assets = {
  "/": { body: html, type: "text/html; charset=utf-8" },
  "/style.css": { body: css, type: "text/css; charset=utf-8" },
  "/app.js": { body: script, type: "text/javascript; charset=utf-8" },
};
export default {
  fetch(request, env) {
    return dashboardResponse(request, env, assets);
  },
};
