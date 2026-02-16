import test from "node:test";
import assert from "node:assert/strict";
import { scrapeEventPageHtml } from "../scripts/scrapers/event-page.mjs";

// ---------------------------------------------------------------------------
// Spawns
// ---------------------------------------------------------------------------

test("extracts spawn names and shiny status", () => {
  const html = `
    <h2 id="spawns" class="event-section-header spawns">Spawns</h2>
    <h2 id="wild-encounters">Wild Encounters</h2>
    <ul class="pkmn-list-flex">
      <li class="pkmn-list-item">
        <div class="pkmn-list-img poison"><img src="icon.png" /></div>
        <img class="shiny-icon" src="shiny.png" alt="shiny" />
        <div class="pkmn-name">Nidoran♀</div>
      </li>
      <li class="pkmn-list-item">
        <div class="pkmn-list-img normal"><img src="icon2.png" /></div>
        <div class="pkmn-name">Pidgey</div>
      </li>
    </ul>`;
  const result = scrapeEventPageHtml(html);
  assert.equal(result.spawns.length, 2);
  assert.equal(result.spawns[0].name, "Nidoran♀");
  assert.equal(result.spawns[0].canBeShiny, true);
  assert.equal(result.spawns[1].name, "Pidgey");
  assert.equal(result.spawns[1].canBeShiny, false);
});

test("collects spawns from multiple pkmn-list-flex lists (common + rare)", () => {
  const html = `
    <h2 id="spawns" class="event-section-header spawns">Spawns</h2>
    <p>Common spawns</p>
    <ul class="pkmn-list-flex">
      <li class="pkmn-list-item"><div class="pkmn-list-img"><img /></div><div class="pkmn-name">Plusle</div></li>
    </ul>
    <p>Rare spawns</p>
    <ul class="pkmn-list-flex">
      <li class="pkmn-list-item"><div class="pkmn-list-img"><img /></div><div class="pkmn-name">Audino</div></li>
    </ul>
    <h2 id="eggs" class="event-section-header eggs">Eggs</h2>`;
  const result = scrapeEventPageHtml(html);
  assert.equal(result.spawns.length, 2);
  assert.equal(result.spawns[0].name, "Plusle");
  assert.equal(result.spawns[1].name, "Audino");
});

// ---------------------------------------------------------------------------
// Eggs
// ---------------------------------------------------------------------------

test("extracts egg Pokemon with distance from CSS class", () => {
  const html = `
    <h2 id="eggs" class="event-section-header eggs">Eggs</h2>
    <ul class="pkmn-list-flex">
      <li class="pkmn-list-item">
        <div class="pkmn-list-img egg7km"><img src="icon.png" /></div>
        <img class="shiny-icon" src="shiny.png" alt="shiny" />
        <div class="pkmn-name">Igglybuff</div>
      </li>
      <li class="pkmn-list-item">
        <div class="pkmn-list-img egg2km"><img src="icon2.png" /></div>
        <div class="pkmn-name">Togepi</div>
      </li>
    </ul>`;
  const result = scrapeEventPageHtml(html);
  assert.equal(result.eventEggs.length, 2);
  assert.equal(result.eventEggs[0].name, "Igglybuff");
  assert.equal(result.eventEggs[0].eggDistance, "7 km");
  assert.equal(result.eventEggs[0].canBeShiny, true);
  assert.equal(result.eventEggs[1].name, "Togepi");
  assert.equal(result.eventEggs[1].eggDistance, "2 km");
  assert.equal(result.eventEggs[1].canBeShiny, false);
});

test("handles missing egg distance class gracefully", () => {
  const html = `
    <h2 id="eggs" class="event-section-header eggs">Eggs</h2>
    <ul class="pkmn-list-flex">
      <li class="pkmn-list-item">
        <div class="pkmn-list-img normal"><img src="icon.png" /></div>
        <div class="pkmn-name">Happiny</div>
      </li>
    </ul>`;
  const result = scrapeEventPageHtml(html);
  assert.equal(result.eventEggs.length, 1);
  assert.equal(result.eventEggs[0].eggDistance, "unknown");
});

// ---------------------------------------------------------------------------
// Research
// ---------------------------------------------------------------------------

