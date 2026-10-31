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
  const tab = route.startsWith("#/pixel") ? "pixel" : route.startsWith("#/drv") ? "drv" : "gw7t";
  return (
    <div>
      <nav className="tabs">
        <a href="#/" className={tab === "gw7t" ? "on" : ""}>GW 7T 리포트</a>
        <a href="#/drv" className={tab === "drv" ? "on" : ""}>드라이버 (GW/EM/GC/GI)</a>
        <a href="#/pixel" className={tab === "pixel" ? "on" : ""}>픽셀 (8T1C)</a>
      </nav>
      {tab === "pixel" ? <PixelPage /> : tab === "drv" ? <LabPage /> : <ReportPage />}
    </div>
  );
}
