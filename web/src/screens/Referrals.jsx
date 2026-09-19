import React, { useState } from "react";
import { CheckCircle2, XCircle, AlertTriangle, ChevronDown, ChevronUp, ShieldAlert, Ban, RotateCcw } from "lucide-react";
import { C, inr } from "../theme";
import { Avatar, Chip, TableCard, SearchBox, FilterChips } from "../components/shared";

// Plain-English labels for every warning flag. A flag is a reason to look closer before paying — never an
// automatic block (a family can share one Wi-Fi; a host can type gifts quickly). "High" ones are the
// patterns that almost never have an innocent explanation.
const FLAGS = {
  same_upi_as_referee: { label: "Payout UPI matches the friend's own event UPI", high: true },
  giver_is_referrer_or_self: { label: "One of the 'givers' is the referrer's or the friend's own mobile number", high: true },
  upi_used_by_other_referrer: { label: "This UPI ID is also claimed by a different referrer", high: true },
  referrer_suspended: { label: "Referrer's account is suspended", high: true },
  referrer_has_open_fraud_case: { label: "Referrer has an open fraud case", high: true },
  same_network_as_referrer: { label: "Referrer and friend signed up from the same connection" },
  entries_all_same_amount: { label: "Every gift entry has the identical amount" },
  entries_created_within_5_min: { label: "All the friend's gift entries were typed within 5 minutes" },
  giver_mobiles_repeated: { label: "All gift entries use the same giver mobile number" },
  referrer_burst: { label: "Referrer earned 3+ rewards within 24 hours" },
  qualified_within_30_min_of_signup: { label: "Friend qualified within 30 min of signing up" },
  friend_evidence_missing: { label: "The friend's gift entries are no longer there (deleted after qualifying?)" },
};

const STATUS_TONE = {
  earned: [C.primary, C.primarySoft],
  claimed: [C.warning, C.warningSoft],
  paid: [C.success, C.successSoft],
  rejected: [C.error, C.errorSoft],
};
const STATUS_LABEL = { earned: "Not claimed yet", claimed: "Awaiting payout", paid: "Paid", rejected: "Rejected" };

const Stat = ({ label, value, sub, tone, onClick }) => (
  <div className="rf-card" style={{ padding: 18, cursor: onClick ? "pointer" : "default" }} onClick={onClick}>
    <div style={{ fontSize: 12.5, color: C.sub }}>{label}</div>
    <div style={{ fontSize: 26, fontWeight: 800, color: tone || C.text, marginTop: 6 }}>{value}</div>
    {sub && <div style={{ fontSize: 12, color: C.sub, marginTop: 2 }}>{sub}</div>}
  </div>
);

const FlagList = ({ flags }) => (
  flags.length === 0
    ? <span style={{ fontSize: 12, color: C.sub }}>No flags</span>
    : flags.map((f) => {
      const meta = FLAGS[f] || { label: f };
      return (
        <div key={f} style={{ display: "flex", gap: 5, alignItems: "flex-start", fontSize: 12, color: meta.high ? C.error : C.warning, marginBottom: 3 }}>
          <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 1 }} />{meta.label}
        </div>
      );
    })
);

const Field = ({ k, v }) => (
  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 12.5, padding: "3px 0" }}>
    <span style={{ color: C.sub }}>{k}</span><span style={{ fontWeight: 600, textAlign: "right" }}>{v}</span>
  </div>
);

