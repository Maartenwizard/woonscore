export type PlanId = "free" | "zakelijk";

export interface PlanLimits {
  id: PlanId;
  name: string;
  hourly: number;
  monthly: number;
  maxKeys: number;
  bulkMax: number;
  priceMonthlyEur: number | null;
}

export const PLANS: Record<PlanId, PlanLimits> = {
  free: {
    id: "free",
    name: "Gratis",
    hourly: 60,
    monthly: 50,
    maxKeys: 1,
    bulkMax: 5,
    priceMonthlyEur: null,
  },
  zakelijk: {
    id: "zakelijk",
    name: "Zakelijk",
    hourly: 300,
    monthly: 500,
    maxKeys: 5,
    bulkMax: 20,
    priceMonthlyEur: 29,
  },
};

export const CREDIT_PACK_SIZE = 50;
export const CREDIT_PACK_EUR = 19;
