type ItemResource = {
  label: string;
  iconPath: string | null;
  note?: string;
};

type ModuleResourceGroup = {
  images: Record<string, string | null>;
  audio: Record<string, string | null>;
};

export const resourceCatalog: {
  items: Record<string, ItemResource>;
  modules: Record<string, ModuleResourceGroup>;
} = {
  items: {
    grilled_shrimp_plate: {
      label: "动画烤虾",
      iconPath: null,
      note: "钓虾彩蛋道具，后续可以接入图标和宴会特写图。",
    },
  },
  modules: {
    map: {
      images: {
        backdrop: null,
        marketMarker: null,
        islandMarker: null,
        squareMarker: null,
      },
      audio: {
        ambience: null,
        footstep: null,
      },
    },
    shrimp: {
      images: {
        backdrop: null,
        catchBar: null,
        specialCatch: null,
      },
      audio: {
        cast: null,
        reel: null,
        reward: null,
      },
    },
    catan: {
      images: {
        boardBackdrop: null,
        robberToken: null,
        developmentDeck: null,
      },
      audio: {
        dice: null,
        build: null,
        victory: null,
      },
    },
    festival: {
      images: {
        lanternGlow: null,
        crowdBackdrop: null,
        finaleOverlay: null,
      },
      audio: {
        ambience: null,
        reveal: null,
        finale: null,
      },
    },
  },
};

export function getItemLabel(itemId: string | null) {
  if (!itemId) {
    return null;
  }

  return resourceCatalog.items[itemId]?.label ?? itemId;
}
