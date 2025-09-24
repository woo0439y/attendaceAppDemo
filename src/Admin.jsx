// src/Admin.jsx
import React, { useEffect, useState } from "react";

const ADMIN_PW = "adminpass";

export default function Admin({ onUpdated }) {
  const [seating, setSeating] = useState([]);
  const [adminPw, setAdminPw] = useState("");
  const [logged, setLogged] = useState(false);
  const [dragFrom, setDragFrom] = useState(null);
  const [message, setMessage] = useState("");
  const [items, setItems] = useState([]);
  const [newItem, setNewItem] = useState({ key_name: "", name: "", cost: 0, type: "skin" });

  useEffect(() => { fetchSeating(); fetchItems(); }, []);

  async function fetchSeating() {
    try {
      const r = await fetch("/api/seating");
      const data = await r.json();
      setSeating(data);
    } catch {
      setMessage("좌석 로드 실패");
    }
  }

  async function fetchItems() {
    try {
      const r = await fetch("/api/items");
      const data = await r.json();
      setItems(data);
    } catch {}
  }

  function tryLogin() {
    if (adminPw === ADMIN_PW) {
      setLogged(true);
      setMessage("관리자 로그인됨");
    } else setMessage("비밀번호 틀림");
  }

  function onDragStart(idx) { if (!logged) return; setDragFrom(idx); }
  function onDrop(idx) {
    if (!logged || dragFrom === null) return;
    const copy = [...seating];
    const tmp = copy[dragFrom];
    copy[dragFrom] = copy[idx];
    copy[idx] = tmp;
    setSeating(copy);
    setDragFrom(null);
  }
  function onAllowDrop(e) { e.preventDefault(); }

  async function saveSeating() {
    try {
      const payload = seating.map(s => ({ seat_index: s.seat_index, student_id: s.student_id }));
      const r = await fetch("/api/seating", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminPw, seating: payload })
      });
      const data = await r.json();
      if (data.success) {
        setMessage("저장 완료");
        if (onUpdated) onUpdated();
      } else setMessage(data.message || "저장 실패");
    } catch {
      setMessage("저장 실패");
    }
  }

  async function exportCSV() {
    const now = new Date();
    const y = now.getFullYear();
    const m = (now.getMonth()+1).toString().padStart(2,"0");
    const url = `/api/export/${y}/${m}`;
    window.open(url, "_blank");
  }

  async function addItem() {
    try {
      const r = await fetch("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adminPw, ...newItem })
      });
      const data = await r.json();
      if (data.success) {
        setMessage("아이템 추가 완료");
        fetchItems();
      } else setMessage(data.message || "추가 실패");
    } catch {
      setMessage("추가 실패");
    }
  }

  return (
    <div className="p-4 bg-white rounded shadow">
      <h2 className="font-semibold mb-2">관리자 패널</h2>

      {!logged ? (
        <div className="flex gap-2 items-center">
          <input className="border p-1" placeholder="관리자 비밀번호" type="password" value={adminPw} onChange={e=>setAdminPw(e.target.value)} />
          <button className="px-3 py-1 bg-indigo-600 text-white rounded" onClick={tryLogin}>로그인</button>
        </div>
      ) : (
        <div className="mb-3 text-green-700">관리자 모드 활성화</div>
      )}

      <div className="mt-3">
        <h3 className="font-medium">좌석 배치 (드래그하여 교체)</h3>
        <div className="grid grid-cols-6 gap-2 mt-2">
          {seating.map((s, idx) => (
            <div
              key={idx}
              draggable={logged}
              onDragStart={() => onDragStart(idx)}
              onDragOver={onAllowDrop}
              onDrop={() => onDrop(idx)}
              className="h-20 border rounded flex flex-col items-center justify-center bg-white cursor-move"
            >
              <div className="text-sm">{s.name ?? "빈자리"}</div>
              <div className="text-xs">{s.points ?? ""}P</div>
              <div className="text-[10px] text-gray-500">idx:{s.seat_index}</div>
            </div>
          ))}
        </div>

        <div className="mt-3 flex gap-2">
          <button className="px-3 py-1 bg-green-600 text-white rounded" onClick={saveSeating}>저장</button>
          <button className="px-3 py-1 bg-blue-600 text-white rounded" onClick={exportCSV}>이번달 CSV 내보내기</button>
        </div>
      </div>

      <div className="mt-4">
        <h3 className="font-medium">아이템 관리</h3>
        <div className="flex gap-2 mt-2">
          <input className="border p-1" placeholder="key_name" value={newItem.key_name} onChange={e=>setNewItem({...newItem, key_name: e.target.value})} />
          <input className="border p-1" placeholder="이름" value={newItem.name} onChange={e=>setNewItem({...newItem, name: e.target.value})} />
          <input className="border p-1 w-20" placeholder="cost" type="number" value={newItem.cost} onChange={e=>setNewItem({...newItem, cost: Number(e.target.value)})} />
          <select className="border p-1" value={newItem.type} onChange={e=>setNewItem({...newItem, type: e.target.value})}>
            <option value="skin">skin</option>
            <option value="title">title</option>
          </select>
          <button className="px-3 py-1 bg-gray-700 text-white rounded" onClick={addItem}>추가</button>
        </div>

        <div className="mt-2 grid grid-cols-2 gap-2">
          {items.map(it => (
            <div key={it.id} className="p-2 border rounded">
              <div className="font-medium">{it.name}</div>
              <div className="text-xs">key: {it.key_name}</div>
              <div className="text-xs">가격: {it.cost}</div>
              <div className="text-xs">종류: {it.type}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 text-sm text-gray-700">{message}</div>
    </div>
  );
}
