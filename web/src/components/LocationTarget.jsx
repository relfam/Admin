import React, { useMemo } from "react";
import { CheckCircle2 } from "lucide-react";
import { C, INDIAN_STATES, STATE_DISTRICTS } from "../theme";
import { Field } from "./shared";

const gridStyle = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, maxHeight: 190, overflowY: "auto", border: `1px solid ${C.border}`, borderRadius: 12, padding: 10 };

const toggleBtnStyle = (on) => ({
  display: "flex", alignItems: "center", gap: 6, padding: "7px 10px", borderRadius: 9, cursor: "pointer",
  fontSize: 12, fontWeight: 600, textAlign: "left", border: "1px solid " + (on ? C.primary : C.border),
  background: on ? C.primarySoft : "#fff", color: on ? C.primary : C.sub,
});

// Multi-select state + cascading multi-select district (options narrow to the union of districts
// across whatever states are currently checked) — used by both the Ads and Notifications
// targeting forms so "reaches these users" means the same thing in both places. Empty arrays mean
// no restriction on that dimension ("All states" / no district filter).
export default function LocationTargetFields({ states, districts, onStatesChange, onDistrictsChange }) {
  const availableDistricts = useMemo(() => {
    const set = new Set();
    states.forEach((s) => (STATE_DISTRICTS[s] || []).forEach((d) => set.add(d)));
    return [...set].sort();
  }, [states]);

  const toggleState = (s) => {
    const next = states.includes(s) ? states.filter((x) => x !== s) : [...states, s];
    onStatesChange(next);
    const validDistricts = new Set();
    next.forEach((st) => (STATE_DISTRICTS[st] || []).forEach((d) => validDistricts.add(d)));
    onDistrictsChange(districts.filter((d) => validDistricts.has(d)));
  };

  const toggleDistrict = (d) => {
    onDistrictsChange(districts.includes(d) ? districts.filter((x) => x !== d) : [...districts, d]);
  };

  return (
    <>
      <Field label={`Target states (${states.length ? states.length + " selected" : "All states"})`}>
        <div style={gridStyle}>
          {INDIAN_STATES.map((s) => {
            const on = states.includes(s);
            return (
              <button key={s} type="button" onClick={() => toggleState(s)} style={toggleBtnStyle(on)}>
                {on && <CheckCircle2 size={13} style={{ flexShrink: 0 }} />}
                <span>{s}</span>
              </button>
            );
          })}
        </div>
        {states.length > 0 && (
          <button type="button" className="rf-btn ghost" style={{ padding: "5px 10px", fontSize: 11.5, marginTop: 8 }} onClick={() => { onStatesChange([]); onDistrictsChange([]); }}>Clear states</button>
        )}
      </Field>
      {states.length > 0 && (
        <Field label={`Target districts (${districts.length ? districts.length + " selected" : "all of the selected state(s)"})`}>
          <div style={gridStyle}>
            {availableDistricts.map((d) => {
              const on = districts.includes(d);
              return (
                <button key={d} type="button" onClick={() => toggleDistrict(d)} style={toggleBtnStyle(on)}>
                  {on && <CheckCircle2 size={13} style={{ flexShrink: 0 }} />}
                  <span>{d}</span>
                </button>
              );
            })}
          </div>
          {districts.length > 0 && (
            <button type="button" className="rf-btn ghost" style={{ padding: "5px 10px", fontSize: 11.5, marginTop: 8 }} onClick={() => onDistrictsChange([])}>Clear districts</button>
          )}
        </Field>
      )}
    </>
  );
}
