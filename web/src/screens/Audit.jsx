import React, { useState } from "react";
import { C } from "../theme";
import { Avatar, Chip, TableCard, SearchBox, FilterChips } from "../components/shared";

export default function AuditScreen({ logs }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("All");
  const rows = logs.filter((l) => {
    const mq = !q || (l.admin + " " + l.action + " " + l.ip + " " + l.module).toLowerCase().includes(q.toLowerCase());
    const mf = filter === "All" || l.module === filter || (filter === "Today" && l.time.startsWith("Today"));
    return mq && mf;
  });
  const modules = [...new Set(logs.map((l) => l.module))].filter(Boolean);
  return (
    <div className="rf-fade">
      <TableCard
        columns={["Admin", "Action", "Module", "IP Address", "Device", "Timestamp"]}
        rows={rows}
        empty="No audit log entries yet — actions taken through this dashboard will show up here."
        controls={<>
          <SearchBox placeholder="Search actions, IP, module…" value={q} onChange={setQ} />
          <FilterChips items={["All", "Today", ...modules]} active={filter} onSelect={setFilter} />
        </>}
        footer={`Showing ${rows.length} of ${logs.length} log entries`}
        renderRow={(l, i) => (
          <tr key={i}>
            <td><div style={{ display: "flex", alignItems: "center", gap: 8 }}><Avatar name={l.admin} size={26} /><span style={{ fontWeight: 600 }}>{l.admin}</span></div></td>
            <td>{l.action}</td>
            <td><Chip text={l.module} tone={[C.primary, C.primarySoft]} /></td>
            <td style={{ fontFamily: "ui-monospace, monospace", fontSize: 12, color: C.sub }}>{l.ip}</td>
            <td style={{ color: C.sub }}>{l.device}</td>
            <td style={{ color: C.sub }}>{l.time}</td>
          </tr>
        )}
      />
    </div>
  );
}
