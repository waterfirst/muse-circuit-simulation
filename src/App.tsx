import { useEffect, useState } from "react";
import LabPage from "./pages/LabPage";
import PixelPage from "./pages/PixelPage";
import ReportPage from "./pages/ReportPage";

export default function App() {
  const [route, setRoute] = useState(() => window.location.hash);
  useEffect(() => {
    const h = () => setRoute(window.location.hash);
    window.addEventListener("hashchange", h);
    return () => window.removeEventListener("hashchange", h);
  }, []);
  const tab = route.startsWith("#/pixel") ? "pixel" : route.startsWith("#/gw7t") ? "gw7t" : "drv";
  return (
    <div>
      <nav className="tabs">
        <a href="#/" className={tab === "drv" ? "on" : ""}>드라이버 (GW/EM/GC/GI)</a>
        <a href="#/pixel" className={tab === "pixel" ? "on" : ""}>픽셀 (8T1C)</a>
        <a href="#/gw7t" className={tab === "gw7t" ? "on" : ""}>GW 7T 리포트</a>
      </nav>
      {tab === "pixel" ? <PixelPage /> : tab === "gw7t" ? <ReportPage /> : <LabPage />}
    </div>
  );
}
