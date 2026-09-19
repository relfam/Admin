import React, { useState } from "react";
import { Star, CheckCircle2 } from "lucide-react";
import { C } from "../theme";
import { Avatar, Chip, TableCard, SearchBox, FilterChips } from "../components/shared";

const Stars = ({ n }) => (
  <div style={{ display: "flex", gap: 1 }}>
    {[1, 2, 3, 4, 5].map((i) => (
      <Star key={i} size={14} fill={i <= n ? C.gold : "none"} stroke={i <= n ? C.gold : C.border} />
    ))}
  </div>
);

export default function FeedbackScreen({ feedback, onSetStatus }) {
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [ratingFilter, setRatingFilter] = useState("All");

  const rows = feedback.filter((f) => {
    const mq = !q || (f.user + " " + f.message).toLowerCase().includes(q.toLowerCase());
    const ms = statusFilter === "All" || f.status === statusFilter;
    const mr = ratingFilter === "All" || f.rating === Number(ratingFilter);
    return mq && ms && mr;
  });

  const avgRating = feedback.length ? (feedback.reduce((a, f) => a + f.rating, 0) / feedback.length).toFixed(1) : "—";
  const newCount = feedback.filter((f) => f.status === "New").length;

  return (
    <div className="rf-fade" style={{ display: "grid", gap: 20 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
        <div className="rf-card" style={{ padding: 18 }}>
          <div style={{ fontSize: 12.5, color: C.sub }}>Total Feedback</div>
          <div style={{ fontSize: 26, fontWeight: 800, marginTop: 6 }}>{feedback.length}</div>
        </div>
        <div className="rf-card" style={{ padding: 18 }}>
          <div style={{ fontSize: 12.5, color: C.sub }}>Average Rating</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 6 }}>
            <span style={{ fontSize: 26, fontWeight: 800, color: C.gold }}>{avgRating}</span>
            {feedback.length > 0 && <Stars n={Math.round(Number(avgRating))} />}
          </div>
        </div>
        <div className="rf-card" style={{ padding: 18, cursor: "pointer" }} onClick={() => setStatusFilter("New")}>
          <div style={{ fontSize: 12.5, color: C.sub }}>New / Unreviewed</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: newCount > 0 ? C.primary : C.text, marginTop: 6 }}>{newCount}</div>
        </div>
      </div>

      <TableCard
        columns={["User", "Rating", "Message", "Status", "Submitted", "Actions"]}
        rows={rows}
        empty="No feedback yet."
        controls={<>
          <SearchBox placeholder="Search user or message…" value={q} onChange={setQ} />
          <FilterChips items={["All", "New", "Reviewed"]} active={statusFilter} onSelect={setStatusFilter} />
          <FilterChips items={["All", "5", "4", "3", "2", "1"]} active={ratingFilter} onSelect={setRatingFilter} />
        </>}
        footer={`Showing ${rows.length} of ${feedback.length} feedback entries`}
        renderRow={(f) => (
          <tr key={f.id}>
            <td><div style={{ display: "flex", alignItems: "center", gap: 8 }}><Avatar name={f.user} size={26} /><div><div style={{ fontWeight: 600 }}>{f.user}</div><div style={{ fontSize: 11, color: C.sub }}>{f.mobile}</div></div></div></td>
            <td><Stars n={f.rating} /></td>
            <td style={{ maxWidth: 360, color: C.sub }}>{f.message}</td>
            <td><Chip text={f.status} tone={f.status === "New" ? [C.primary, C.primarySoft] : [C.success, C.successSoft]} /></td>
            <td style={{ color: C.sub }}>{f.created}</td>
            <td>{f.status === "New" && <button className="rf-btn ghost" style={{ padding: "6px 12px", fontSize: 12 }} onClick={() => onSetStatus(f.id, "Reviewed")}><CheckCircle2 size={13} /> Mark reviewed</button>}</td>
          </tr>
        )}
      />
    </div>
  );
}
