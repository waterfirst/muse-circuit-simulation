import { createContext, useContext, useState, type ReactNode } from "react";

export type Lang = "en" | "kr";

const Ctx = createContext<{ lang: Lang; setLang: (l: Lang) => void }>({ lang: "en", setLang: () => {} });

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>("en");
  return <Ctx.Provider value={{ lang, setLang }}>{children}</Ctx.Provider>;
}

export function useLang() {
  return useContext(Ctx);
}

// Technical symbols (VGH/VGL/FLM/CLK/OUT/TFT/ngspice/H) are never translated.
const STR: Record<string, { en: string; kr: string }> = {
  tab_report: { en: "GW 7T report", kr: "GW 7T 리포트" },
  tab_drv: { en: "Driver (GW/EM/GC/GI)", kr: "드라이버 (GW/EM/GC/GI)" },
  tab_pixel: { en: "Pixel (8T1C)", kr: "픽셀 (8T1C)" },
  judge_title: { en: "Judge brief", kr: "심사위원 요약" },
  judge_body: {
    en: "Circuit Muse is an evidence-first TFT circuit simulation workspace. " +
      "Problem: gate-driver and pixel designers need fast, checkable answers about pass/fail, waveforms, and VGH x VGL margin before tapeout. " +
      "Muse Code role: accelerated engineering of the UI, validation, and automation - every number shown comes from a deterministic ngspice run, not from the model. " +
      "Verified scope: GW/EM/GC/GI drivers plus 8T1C pixel, ngspice with synthetic TFT compact models; results are simulation evidence, not measured silicon data.",
    kr: "Circuit Muse는 근거 우선 TFT 회로 시뮬레이션 작업공간입니다. " +
      "문제: 게이트 드라이버·픽셀 설계자는 테이프아웃 전에 pass/fail, 파형, VGH x VGL 마진에 대한 빠르고 검증 가능한 답이 필요합니다. " +
      "Muse Code 역할: UI·검증·자동화의 엔지니어링 가속 - 화면의 모든 수치는 모델이 아닌 결정적 ngspice 실행에서 나옵니다. " +
      "검증 범위: GW/EM/GC/GI 드라이버와 8T1C 픽셀, synthetic TFT 컴팩트 모델 기반 ngspice. 결과는 시뮬레이션 근거이며 실측 실리콘 데이터가 아닙니다.",
  },
  live_badge: { en: "live simulator", kr: "실시간 시뮬레이터" },
  static_badge: { en: "static demo (no live sim)", kr: "정적 데모 (실시간 시뮬 불가)" },
  live_link: { en: "Open the live simulator", kr: "실시간 시뮬레이터 열기" },
  run: { en: "Run simulation", kr: "시뮬레이션 실행" },
  running: { en: "Running... (ngspice)", kr: "실행 중... (ngspice)" },
  errors: { en: "Errors:", kr: "오류:" },
  ready: { en: "Showing the stored verification waveform (before run)", kr: "저장된 검증 파형을 보여줍니다 (실행 전)" },
  demo_note: { en: "Demo waveform (static page: live sim unavailable)", kr: "데모 파형입니다 (정적 페이지에서는 실시간 시뮬이 안 됩니다)" },
  stopped: { en: "Stopped (see errors above)", kr: "중단됨 (위 오류 확인)" },
};

export function t(lang: Lang, key: string): string {
  const e = STR[key];
  if (!e) return key;
  return e[lang];
}
