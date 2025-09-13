// src/Shop.jsx
import React, { useEffect, useState } from "react";

export default function Shop({ onDone }) {
  const [name, setName] = useState("");
  const [pw, setPw] = useState("");
  const [user, setUser] = useState(null);
  const [items, setItems] = useState([]);
  const [message, setMessage] = useState("");

  useEffect(() => { fetchItems(); }, []);

  async function fetchItems() {
    try {
      const r = await fetch("/api/items");
      const data = await r.json();
      setItems(data);
    } catch {
      setMessage("아이템 로드 실패");
    }
  }

  // 로그인: 이름+pw로 students 목록에서 찾음
  async function login() {
    setMessage("");
    try {
      const r = await fetch("/api/students");
      const students = await r.json();
      const found = students.find(s => s.name === name && s.password === pw);
      if (!found) return setMessage("로그인 실패");
      setUser(found);
      setMessage(`${found.name}님 로그인됨`);
    } catch {
      setMessage("로그인 실패");
    }
  }

  async function buy(item) {
    setMessage("");
    if (!user) return setMessage("로그인 먼저");
    try {
      const r = await fetch("/api/buy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: user.id, itemKey: item.key_name })
      });
      const data = await r.json();
      if (data.success) {
        setMessage(data.message);
        // refresh user info
        const r2 = await fetch(`/api/students/${user.id}`);
        const updated = await r2.json();
        setUser(updated);
        // notify parent to reload seating (skin/title may have changed)
        if (onDone) onDone();
      } else {
        setMessage(data.message || "구매 실패");
      }
    } catch {
      setMessage("구매 실패");
    }
  }

  return (
    <div className="p-4 bg-white rounded shadow">
      <h2 className="font-semibold mb-2">상점 로그인</h2>
      {!user ? (
        <div className="flex gap-2 items-center">
          <input className="border p-1" placeholder="이름" value={name} onChange={e=>setName(e.target.value)} />
          <input className="border p-1" placeholder="비밀번호" value={pw} onChange={e=>setPw(e.target.value)} />
          <button className="px-3 py-1 bg-green-600 text-white rounded" onClick={login}>로그인</button>
        </div>
      ) : (
        <div className="mb-2">
          <div>{user.name}님 — 보유 포인트: <span className="font-semibold">{user.points}P</span></div>
          <button className="mt-2 px-2 py-1 bg-gray-200 rounded" onClick={()=>setUser(null)}>로그아웃</button>
        </div>
      )}

      <div className="mt-4">
        <h3 className="font-semibold">아이템</h3>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {items.map(it => (
            <div key={it.id} className="p-2 border rounded bg-white">
              <div className="font-medium">{it.name}</div>
              <div className="text-xs">가격: {it.cost}P</div>
              <div className="text-xs">종류: {it.type}</div>
              <button className="mt-2 px-2 py-1 bg-blue-600 text-white rounded" onClick={()=>buy(it)}>구매</button>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 text-sm text-gray-700">{message}</div>
    </div>
  );
}
