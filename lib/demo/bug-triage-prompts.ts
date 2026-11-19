export const SUPPORT_CHANNEL = "#mars-bank-support";
export const TRIAGE_BOT_MENTION = "@Mars Triage";

export type TriagePromptKind = "duplicate" | "new";
export type TriagePromptTrigger = "mention" | "ambient";

export type TriagePrompt = {
  id: string;
  kind: TriagePromptKind;
  trigger: TriagePromptTrigger;
  title: string;
  prompt: string;
  whatHappens: string;
  seeIt: string;
};

export const triagePromptKindLabel: Record<TriagePromptKind, string> = {
  duplicate: "Existing Jira Bug (Duplicate Catch)",
  new: "New Bug (Live Repro + Auto-Fix PR)",
};

export const triagePromptTriggerLabel: Record<TriagePromptTrigger, string> = {
  mention: `${TRIAGE_BOT_MENTION} mention`,
  ambient: "Ambient post",
};

export const bugTriagePrompts: readonly TriagePrompt[] = [
  {
    id: "card-overpayment",
    kind: "duplicate",
    trigger: "mention",
    title: "Card overpayment vanished",
    prompt: `${TRIAGE_BOT_MENTION} I paid off my Expedition Credit card from my Sol Account and rounded it up to 100,000 to be safe. The card now says 0 owing, but the whole 100,000 came out of my Sol Account and I only owed about 82k. Where did the other 17k go?? It's not sitting on the card and it never came back.`,
    whatHappens:
      "The bot matches the MARS Jira bug already filed for card overpayments and replies in thread with the link. No repro run, no new ticket.",
    seeIt:
      "Cameron: Send, Between my accounts, Sol Account to Expedition Credit, 100,000. Owing drops to 0 and Sol Account drops the full 100,000.",
  },
  {
    id: "negative-sols",
    kind: "duplicate",
    trigger: "ambient",
    title: "Activity shows negative sols",
    prompt:
      "anyone else's activity page gone weird? I moved some tokens over to my Reserve this morning and now today shows as Sol 21 but everything older says Sol -64, Sol -66, Sol -68... negative sols?? it looked normal before I sent anything",
    whatHappens:
      "The bot picks up the post without a mention, finds the existing MARS Jira bug for negative sol headings, and links it in thread.",
    seeIt:
      "Make any transfer, then open the full ledger. Every older movement sits under a negative sol.",
  },
  {
    id: "search-account-names",
    kind: "new",
    trigger: "ambient",
    title: "Search misses account names",
    prompt:
      "Is search broken? I typed Expedition Credit into the bar at the top (the one that says 'Search transactions, accounts and payees') and it says 0 matching movements. I've definitely got a bunch of tram and rover charges on that card.",
    whatHappens:
      "No match in Jira or GitHub. A local agent reproduces it with a Vitest check, the bot files a new MARS Bug, and a Cloud Agent opens a fix PR with a fails-on-main test.",
    seeIt:
      "Search Expedition Credit from the top bar. The ledger reports 0 matching movements.",
  },
  {
    id: "received-counts-as-sent",
    kind: "new",
    trigger: "mention",
    title: "Received tokens block sending",
    prompt: `${TRIAGE_BOT_MENTION} Aaron paid my 200,000 token request this morning. Now every time I try to send Ben 60,000 I get "That send passes your 250,000 tokens PayID limit for this sol. Lower the amount or send next sol." I haven't sent anyone a single token today, how am I over a limit?`,
    whatHappens:
      "No match in Jira or GitHub. A local agent reproduces it against main, the bot files a new MARS Bug, and a Cloud Agent opens a fix PR with a fails-on-main regression test.",
    seeIt:
      "Aaron pays Cameron 200,000 by PayID. Cameron then sends Ben 60,000 and hits the limit message.",
  },
];
