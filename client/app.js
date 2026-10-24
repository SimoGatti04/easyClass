/**
 * Teacher Service — Root Application & Router (C3 UI/UX Foundation)
 * Complete React + ESM Client Router.
 * Supports public Homepage, zero-credential Student Area, and multi-tab Teacher Dashboard.
 */
import React, { createElement as h, useState, useEffect } from "react";
import { createRoot } from "react-dom/client";

import { Homepage } from "./src/components/Homepage.js";
import { StudentArea } from "./src/components/StudentArea.js";
import { TeacherArea } from "./src/components/TeacherArea.js";

export function App() {
  const getRouteFromPath = () => {
    const pathname = window.location.pathname.replace(/\/+$/, "") || "/";
    if (pathname === "/studente" || pathname.startsWith("/studente/")) return "student";
    if (pathname === "/docente" || pathname.startsWith("/docente/")) return "teacher";
    return "home";
  };

  const [route, setRoute] = useState(getRouteFromPath);

  useEffect(() => {
    // Old QR codes used hash routes. Normalize them with a full navigation so
    // a /docente link is re-evaluated by Cloudflare Access at the HTTP layer.
    // Never render the teacher dashboard from a public-root hash URL.
    if (window.location.pathname === "/") {
      const legacyRoute = window.location.hash || "";
      if (legacyRoute.startsWith("#/docente")) {
        window.location.replace(`/docente${window.location.search}`);
        return;
      }
      if (legacyRoute.startsWith("#/studente")) {
        const suffix = legacyRoute.slice("#/studente".length);
        const studentQuery = suffix.startsWith("?") ? suffix : "";
        const fragment = suffix.startsWith("#") ? suffix : "";
        window.location.replace(`/studente${window.location.search}${studentQuery}${fragment}`);
        return;
      }
    }

    const handleNavigation = () => setRoute(getRouteFromPath());
    window.addEventListener("popstate", handleNavigation);
    return () => window.removeEventListener("popstate", handleNavigation);
  }, []);

  const navigate = (target) => {
    let destination = target;
    if (target.startsWith("#/studente")) {
      const suffix = target.slice("#/studente".length);
      destination = `/studente${suffix.startsWith("?") ? suffix : ""}`;
    } else if (target.startsWith("#/docente")) {
      destination = "/docente";
    } else if (target === "student") {
      destination = "/studente";
    } else if (target === "teacher") {
      destination = "/docente";
    } else if (target === "home" || target === "#/" || target === "") {
      destination = "/";
    }

    // A document navigation is intentional: teacher navigation must pass the
    // edge Access policy instead of changing only a browser-side fragment.
    window.location.assign(destination);
  };

  return h("div", { className: "teacher-service-root" }, [
    route === "home" && h(Homepage, { key: "home", onNavigate: navigate }),
    route === "student" && h(StudentArea, { key: "student", onNavigate: navigate }),
    route === "teacher" && h(TeacherArea, { key: "teacher", onNavigate: navigate })
  ]);
}

// Mount React Root
if (typeof document !== "undefined") {
  const rootElement = document.getElementById("app");
  if (rootElement) {
    const root = createRoot(rootElement);
    root.render(h(App));
  }
}
