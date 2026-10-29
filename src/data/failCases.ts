export interface FailCase {
  id: string;
  title: string;
  symptom: string;
  cause: string;
  fix: string;
  fixCode: string;
  expected: { item: string; value: string }[];
  diagnose?: { step: string; detail: string }[];
  note: string;
}

export const FAIL_CASES: FailCase[] = [
  {
    id: "flm-8h",
    title: "FLM 8H 폭 — OUT 펄스가 FLM 폭 그대로 따라감 (12T2C EM driver)",
    symptom:
      "FLM high 약 66.56 us (H=8.3333 us의 8배). OUT1 high 66.75 us, OUT2 67.16 us가 FLM 폭과 일치. OUT3~OUT6에 3·4·5·7개 중복 펄스. idle level -0.76 ~ -1.22 V.",
    cause:
      "시작 신호 FLM이 8H 동안 유지되어 Q/QB 상태가 8H 동안 유지됨. T9 pull-up은 정상이라 OUT이 FLM 폭 그대로 출력되고, 긴 구간이 carry chain을 연속 통과해 후단 중복 펄스가 생김. 이 netlist는 N_T1~N_T12 12개 TFT라 10T2C가 아니라 12T2C로 표기해야 함.",
    fix: "FLM만 1H로 수정. topology·모델·clock은 건드리지 말고 재실행.",
    fixCode: `* 1H = 8.3333 us
VFLM FLM 0 PWL(
+ 0.0000u   -9.5
+ 79.1667u  -9.5
+ 79.2709u   8.0
+ 87.5000u   8.0
+ 87.6042u  -9.5
+ 329.1667u -9.5
+ 329.2709u  8.0
+ 337.5000u  8.0
+ 337.6042u -9.5
+ 583.3333u -9.5
+ )`,
    expected: [
      { item: "OUT1~OUT6 시작 간격", value: "약 1H = 8.3333 us" },
      { item: "각 OUT high 폭", value: "약 1H" },
      { item: "OUT3~OUT6 중복 펄스", value: "제거" },
      { item: "High level", value: "약 VGH = 8 V" },
    ],
    diagnose: [
      {
        step: "T9/T10 전류 sensing (FLM 수정 후에도 idle이 -9.5 V까지 안 내려가면)",
        detail: `* N_T9  OUT QB VGH mT9  ->  VS_T9SENSE OUT OUT_T9 0 + N_T9 OUT_T9 QB VGH mT9
* N_T10 OUT N2 VGL mT10 ->  VS_T10SENSE OUT OUT_T10 0 + N_T10 OUT_T10 N2 VGL mT10
wrdata em_diag.dat time v(OUT1) v(x1.q) v(x1.qb) v(x1.n2) i(VS_T9SENSE) i(VS_T10SENSE)`,
      },
      { step: "low 구간 |I_T10| 작음", detail: "Q → T12 → N2 → T10 gate reset 경로 문제" },
      { step: "T9·T10 전류 동시 큼", detail: "output contention" },
      { step: "T10 전류 충분한데 OUT이 -9.5 V 미달", detail: "T10 model card, D/G/S 정의, 기생·외부 부하 확인" },
      { step: "FLM 1H 후 펄스 폭 1H", detail: "12건 FAIL 주원인은 FLM 8H 폭 설정 오류 확정" },
    ],
    note: "우선순위: FLM 1H 수정 → 2-frame 재실행 → T9/T10 전류 진단. BML·열화·C2 값을 먼저 바꾸면 원인이 섞임. C2=A-VGL이라 OUT 직접 bootstrap이 없으므로 구 GW의 C2=OUT-Q 진단을 그대로 적용하면 안 됨.",
  },
];
