import type { CatanActionTarget } from "../types";

export const roadLabels: Record<number, string> = {
  0: "左上斜路",
  1: "右上斜路",
  2: "左侧竖路",
  3: "右侧竖路",
  4: "中路左段",
  5: "中路右段",
  6: "下方联通路",
  7: "中部竖路",
};

export const nodeLabels: Record<number, string> = {
  0: "左侧起始据点",
  1: "上方 Leah 据点",
  2: "右侧 Sam 据点",
  3: "左下扩张点",
  4: "中下扩张点",
  5: "右下争夺点",
};

export function describeActionTarget(target: CatanActionTarget) {
  if (target.kind === "road") {
    return roadLabels[target.id] ?? `道路 ${target.id}`;
  }

  return nodeLabels[target.id] ?? `据点 ${target.id}`;
}
