/**
 * Type facade for the HVAC calculation kernels.
 *
 * The kernel implementation is CommonJS (pure-function engines decoupled from
 * HTTP/tenant scope). This declaration lets the Nx/NestJS future-state surface
 * consume it via `@rhautt-nexus/domain/hvac-kernels` without rewriting the
 * runtime engines. Shapes mirror each area's index.js facade exports.
 */

export interface HotWaterKernel {
  calculateResidentialHotWater(params: Record<string, unknown>): unknown;
  calculateCommercialHotWater(params: Record<string, unknown>): unknown;
  HotWaterEngine: new () => unknown;
}

export interface HeatingKernel {
  HeatingSystemEngine: new () => unknown;
}

export interface AirConditioningKernel {
  AirConditioningEngine: new () => unknown;
}

export interface FreshAirKernel {
  FreshAirProEngine: new () => unknown;
  DOASComplianceEngine: new () => unknown;
}

export interface LoadCalculationKernel {
  calculateLoad(params: Record<string, unknown>): unknown;
  LoadCalculationEngineV3: new () => unknown;
}

export interface HydraulicKernel {
  HydraulicEngine: new () => unknown;
}

export interface QuotationKernel {
  generateQuotation(params: Record<string, unknown>): unknown;
  QuotationEngineV2: new () => unknown;
}

export interface NoiseEvaluation {
  metric: 'indoor_noise_dba';
  roomType: string;
  period: 'day' | 'night';
  predictedLp: number | null;
  limit: number;
  pass: boolean | null;
  marginDb: number | null;
  perSource: Array<Record<string, unknown>>;
  assumptions: Record<string, unknown>;
}

export interface NoiseKernel {
  GB50118_INDOOR_LIMITS: Record<string, { day: number; night: number }>;
  evaluateRoomNoise(params: Record<string, unknown>): NoiseEvaluation;
  evaluateRooms(rooms: Array<Record<string, unknown>>): {
    pass: boolean | null;
    failedCount: number;
    worst: NoiseEvaluation | null;
    rooms: NoiseEvaluation[];
  };
}

export interface WaterSystemKernel {
  WaterSystemEngine: new () => {
    generateDesign(params: Record<string, unknown>): unknown;
    healthCheck(): unknown;
  };
}

export interface HvacKernels {
  hotWater: HotWaterKernel;
  heating: HeatingKernel;
  airConditioning: AirConditioningKernel;
  freshAir: FreshAirKernel;
  loadCalculation: LoadCalculationKernel;
  hydraulic: HydraulicKernel;
  quotation: QuotationKernel;
  noise: NoiseKernel;
  water: WaterSystemKernel;
}

declare const hvacKernels: HvacKernels;
export = hvacKernels;
