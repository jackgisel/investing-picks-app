/**
 * Read-only X campaign drafts for the admin Communication page.
 *
 * Copy is the tweet blocks from the campaign review. Planning notes, hooks,
 * and the strategy write-up stay out of this module. Nothing here is scheduled
 * or sent, and nothing in the UI posts it.
 */

export type CampaignDraft = {
  id: string;
  /** Short theme label, shown as the card title. */
  label: string;
  /** Posts in publish order. A single has one entry. */
  posts: readonly string[];
};

export const CAMPAIGN_SINGLES: readonly CampaignDraft[] = [
  {
    id: "single-01",
    label: "01 · AI invoices",
    posts: [
      `The AI trade shows up in our screen as invoices.

Chips. Power gear. Copper cable. Whoever rents the building.

Each one gets scored against its own sector. A hot theme does not get a free pass.

Monday note is free. Link in the bio.`,
    ],
  },
  {
    id: "single-02",
    label: "02 · Semiconductor box",
    posts: [
      `Most semiconductor posts name the company on the box.

We look for the business that sells into that box and still clears its own sector on growth and revisions.

If none do, that empty result is the post.

Not a pick. Monday note, link in the bio.`,
    ],
  },
  {
    id: "single-03",
    label: "03 · Data-center roof",
    posts: [
      `A data center is a power contract with a roof.

The names everyone already owns are the roof. We go looking for the power equipment, the drives, the cooling, and grade them like any other business.

YouTube walks through a sector pass. Link in the bio.`,
    ],
  },
  {
    id: "single-04",
    label: "04 · Energy peers",
    posts: [
      `The energy question is which utility, equipment maker, or fuel supplier still looks like a good business scored against other energy names.

A hot sector can be full of ordinary companies.

Monday note, link in the bio.`,
    ],
  },
  {
    id: "single-05",
    label: "05 · Municipals",
    posts: [
      `Municipal bonds are not in this screen. We score US-listed operating companies.

What we can research is who sells water, waste, or infrastructure into a city budget, and whether that business is any good.

Monday note, link in the bio.`,
    ],
  },
  {
    id: "single-06",
    label: "06 · Bronze, then copper",
    posts: [
      `Bronze is mostly copper, plus tin. There is no bronze sector to screen.

Copper is miners, fabricators, and industrial users, scored against other materials names.

A bronze stock has no universe.

Monday note, link in the bio.`,
    ],
  },
  {
    id: "single-07",
    label: "07 · The blank result",
    posts: [
      `A sector can own the timeline and still hand us zero names.

The businesses inside the craze did not clear the same bar we use everywhere else.

We post the blank before we invent a ticker.

Monday note, link in the bio.`,
    ],
  },
  {
    id: "single-08",
    label: "08 · Smaller supplier",
    posts: [
      `The mega-cap is the advertisement.

The research is the smaller US-listed supplier with margins, revisions, and a balance sheet that can survive a bad year.

Same five factors. No exemption for a popular theme.

Monday note, link in the bio.`,
    ],
  },
  {
    id: "single-09",
    label: "09 · Flat fee",
    posts: [
      `Outpick is a research membership. Flat annual fee, not a cut of what you have invested.

The book is virtual. We do not place trades for you.

One written name on a fixed cadence, reasoning included when it goes against us.

Details in the bio.`,
    ],
  },
  {
    id: "single-10",
    label: "10 · No old backtest",
    posts: [
      `We are not going to quote an old backtest at you.

No price target. No buy-this-morning. No promise about next year.

If a post needs a number, it has to come from the screen that day.

Monday note, link in the bio.`,
    ],
  },
  {
    id: "single-11",
    label: "11 · Five factors",
    posts: [
      `Five factors: valuation, growth, profitability, momentum, estimate revisions.

Each one is graded inside the company's own sector. A cheap miner and a cheap software firm are different claims.

The weights stay in-house.

Monday note, link in the bio.`,
    ],
  },
  {
    id: "single-12",
    label: "12 · Note or YouTube",
    posts: [
      `The Monday note is the short version. Which sectors are clearing, and whether that is businesses improving or prices falling.

The long version, a full sector pass, is on YouTube.

Both are free. The written picks are the membership.

Links in the bio.`,
    ],
  },
];

