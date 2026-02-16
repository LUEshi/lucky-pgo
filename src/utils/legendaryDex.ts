const MYTHICAL_DEX = new Set<number>([
  151, 251, 385, 386, 489, 490, 491, 492, 493, 494,
  647, 648, 649, 719, 720, 721, 801, 802, 807, 808,
  809, 893, 1025,
]);

const LEGENDARY_OR_MYTHICAL_DEX = new Set<number>([
  144, 145, 146, 150, 151,
  243, 244, 245, 249, 250, 251,
  377, 378, 379, 380, 381, 382, 383, 384, 385, 386,
  480, 481, 482, 483, 484, 485, 486, 487, 488, 489, 490, 491, 492, 493,
  494, 638, 639, 640, 641, 642, 643, 644, 645, 646, 647, 648, 649,
  716, 717, 718, 719, 720, 721,
  772, 773, 785, 786, 787, 788, 789, 790, 791, 792,
  793, 794, 795, 796, 797, 798, 799, 800, 801, 802, 803, 804, 805, 806,
  807, 808, 809, 888, 889, 890, 891, 892, 893, 894, 895, 896, 897, 898,
  905, 1001, 1002, 1003, 1004, 1007, 1008, 1017, 1024, 1025,
]);

export function isMythicalDex(dexNumber: number): boolean {
  return MYTHICAL_DEX.has(dexNumber);
}

export function isLegendaryDex(dexNumber: number): boolean {
  return LEGENDARY_OR_MYTHICAL_DEX.has(dexNumber) && !MYTHICAL_DEX.has(dexNumber);
}
