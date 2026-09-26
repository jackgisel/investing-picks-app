/**
 * Read-only X campaign drafts for the admin Communication page.
 *
 * Copy is the tweet blocks. Planning notes stay out of this module. Nothing
 * here is scheduled or sent, and nothing in the UI posts it.
 *
 * Lists are names in a supply chain, not book entries. The two operating
 * figures (Modine data-center sales, the Powell order) are company-reported.
 * They are not an Outpick return.
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
    label: "01 · Cooling invoice",
    posts: [
      `$MOD's data-center SALES rose 90% in the latest quarter.

On that invoice:
1. $MOD — cooling for the hall
2. $POWL — switchgear outside it
3. $FIX — the crew that installs it
4. $ENS — batteries when the feed drops

Supply chain, not a book entry. Monday note, link in bio.`,
    ],
  },
  {
    id: "single-02",
    label: "02 · Ion implant",
    posts: [
      `$ACLS sells the ion implanters. The chip logo is downstream.

What a fab buys before the logo:
1. $ACLS — ion implant
2. $UCTT — subsystems on the tool
3. $ICHR — chemical delivery
4. $FORM — probe cards
5. $ENTG — filters and process chemicals

Not picks. Monday note, link in bio.`,
    ],
  },
  {
    id: "single-03",
    label: "03 · Outside the hall",
    posts: [
      `$POWL took a data-center order above $400 million. The gear sits OUTSIDE the hall.

Same side of the fence:
1. $POWL — switchgear and power rooms
2. $STRL — site work
3. $FIX — mechanical install
4. $MOD — cooling, once the power is in

YouTube walks a sector pass. Link in bio.`,
    ],
  },
  {
    id: "single-04",
    label: "04 · Site work",
    posts: [
      `$STRL does the site work. The photograph is the building that comes after.

Before the ribbon:
1. $STRL — site and electrical infrastructure
2. $FIX — installation
3. $POWL — power rooms
4. $MOD — cooling

Names in the chain. Monday note, link in bio.`,
    ],
  },
  {
    id: "single-05",
    label: "05 · Nuclear hardware",
    posts: [
      `$BWXT machines the nuclear components. The utility takes the power.

Before a watt hits the hall:
1. $BWXT — reactor hardware
2. $LEU — enrichment
3. $BE — fuel cells on the site
4. $ENS — backup batteries

A hot sector can still hand back an empty pass. Monday note, link in bio.`,
    ],
  },
  {
    id: "single-06",
    label: "06 · The hydrant",
    posts: [
      `$MWA sells the hydrant. A muni bond is a loan.

What a city budget actually buys:
1. $MWA — valves and hydrants
2. $BMI — water meters
3. $CNM — the distributor
4. $WLDN — engineering the city contracts out

We do not grade the bond. Monday note, link in bio.`,
    ],
  },
  {
    id: "single-07",
    label: "07 · Copper tube",
    posts: [
      `$MLI makes the copper tube. $FCX is the mine on the poster.

One step off the headline:
1. $MLI — tube and fittings
2. $BDC — copper cable
3. $HBM — copper in the ground

Bronze is copper plus tin. It has no sector. Monday note, link in bio.`,
    ],
  },
  {
    id: "single-08",
    label: "08 · Burn-in",
    posts: [
      `$AEHR stress-tests the wafer. The designer does not ship that machine.

After the print:
1. $AEHR — burn-in
2. $FORM — probe cards
3. $KLIC — assembly equipment
4. $UCTT — subsystems on the process tool

An empty pass is a result. Monday note, link in bio.`,
    ],
  },
  {
    id: "single-09",
    label: "09 · Gas delivery",
    posts: [
      `$UCTT sells the gas delivery. A process tool does not run without it.

On the back of the tool:
1. $UCTT — gas delivery
2. $ICHR — chemical delivery
3. $ACLS — ion implant
4. $KLIC — assembly equipment

Not book entries. Monday note, link in bio.`,
    ],
  },
  {
    id: "single-10",
    label: "10 · Onsite power",
    posts: [
      `$BE sells fuel cells that make power on the site.

1. $BE — onsite generation
2. $POWL — switchgear for that power
3. $ENS — batteries behind it
4. $BWXT — components, when the plant is nuclear

Virtual book. We place no trade. Monday note, link in bio.`,
    ],
  },
  {
    id: "single-11",
    label: "11 · The warehouse",
    posts: [
      `$CNM stocks the water pipe. The city buys from a warehouse.

1. $CNM — distribution
2. $MWA — hydrants and valves
3. $BMI — meters
4. $WLDN — the outside engineer

Operating companies, not a bond fund. Monday note, link in bio.`,
    ],
  },
  {
    id: "single-12",
    label: "12 · Enrichment",
    posts: [
      `$LEU enriches the uranium. The power poster skips this step.

Fuel, then the plant:
1. $LEU — enrichment
2. $BWXT — the heavy components
3. $BE — fuel cells where the grid is late
4. $ENS — batteries on site

No price target. Monday note, link in bio.`,
    ],
  },
];

export const CAMPAIGN_THREADS: readonly CampaignDraft[] = [
  {
    id: "thread-a",
    label: "Thread A · Semiconductors under the logo",
    posts: [
      `$ACLS sells ion implanters to the fab. The logo is downstream.

1. $ACLS — implant
2. $UCTT — gas delivery
3. $ICHR — chemical delivery
4. $FORM — probe cards
5. $KLIC — assembly equipment`,
      `$UCTT sells gas delivery for the process tool.

Take the tool apart and this is one of the subsystems with its own P&L.`,
      `$ICHR sells chemical delivery into that same tool.

Someone builds the plumbing. The tool company puts its name on the front.`,
      `$FORM sells the probe card that touches the wafer at test.

No contact, no shipment. This is a separate company from the designer.`,
      `$KLIC sells the equipment that assembles the chip after the wafer is cut.

Packaging is a factory with margins. It is not a footnote.`,
      `Naming a supplier is not a book entry.

An empty sector pass is a result, and it gets posted.

Monday note, free. Link in bio.`,
    ],
  },
  {
    id: "thread-b",
    label: "Thread B · Data centers, follow the invoice",
    posts: [
      `$POWL took a data-center order above $400 million. OUTSIDE the hall.

1. $POWL — switchgear and power rooms
2. $MOD — cooling
3. $FIX — installation
4. $STRL — site work
5. $ENS — backup batteries`,
      `$MOD broke data-center cooling out as its own segment.

The hall is no longer a line inside a general HVAC story.`,
      `$FIX installs the mechanicals. The landlord owns the roof.

Rent is one business. Hanging the cooling and the electrical is another.`,
      `$STRL does the site work before there is a building to photograph.

Dirt and electrical infrastructure come first.`,
      `$ENS sells the batteries that cover a dropped feed.

Onsite power is a stack of vendors. Batteries are one line of it.`,
      `A data-center landlord can be a real business and still be the wrong place to start.

The smaller invoice is the research. It still has to be a good business when the theme cools.`,
      `The long version of a sector pass is on YouTube. No price target in it.

Link in bio.`,
    ],
  },
  {
    id: "thread-c",
    label: "Thread C · Power, before the watt",
    posts: [
      `$BWXT machines nuclear components. The utility is the customer.

1. $BWXT — reactor hardware
2. $LEU — enrichment
3. $BE — onsite fuel cells
4. $ENS — backup batteries`,
      `$BWXT builds nuclear hardware for the Navy and for commercial plants.

The data-center power post rarely names the company that machines the parts.`,
      `$LEU sells enrichment. Most power posts skip the fuel.

The plant does not run on a slogan.`,
      `$BE sells fuel cells that make electricity on the site.

That is a product. It can still be an ordinary business in a hot sector.`,
      `A hot power sector fills up with ordinary companies wearing a good story.

Attention is not a factor. Valuation, growth, profitability, momentum, and estimate revisions are.`,
      `Outpick is a research membership. Flat annual fee. The book is virtual.

We do not place a trade, and we are not a broker.

Monday note, link in bio.`,
    ],
  },
  {
    id: "thread-d",
    label: "Thread D · City vendors, not the bond",
    posts: [
      `$MWA sells hydrants and valves to water systems. A muni bond is a loan.

1. $MWA — valves and hydrants
2. $BMI — meters
3. $CNM — distribution
4. $WLDN — engineering cities contract out`,
      `$BMI sells the water meter. The city pays for the measurement, month after month.`,
      `$CNM stocks pipe, valves, and meters for municipalities and contractors.

The purchase order goes to a distributor. It does not go to a bond desk.`,
      `A closed-end fund full of muni bonds has a ticker and no factory.

Revenue, margins, revisions: those factors need an operating company. The fund stays off the screen.`,
      `$WLDN sells engineering and energy work to cities and utilities.

A slow budget can fit a contractor. It can also prop up a business that only works while the budget grows.`,
      `Not a bond recommendation. Not a broker.

Monday note, link in bio.`,
    ],
  },
  {
    id: "thread-e",
    label: "Thread E · Copper, one step off the poster",
    posts: [
      `$MLI makes the copper tube. $FCX is the mine on the poster.

1. $MLI — tube and fittings
2. $BDC — copper cable
3. $HBM — a copper miner`,
      `$BDC sells copper cable and the connectors on the end of it.

The metal is the input. The product is the business.`,
      `$HBM mines copper. A miner and a tube mill do not share a peer group for touching the same metal.`,
      `Bronze is copper plus tin.

There is no bronze sector to rank, and tin is too thin a public set to invent one.`,
      `Copper is on the timeline because the build uses it.

Ordinary companies will wear that story. The story is not a factor.`,
      `No name in this thread is a book entry. No price target sits under it.

Monday note, link in bio.`,
    ],
  },
];

export function campaignDraftCounts(): { singles: number; threads: number } {
  return {
    singles: CAMPAIGN_SINGLES.length,
    threads: CAMPAIGN_THREADS.length,
  };
}
