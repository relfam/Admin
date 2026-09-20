import React, { useState } from "react";
import { Download } from "lucide-react";
import { C, inr } from "../theme";
import { Avatar, Chip, TableCard, SearchBox, FilterChips } from "../components/shared";

export default function EventsScreen({ events }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("All");
  const [host, setHost] = useState("All");
  const [creator, setCreator] = useState("All");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const hosts = [...new Set(events.map((e) => e.host))];
  const creators = [...new Set(events.map((e) => e.createdBy))];
  const rows = events.filter((e) => {
    const mq = !q || (e.id + " " + e.name + " " + e.host).toLowerCase().includes(q.toLowerCase());
    const mf = filter === "All" || e.status === filter || e.type === filter;
    const mh = host === "All" || e.host === host;
    const mc = creator === "All" || e.createdBy === creator;
    const md = (!from || e.iso >= from) && (!to || e.iso <= to);
    return mq && mf && mh && mc && md;
  });
  const exportCSV = () => {
    const head = ["Event ID", "Event", "Type", "Host", "Created By", "Host UID", "Place", "Date", "Gifts", "Total (INR)", "Status"];
    const lines = rows.map((e) => [e.id, '"' + e.name + '"', e.type, e.host, e.createdBy, e.hostUid, '"' + e.place + '"', e.date, e.gifts, e.total, e.status].join(","));
    const blob = new Blob([[head.join(","), ...lines].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "relfam-events-export.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };
  return (
    <div className="rf-fade">
      <TableCard
        columns={["Event ID", "Event", "Type", "Host", "Created By", "User ID", "Place", "Date", "Gifts", "Total Collection", "Status"]}
        rows={rows}
        empty="No events match this search/filter."
        controls={<>
          <SearchBox placeholder="Search event, host, ID…" width={220} value={q} onChange={setQ} />
          <select className="rf-input plain" style={{ width: 190, padding: "9px 12px" }} value={host} onChange={(e) => setHost(e.target.value)} title="Filter by user">
            <option value="All">All users</option>
            {hosts.map((h) => <option key={h} value={h}>{h}</option>)}
          </select>
          <select className="rf-input plain" style={{ width: 170, padding: "9px 12px" }} value={creator} onChange={(e) => setCreator(e.target.value)} title="Filter by who created the event">
            <option value="All">All creators</option>
            {creators.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: C.sub }}>
            <span>From</span>
            <input type="date" className="rf-input plain" style={{ width: 148, padding: "8px 10px" }} value={from} onChange={(e) => setFrom(e.target.value)} />
            <span>To</span>
            <input type="date" className="rf-input plain" style={{ width: 148, padding: "8px 10px" }} value={to} onChange={(e) => setTo(e.target.value)} />
            {(from || to) && <button className="rf-btn ghost" style={{ padding: "6px 10px", fontSize: 12 }} onClick={() => { setFrom(""); setTo(""); }}>Clear</button>}
          </div>
          <div style={{ marginLeft: "auto" }}>
            <button className="rf-btn ghost" onClick={exportCSV}><Download size={14} /> Export CSV ({rows.length})</button>
          </div>
          <div style={{ width: "100%" }}>
            <FilterChips items={["All", "Live", "Upcoming", "Completed"]} active={filter} onSelect={setFilter} />
          </div>
        </>}
        footer={`Showing ${rows.length} of ${events.length} events${host !== "All" ? " · user: " + host : ""}${creator !== "All" ? " · created by: " + creator : ""}`}
        renderRow={(e) => (
          <tr key={e.id}>
            <td style={{ fontFamily: "ui-monospace, monospace", fontSize: 12, color: C.primary, fontWeight: 600 }}>{e.id}</td>
            <td style={{ fontWeight: 600 }}>{e.name}</td>
            <td><Chip text={e.type} tone={[C.primary, C.primarySoft]} /></td>
            <td><div style={{ display: "flex", alignItems: "center", gap: 8 }}><Avatar name={e.host} size={26} />{e.host}</div></td>
            <td>{e.createdBy === "Not recorded" ? <span style={{ color: C.sub, fontSize: 12 }}>Not recorded</span> : <Chip text={e.createdBy} />}</td>
            <td style={{ fontFamily: "ui-monospace, monospace", fontSize: 12, color: C.primary, fontWeight: 600 }}>{e.hostUid}</td>
            <td style={{ color: C.sub }}>{e.place}</td>
            <td style={{ color: C.sub }}>{e.date}</td>
            <td style={{ fontWeight: 600 }}>{e.gifts}</td>
            <td style={{ fontWeight: 700, color: C.gold }}>{inr(e.total)}</td>
            <td><Chip text={e.status} /></td>
          </tr>
        )}
      />
    </div>
  );
}
