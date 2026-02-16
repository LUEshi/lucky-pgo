export interface Pokemon {
  dexNumber: number;
  name: string;
  isLucky: boolean;
}

export interface LuckyList {
  pokemon: Pokemon[];
  lastUpdated: string;
}

// ScrapedDuck types

export interface EventSpawn {
  name: string;
  canBeShiny: boolean;
}

export interface EventEgg {
  name: string;
  eggDistance: string;
  canBeShiny: boolean;
}

export interface EventResearchTask {
  task: string;
  rewards: Array<{ name: string; canBeShiny: boolean }>;
}

export interface ScrapedDuckEvent {
  eventID: string;
  name: string;
  eventType: string;
  heading: string;
  link: string;
  image: string;
  start: string;
  end: string;
  extraData?: {
    generic?: {
      hasSpawns?: boolean;
      hasFieldResearchTasks?: boolean;
      spawns?: EventSpawn[];
      eventEggs?: EventEgg[];
      eventResearch?: EventResearchTask[];
    };
    raidbattles?: {
      bosses?: Array<{ name: string; image: string; canBeShiny: boolean }>;
      shinies?: Array<{ name: string; image: string }>;
    };
  };
}

export interface RaidBoss {
  name: string;
  tier: string;
  canBeShiny: boolean;
  types: Array<{ name: string; image: string }>;
  combatPower: {
    normal: { min: number; max: number };
    boosted: { min: number; max: number };
  };
  boostedWeather: Array<{ name: string; image: string }>;
  image: string;
}

export interface ResearchTask {
  text: string;
  type?: string;
  rewards: Array<{
    name: string;
    image: string;
    canBeShiny: boolean;
    combatPower: { min: number; max: number };
  }>;
}

export interface EggPokemon {
  name: string;
  eggType: string;
  isAdventureSync: boolean;
  image: string;
  canBeShiny: boolean;
  combatPower: { min: number; max: number };
  isRegional: boolean;
  isGiftExchange: boolean;
  rarity: number;
}

export interface RocketLineup {
  name: string;
  title: string;
  type: string;
  firstPokemon: RocketPokemon[];
  secondPokemon: RocketPokemon[];
  thirdPokemon: RocketPokemon[];
}

export interface RocketPokemon {
  name: string;
  image: string;
  types: string[];
  isEncounter: boolean;
  canBeShiny: boolean;
}

export interface ScrapedDuckData {
  events: ScrapedDuckEvent[];
  raids: RaidBoss[];
  research: ResearchTask[];
  eggs: EggPokemon[];
  rockets: RocketLineup[];
}

export interface PriorityPokemon {
  name: string;
  normalizedName: string;
  score: number;
  sources: PrioritySource[];
  neededBy?: "both" | "you" | "partner";
}

export interface PrioritySource {
  type: "raid" | "shadow-raid" | "event" | "research" | "egg" | "upcoming-raid" | "upcoming" | "rocket";
  label: string;
  detail: string;
  availability?: string;
}