export const CAMPAIGN_THREADS: readonly CampaignDraft[] = [
  {
    id: "thread-a",
    label: "Thread A · Semiconductors under the mega-caps",
    posts: [
      `The semiconductor post everyone writes names the company on the box.

We start one step upstream, and one step down.`,
      `Upstream is equipment, materials, and the chemicals a fab actually consumes.

Downstream is whoever packages, tests, or designs around the chip and still has to earn a living when the logo company sneezes.`,
      `We do not score "semiconductors" as a mood.

Each US-listed name is scored against its own sector: valuation, growth, profitability, momentum, estimate revisions.`,
      `A mega-cap can be a fine business and still be the wrong subject.

Everyone already has that memo. The useful question is whether a smaller supplier clears the same bar.`,
      `Smaller is not a compliment by itself.

We still want margins that survive a bad year, and a balance sheet that does not have to raise money at the worst moment.`,
      `The name, when the sector pass returns one, has to answer four things.

What it sells. Who pays. Which factor is doing the work. What would make the read wrong.

No ticker until that pass exists.`,
      `If the pass comes back empty, the thread stops.

A crowded sector with no qualifying business is a finding. Inventing a ticker is how a research account becomes a tip account.`,
      `Not a recommendation. A high score can still fail a later gate, or never enter the book.

Monday note, free, no picks:
https://outpick.xyz/market-note`,
    ],
  },
  {
    id: "thread-b",
    label: "Thread B · Copper, and what to do with bronze",
    posts: [
      `Bronze is an alloy of copper and tin. It does not have its own stock universe.

There is no bronze sector on a US screen.`,
      `Tin is the other half, and the public equity set around tin is thin.

A screen that needs a real peer group cannot invent one out of a handful of names and a vibe.`,
      `Copper is the universe we can actually grade.

Miners. Smelters and fabricators. Wire, cable, and the industrial users who buy the metal because a product needs it.`,
      `Those are different businesses. A miner and a cable company do not get the same excuse because both touch copper.

Each is scored against its own sector, on the same five factors as a software firm.`,
      `The AI and grid buildout is why copper is on the timeline. It is also why the sector will fill up with ordinary companies wearing a good story.

Attention is not a factor.`,
      `The name worth writing, when materials clears, is a smaller operator.

Durable margins. Revisions that are actually moving. Not the copper name already in every deck.

No ticker in this thread until that pass is in.`,
      `If nothing clears, we say so.

Copper can be the theme and the screen can still pass. That sentence is more useful than a forced pick.`,
      `Research, not a trade alert.

The Monday note is where the sector read goes:
https://outpick.xyz/market-note`,
    ],
  },
  {
    id: "thread-c",
    label: "Thread C · Data centers, follow the invoice",
    posts: [
      `A data center is a power contract with a roof on it.

The photograph is the building. The business is whoever gets paid to make the building usable.`,
      `Follow the invoice, not the ribbon cutting.

Power equipment. Cooling. Electrical gear. Storage that is cheap per terabyte. The contractor who has to deliver the hall on a date.`,
      `The landlord REIT is the name the timeline already owns.

It can be a real business. It is a poor place to start if the job is a smaller company the screen has not already turned into a headline.`,
      `We score US-listed names against their own sector.

A cooling company is not graded against a chip designer. A drive maker is not graded against a utility. Same five factors, different peer group.`,
      `The failure mode in this theme is treating every vendor as a call option on AI capex.

Capex can be real and the vendor can still be a bad business: thin margins, a balance sheet that breaks, estimates going the wrong way.`,
      `The post, when the pass is fresh, is one smaller name.

What it sells into the hall. Who signs the check. Which factor cleared. What would falsify it.

Until that pass exists, the thread stops at the setup.`,
      `An empty slot is allowed.

Data centers can be the whole conversation for a month and still produce no name we would write up. That result gets posted too.`,
      `Longer walk-through of a sector pass is on YouTube. No ticker, no price target.

https://www.youtube.com/@outpickxyz`,
    ],
  },
  {
    id: "thread-d",
    label: "Thread D · Municipals are bonds. The screen is the vendor.",
    posts: [
      `Municipal bonds are a credit product. This membership is an equity screen.

We do not grade a city's bond the way we grade a business.`,
      `What we can do is look at operating companies that sell into a municipal budget.

Water. Waste. The engineer or contractor a city actually pays. Public-finance software, if it is a business with financials and a peer group.`,
      `A closed-end fund full of muni bonds is a portfolio of loans.

Our factors are built for operating companies: growth, profitability, revisions, valuation, momentum. A bond fund does not become a business because it has a ticker.`,
      `City budgets are slow, political, and real.

That can suit a company with contracted revenue. It can also hide a business that only works while the budget grows. The screen does not skip that question because infrastructure is in fashion.`,
      `Same rule as everywhere else.

Score the company against its own sector. Prefer the smaller name if it actually clears. If the peer group is too thin to rank, we do not force a grade.`,
      `When a water, waste, or city-infrastructure name clears, the post is specific.

What it sells to the city. Who pays. What would make the read wrong.

No famous utility gets dropped in to fill the gap.`,
      `Not advice, and not a bond recommendation either.

Monday note:
https://outpick.xyz/market-note`,
    ],
  },
  {
    id: "thread-e",
    label: "Thread E · How a sector pass becomes a post",
    posts: [
      `Every post in this campaign starts as a sector pass, or it does not get written.

The timeline does not get to pick the topic. The rotation does. Then the screen gets a veto.`,
      `The pass is the same one behind the Monday note.

Which sectors are clearing. Whether that looks like businesses improving, or just prices falling. We do not invent breadth we did not measure.`,
      `Inside the sector we are not hunting the mega-cap.

We are looking for a smaller US-listed business in the supply chain: something that sells a real product to a real customer and can be graded against peers.`,
      `Five factors, said in public on purpose.

Valuation. Growth. Profitability. Momentum. Estimate revisions. Each one measured inside the sector, so a cheap miner and a cheap software company stay different claims.`,
      `The weights and the gates stay off this account.

You can understand the method without being handed the model. The membership is the written work, not a recipe.`,
      `A name that scores well is still not a pick.

It can fail a later rule, run into a sector limit, or simply never enter the book. If we name one, we say that in the same post.`,
      `Most days the honest post is the setup, plus a blank where the ticker would go.

Swap in the scored name only after the pass. If the pass is empty, publish the empty.`,
      `This is how AI, chips, data centers, power, city vendors, and copper all get the same treatment.

The theme gets the attention. The business still has to clear.`,
      `The long version of a sector pass is on YouTube. No ticker in it, no price target.

https://www.youtube.com/@outpickxyz`,
    ],
  },
];

export function campaignDraftCounts(): { singles: number; threads: number } {
  return {
    singles: CAMPAIGN_SINGLES.length,
    threads: CAMPAIGN_THREADS.length,
  };
}