function Payouts({ rewards, onReview, onReopen, onFraud, onSuspend }) {
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("Awaiting payout");
  const [busyId, setBusyId] = useState(null);
  const [open, setOpen] = useState({});

  const byLabel = { All: null, "Awaiting payout": "claimed", "Not claimed yet": "earned", Paid: "paid", Rejected: "rejected" };
  const rows = rewards.filter((r) => {
    const mq = !q || `${r.referrer} ${r.referee} ${r.referrerMobile} ${r.refereeMobile} ${r.upi} ${r.payoutRef}`.toLowerCase().includes(q.toLowerCase());
    const want = byLabel[statusFilter];
    return mq && (!want || r.status === want);
  });
  const sum = (s) => rewards.filter((r) => r.status === s).reduce((a, r) => a + r.amount, 0);
  const awaiting = rewards.filter((r) => r.status === "claimed");
  const flaggedAwaiting = awaiting.filter((r) => r.flags.length > 0).length;

  const act = async (r, status) => {
    let note = "", reference = "";
    if (status === "rejected") {
      note = (window.prompt(`Why is this reward being rejected? (shown to ${r.referrer})`) || "").trim();
      if (!note) return;
    } else {
      reference = (window.prompt(`First send ${inr(r.amount)} to ${r.upi} yourself, then enter the payment reference (UPI transaction / UTR number) here:`) || "").trim();
      if (!reference) return;
    }
    setBusyId(r.id);
    try { await onReview(r.id, status, note, reference); } catch (err) { window.alert(err.message || "Could not update this reward"); }
    setBusyId(null);
  };

  // Undo a rejection: the reward goes back to Awaiting payout and the person is told it is back in review.
  const reopen = async (r) => {
    const note = (window.prompt(`Why are you reopening this reward? (kept in the audit log)\n\nIt goes back to "Awaiting payout" and ${r.referrer} is told it is back in review.`) || "").trim();
    if (!note) return;
    setBusyId(r.id);
    try { await onReopen(r.id, note); } catch (err) { window.alert(err.message || "Could not reopen this reward"); }
    setBusyId(null);
  };

  const flagAsFraud = async (r) => {
    const evidence = `Referral reward #${r.id} (${inr(r.amount)}): referrer ${r.referrer} (${r.referrerMobile}) referred ${r.referee} (${r.refereeMobile}). ` +
      `Friend has ${r.evidence.events} event(s), ${r.evidence.entries} received entries from ${r.evidence.givers} different people totalling ${inr(r.evidence.collected)}.`;
    if (!window.confirm(`Open a fraud case against ${r.referrer}?\n\nThis logs the evidence in Fraud & Spam. It does not reject the payout or suspend the account — use Reject / Suspend for that.`)) return;
    setBusyId(r.id);
    try { await onFraud(r, evidence); window.alert("Fraud case created — see the Fraud & Spam screen."); } catch (err) { window.alert(err.message || "Could not create the case"); }
    setBusyId(null);
  };

  const toggleSuspend = async (r) => {
    const suspending = r.referrerStatus !== "Suspended";
    if (!window.confirm(`${suspending ? "Suspend" : "Reinstate"} ${r.referrer}'s account?${suspending ? "\n\nThey will no longer be able to claim referral rewards." : ""}`)) return;
    setBusyId(r.id);
    try { await onSuspend(r.referrerId, r.referrerStatus); } catch (err) { window.alert(err.message || "Could not update the account"); }
    setBusyId(null);
  };

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
        <Stat label="Awaiting payout" value={inr(sum("claimed"))} tone={awaiting.length ? C.warning : C.text}
          sub={`${awaiting.length} claim${awaiting.length === 1 ? "" : "s"}${flaggedAwaiting ? ` · ${flaggedAwaiting} with warning flags` : ""}`}
          onClick={() => setStatusFilter("Awaiting payout")} />
        <Stat label="Paid so far" value={inr(sum("paid"))} tone={C.success} />
        <Stat label="Earned, not yet claimed" value={inr(sum("earned"))} />
      </div>

      <TableCard
        columns={["Referrer", "Friend they referred", "Amount", "Pay to (UPI)", "Status", "Checks", "Actions"]}
        rows={rows}
        empty="Nothing here."
        controls={<>
          <SearchBox placeholder="Search name, mobile, UPI or payment ref…" value={q} onChange={setQ} />
          <FilterChips items={["Awaiting payout", "Not claimed yet", "Paid", "Rejected", "All"]} active={statusFilter} onSelect={setStatusFilter} />
        </>}
        footer={`Showing ${rows.length} of ${rewards.length} rewards`}
        renderRow={(r) => (
          <React.Fragment key={r.id}>
            <tr>
              <td><div style={{ display: "flex", alignItems: "center", gap: 8 }}><Avatar name={r.referrer} size={26} /><div><div style={{ fontWeight: 600 }}>{r.referrer}</div><div style={{ fontSize: 11, color: C.sub }}>{r.referrerMobile}</div></div></div></td>
              <td><div style={{ fontWeight: 600 }}>{r.referee}</div><div style={{ fontSize: 11, color: C.sub }}>{r.refereeMobile}</div></td>
              <td style={{ fontWeight: 700 }}>{inr(r.amount)}</td>
              <td style={{ fontFamily: "monospace", fontSize: 12.5 }}>{r.upi || "—"}<div style={{ fontFamily: "inherit", fontSize: 11, color: C.sub }}>{r.claimed !== "—" ? `Claimed ${r.claimed}` : `Earned ${r.earned}`}</div></td>
              <td>
                <Chip text={STATUS_LABEL[r.status] || r.status} tone={STATUS_TONE[r.status] || [C.sub, C.bg]} />
                {r.payoutRef && <div style={{ fontSize: 11, color: C.sub, marginTop: 4 }}>Ref {r.payoutRef}</div>}
                {r.note && <div style={{ fontSize: 11, color: C.sub, marginTop: 4 }}>{r.note}</div>}
              </td>
              <td style={{ maxWidth: 240 }}><FlagList flags={r.flags} /></td>
              <td>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <button className="rf-btn ghost" style={{ padding: "6px 10px", fontSize: 12 }} onClick={() => setOpen({ ...open, [r.id]: !open[r.id] })}>
                    {open[r.id] ? <ChevronUp size={13} /> : <ChevronDown size={13} />} Details
                  </button>
                  {r.status === "rejected" && (
                    <button className="rf-btn ghost" disabled={busyId === r.id} style={{ padding: "6px 10px", fontSize: 12 }} onClick={() => reopen(r)}><RotateCcw size={13} /> Reopen</button>
                  )}
                  {r.status === "claimed" && (<>
                    <button className="rf-btn ghost" disabled={busyId === r.id} style={{ padding: "6px 10px", fontSize: 12 }} onClick={() => act(r, "paid")}><CheckCircle2 size={13} /> Mark paid</button>
                    <button className="rf-btn ghost" disabled={busyId === r.id} style={{ padding: "6px 10px", fontSize: 12, color: C.error }} onClick={() => act(r, "rejected")}><XCircle size={13} /> Reject</button>
                  </>)}
                </div>
              </td>
            </tr>
            {open[r.id] && (
              <tr>
                <td colSpan={7} style={{ background: C.bg, padding: 16 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 24 }}>
                    <div>
                      <div style={{ fontWeight: 700, marginBottom: 6 }}>What the friend actually did</div>
                      <Field k="Joined" v={r.refereeJoined} />
                      <Field k="Events created" v={r.evidence.events} />
                      <Field k="Gift entries received" v={r.evidence.entries} />
                      <Field k="From different people" v={r.evidence.givers} />
                      <Field k="Total collected" v={inr(r.evidence.collected)} />
                      {r.evidence.eventList && <div style={{ fontSize: 12, color: C.sub, marginTop: 6 }}>{r.evidence.eventList}</div>}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, marginBottom: 6 }}>The referrer's record</div>
                      <Field k="Joined" v={r.referrerJoined} />
                      <Field k="Friends invited" v={r.evidence.referrerInvited} />
                      <Field k="Rewards earned (count)" v={r.evidence.referrerQualified} />
                      <Field k="Paid to them so far" v={inr(r.evidence.referrerPaid)} />
                      <Field k="Account" v={r.referrerStatus || "Active"} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, marginBottom: 6 }}>Why the checks fired</div>
                      <FlagList flags={r.flags} />
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 10 }}>
                        <button className="rf-btn ghost" disabled={busyId === r.id} style={{ padding: "6px 10px", fontSize: 12, color: C.error }} onClick={() => flagAsFraud(r)}><ShieldAlert size={13} /> Flag as fraud</button>
                        <button className="rf-btn ghost" disabled={busyId === r.id} style={{ padding: "6px 10px", fontSize: 12 }} onClick={() => toggleSuspend(r)}><Ban size={13} /> {r.referrerStatus === "Suspended" ? "Reinstate referrer" : "Suspend referrer"}</button>
                      </div>
                      {r.reviewed && <div style={{ fontSize: 11.5, color: C.sub, marginTop: 8 }}>Reviewed {r.reviewed}</div>}
                      {r.reopened && <div style={{ fontSize: 11.5, color: C.sub, marginTop: 8 }}>Reopened {r.reopened}{r.priorRejection ? ` — it had been rejected: “${r.priorRejection}”` : ""}</div>}
                    </div>
                  </div>
                </td>
              </tr>
            )}
          </React.Fragment>
        )}
      />
    </div>
  );
}

