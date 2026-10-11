// Типы для vendored xbrz.js (порт xBRZ 1.9, GPL-3 — см. шапку xbrz.js)
export interface XbrzConfig {
  equalColorTolerance: number;
  centerDirectionBias: number;
  dominantDirectionThreshold: number;
  steepDirectionThreshold: number;
  oobRead: string;
  testAttribute?: number;
}
export declare const ColorFormat: { rgb: string; argb: string; argbUnbuffered: string };
export declare const SCALE_FACTOR_MAX: number;
export declare const ScalerCfgDefault: XbrzConfig;
export declare function xbrzScale(scale: number, src: Uint32Array, dst: Uint32Array, width: number, height: number, colorFormat: string, config?: XbrzConfig | null, yFirst?: number, yLast?: number): void;
