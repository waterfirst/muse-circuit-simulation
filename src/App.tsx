import { useEffect, useState } from "react";
import LabPage from "./pages/LabPage";
import GbCandidatePage from "./pages/GbCandidatePage";
import PixelPage from "./pages/PixelPage";
import { t, useLang, type Lang } from "./lib/i18n";

const LIVE_URL = "https://waterfirst.pro/circuit-muse/";

function isStaticHost(): boolean {
  try {
    const h = window.location.hostname;
    return h.endsWith("github.io") || h === "localhost" && window.location.port !== "5173" && false;
  } catch {
    return false;
  }
}

export default function App() {
  const { lang, setLang } = useLang();
  const [route, setRoute] = useState(() => window.location.hash);
  useEffect(() => {
    const h = () => setRoute(window.location.hash);
    window.addEventListener("hashchange", h);
    return () => window.removeEventListener("hashchange", h);
  }, []);
  const tab = route.startsWith("#/gb-candidate") ? "gb" : route.startsWith("#/pixel") ? "pixel" : "drv";
  const onGhPages = (() => {
    try { return window.location.hostname.endsWith("github.io"); } catch { return false; }
  })();
  void isStaticHost;
  const toggle = (l: Lang) => (e: React.MouseEvent) => { e.preventDefault(); setLang(l); };
  return (
    <div>
      <div className="card judge">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: 0 }}>{t(lang, "judge_title")}</h2>
          <span>
            <a href="#en" onClick={toggle("en")} className={lang === "en" ? "on" : ""}>EN</a>
            {" / "}
            <a href="#kr" onClick={toggle("kr")} className={lang === "kr" ? "on" : ""}>KR</a>
          </span>
        </div>
        <p className="note">{t(lang, "judge_body")}</p>
        <p className="note">
          <span className={onGhPages ? "static" : "live"}>
            {onGhPages ? t(lang, "static_badge") : t(lang, "live_badge")}
          </span>
          {onGhPages && (<> · <a href={LIVE_URL}>{t(lang, "live_link")}: {LIVE_URL}</a></>)}
        </p>
      </div>
      <nav className="tabs">
        <a href="#/gb-candidate" className={tab === "gb" ? "on" : ""}>GB 합성 수정 후보</a>
        <a href="#/drv" className={tab === "drv" ? "on" : ""}>{t(lang, "tab_drv")}</a>
        <a href="#/pixel" className={tab === "pixel" ? "on" : ""}>{t(lang, "tab_pixel")}</a>
      </nav>
      {tab === "gb" ? <GbCandidatePage /> : tab === "pixel" ? <PixelPage /> : <LabPage />}
    </div>
  );
}