test("extracts research tasks with reward Pokemon", () => {
  const html = `
    <h2 id="research" class="event-section-header research">Research</h2>
    <ul class="event-field-research-list">
      <li>
        <span class="task"> Catch 5 Pokemon</span>
        <div class="reward-list">
          <div class="reward">
            <span class="reward-bubble"><img class="reward-image" /><img class="shiny-icon" /></span>
            <span class="reward-label"><span>Plusle</span></span>
          </div>
          <div class="reward">
            <span class="reward-bubble"><img class="reward-image" /></span>
            <span class="reward-label"><span>Minun</span></span>
          </div>
        </div>
      </li>
      <li>
        <span class="task"> Trade a Pokemon</span>
        <div class="reward-list">
          <div class="reward">
            <span class="reward-bubble"><img class="reward-image" /></span>
            <span class="reward-label"><span>Tandemaus</span></span>
          </div>
        </div>
      </li>
    </ul>`;
  const result = scrapeEventPageHtml(html);
  assert.equal(result.eventResearch.length, 2);
  assert.equal(result.eventResearch[0].task, "Catch 5 Pokemon");
  assert.equal(result.eventResearch[0].rewards.length, 2);
  assert.equal(result.eventResearch[0].rewards[0].name, "Plusle");
  assert.equal(result.eventResearch[0].rewards[0].canBeShiny, true);
  assert.equal(result.eventResearch[0].rewards[1].name, "Minun");
  assert.equal(result.eventResearch[0].rewards[1].canBeShiny, false);
  assert.equal(result.eventResearch[1].task, "Trade a Pokemon");
  assert.equal(result.eventResearch[1].rewards[0].name, "Tandemaus");
});

// ---------------------------------------------------------------------------
// Raid bosses
// ---------------------------------------------------------------------------

test("extracts raid bosses from raids section", () => {
  const html = `
    <h2 id="raids" class="event-section-header raids">Raids</h2>
    <h2 id="three-star-raids">Three-Star Raids</h2>
    <ul class="pkmn-list-flex">
      <li class="pkmn-list-item">
        <div class="pkmn-list-img"><img /></div>
        <img class="shiny-icon" />
        <div class="pkmn-name">Crown Nidoqueen</div>
      </li>
      <li class="pkmn-list-item">
        <div class="pkmn-list-img"><img /></div>
        <div class="pkmn-name">Gardevoir</div>
      </li>
    </ul>`;
  const result = scrapeEventPageHtml(html);
  assert.equal(result.raidBosses.length, 2);
  assert.equal(result.raidBosses[0].name, "Crown Nidoqueen");
  assert.equal(result.raidBosses[0].canBeShiny, true);
  assert.equal(result.raidBosses[1].name, "Gardevoir");
  assert.equal(result.raidBosses[1].canBeShiny, false);
});

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

test("returns empty arrays when no sections exist", () => {
  const html = `<html><body><p>Just a paragraph</p></body></html>`;
  const result = scrapeEventPageHtml(html);
  assert.deepEqual(result.spawns, []);
  assert.deepEqual(result.eventEggs, []);
  assert.deepEqual(result.eventResearch, []);
  assert.deepEqual(result.raidBosses, []);
});

test("skips items with empty names", () => {
  const html = `
    <h2 id="spawns" class="event-section-header spawns">Spawns</h2>
    <ul class="pkmn-list-flex">
      <li class="pkmn-list-item">
        <div class="pkmn-list-img"><img /></div>
        <div class="pkmn-name">  </div>
      </li>
      <li class="pkmn-list-item">
        <div class="pkmn-list-img"><img /></div>
        <div class="pkmn-name">Pikachu</div>
      </li>
    </ul>`;
  const result = scrapeEventPageHtml(html);
  assert.equal(result.spawns.length, 1);
  assert.equal(result.spawns[0].name, "Pikachu");
});

test("stops collecting at next event-section-header", () => {
  const html = `
    <h2 id="spawns" class="event-section-header spawns">Spawns</h2>
    <ul class="pkmn-list-flex">
      <li class="pkmn-list-item"><div class="pkmn-list-img"><img /></div><div class="pkmn-name">Bulbasaur</div></li>
    </ul>
    <h2 id="eggs" class="event-section-header eggs">Eggs</h2>
    <ul class="pkmn-list-flex">
      <li class="pkmn-list-item"><div class="pkmn-list-img egg7km"><img /></div><div class="pkmn-name">Togepi</div></li>
    </ul>`;
  const result = scrapeEventPageHtml(html);
  assert.equal(result.spawns.length, 1);
  assert.equal(result.spawns[0].name, "Bulbasaur");
  assert.equal(result.eventEggs.length, 1);
  assert.equal(result.eventEggs[0].name, "Togepi");
});

test("trims whitespace from Pokemon names", () => {
  const html = `
    <h2 id="spawns" class="event-section-header spawns">Spawns</h2>
    <ul class="pkmn-list-flex">
      <li class="pkmn-list-item">
        <div class="pkmn-list-img"><img /></div>
        <div class="pkmn-name">Nidoran♀ </div>
      </li>
    </ul>`;
  const result = scrapeEventPageHtml(html);
  assert.equal(result.spawns[0].name, "Nidoran♀");
});