function Summary({ summary }) {
  if (!summary || !summary.totals) return <div className="rf-card" style={{ padding: 24, color: C.sub }}>No referral activity yet.</div>;
  const t = summary.totals, p = summary.pool;
  const rate = t.joined ? Math.round((t.qualified / t.joined) * 100) : 0;
  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
        <Stat label="Friends who joined with a code" value={t.joined} sub={`${t.qualified} qualified (${rate}%)`} />
        <Stat label="Total earned by referrers" value={inr(t.earned)} sub={`${t.earned_n} reward${t.earned_n === 1 ? "" : "s"} · avg ${inr(t.avg)}`} />
        <Stat label="Paid out" value={inr(t.paid)} tone={C.success} sub={`${t.paid_n} payment${t.paid_n === 1 ? "" : "s"}`} />
        <Stat label="Still to pay" value={inr(t.awaiting + t.unclaimed)} tone={t.awaiting ? C.warning : C.text} sub={`${inr(t.awaiting)} claimed · ${inr(t.unclaimed)} not yet claimed`} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
        <Stat label="Rejected (money saved)" value={inr(t.rejected)} sub={`${t.rejected_n} reward${t.rejected_n === 1 ? "" : "s"}`} />
        <Stat label="Rewards with warning flags" value={t.flagged} tone={t.flagged ? C.warning : C.text} />
        <Stat label="Over a referrer's limit (unpaid)" value={t.capped} sub="qualified but past the per-person cap" />
        {p && (
          <div className="rf-card" style={{ padding: 18 }}>
            <div style={{ fontSize: 12.5, color: C.sub }}>Prize pool — block {p.block}</div>
            <div style={{ fontSize: 26, fontWeight: 800, marginTop: 6 }}>{p.used} / {p.size}</div>
            <div style={{ fontSize: 12, color: C.sub, marginTop: 2 }}>
              Left in this block: {p.remaining.map((s) => `${s.left}×${inr(s.amount)}`).join(" · ")}
            </div>
          </div>
        )}
      </div>

      <TableCard
        columns={["Referrer", "Friends invited", "Qualified", "Total earned", "Paid", "Awaiting", "Not claimed", "Rejected", "Flags", "Account"]}
        rows={summary.referrers}
        empty="No referrers yet."
        footer={`${summary.referrers.length} referrer${summary.referrers.length === 1 ? "" : "s"} · "Total earned" = earned + claimed + paid`}
        renderRow={(r) => (
          <tr key={r.id}>
            <td><div style={{ display: "flex", alignItems: "center", gap: 8 }}><Avatar name={r.name} size={26} /><div><div style={{ fontWeight: 600 }}>{r.name}</div><div style={{ fontSize: 11, color: C.sub }}>{r.mobile}</div></div></div></td>
            <td>{r.invited}</td>
            <td>{r.qualified}</td>
            <td style={{ fontWeight: 700 }}>{inr(r.total_earned)}</td>
            <td style={{ color: C.success, fontWeight: 600 }}>{inr(r.paid)}</td>
            <td>{inr(r.awaiting)}</td>
            <td>{inr(r.unclaimed)}</td>
            <td>{inr(r.rejected)}</td>
            <td>{r.flagged ? <Chip text={`${r.flagged} flagged`} tone={[C.warning, C.warningSoft]} /> : <span style={{ color: C.sub, fontSize: 12 }}>—</span>}</td>
            <td><Chip text={r.status || "Active"} tone={r.status === "Suspended" ? [C.error, C.errorSoft] : [C.success, C.successSoft]} /></td>
          </tr>
        )}
      />
    </div>
  );
}

export default function ReferralsScreen({ rewards, summary, onReview, onReopen, onFraud, onSuspend }) {
  const [tab, setTab] = useState("Payouts");
  return (
    <div className="rf-fade" style={{ display: "grid", gap: 20 }}>
      <FilterChips items={["Payouts", "Summary"]} active={tab} onSelect={setTab} />
      {tab === "Payouts"
        ? <Payouts rewards={rewards} onReview={onReview} onReopen={onReopen} onFraud={onFraud} onSuspend={onSuspend} />
        : <Summary summary={summary} />}
    </div>
  );
}
