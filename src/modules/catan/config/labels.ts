import type { DevelopmentCardState, ResourceState } from "../types";

export const resourceLabels: Record<keyof ResourceState, string> = {
  wood: "木材",
  brick: "砖块",
  grain: "小麦",
  ore: "矿石",
  wool: "羊毛",
};

export const developmentCardLabels: Record<keyof DevelopmentCardState, string> = {
  knight: "骑士",
  harvest: "丰收",
  roadBuilding: "道路建设",
};
