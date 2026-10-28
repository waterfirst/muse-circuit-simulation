import { useEffect, useState } from "react";
import LabPage from "./pages/LabPage";
import ReportPage from "./pages/ReportPage";

export default function App() {
  const [route, setRoute] = useState(() => window.location.hash);
  useEffect(() => {
    const h = () => setRoute(window.location.hash);
    window.addEventListener("hashchange", h);
    return () => window.removeEventListener("hashchange", h);
  }, []);
  return route.startsWith("#/gw7t") ? <ReportPage /> : <LabPage />;
}
