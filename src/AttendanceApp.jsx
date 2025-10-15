import React, { useEffect, useState } from "react";
import Shop from "./Shop.jsx";
import Admin from "./Admin.jsx";
import Today from "./today.jsx";

export default function AttendanceApp() {
  const [seating, setSeating] = useState([]); // 좌석 정보
  const [message, setMessage] = useState("");
  const [view, setView] = useState("seating"); // seating | shop | admin | today
  const [todayList, setTodayList] = useState([]);

  // 좌석 정보 불러오기
  async function loadSeating() {
    try {
      const r = await fetch("/api/seating");
      const data = await r.json();
      setSeating(data);
    } catch {
      setMessage("좌석 정보를 불러오지 못했습니다.");
    }
  }

  // 오늘 출석 정보 불러오기
  async function loadTodayAttendance() {
    try {
      const r = await fetch("/api/today-attendance");
      const data = await r.json();
      setTodayList(data);
    } catch {
      setMessage("오늘 출석 현황을 불러오지 못했습니다.");
    }
  }

  useEffect(() => {
    loadSeating();
  }, []);

  useEffect(() => {
    if (view === "today") loadTodayAttendance();
  }, [view]);

  // 출석 처리
  async function handleAttendance(seat) {
    setMessage("");
    if (!seat.student_id) return setMessage("빈 자리입니다.");
    try {
      const res = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: seat.student_id })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setMessage(`${seat.name} 출석 처리: ${data.status} (+${data.points}P)`);
      await loadSeating();
    } catch (e) {
      setMessage("출석 처리 실패");
    }
  }

  // 스킨별 배경색
  const skinMap = {
    desk_red: "bg-gradient-to-r from-red-400 to-red-700",
    desk_blue: "bg-gradient-to-r from-blue-400 to-blue-700",
    desk_green: "bg-gradient-to-r from-green-300 to-green-600",
    desk_yellow: "bg-gradient-to-r from-yellow-300 to-yellow-500",
    desk_gold: "bg-gradient-to-r from-yellow-300 via-yellow-400 to-yellow-600",
  };

  // 칭호별 색상
  const titleMap = {
    gold: "bg-clip-text text-transparent bg-gradient-to-r from-yellow-400 via-yellow-300 to-yellow-600 font-bold",
    red: "text-red-600 font-semibold",
    blue: "text-blue-600 italic",
    green: "text-green-600",
    gray: "text-gray-500",
    black: "",
  };

  // 좌석표 렌더링
  function renderGrid() {
    const items = [...seating];
    while (items.length < 36) items.push({ seat_index: items.length, student_id: null });

    return (
      <div className="p-4 bg-white rounded shadow">
        <div className="grid grid-cols-6 gap-y-2 gap-x-2">
          {items.map((s, idx) => {
            const col = idx % 6;
            const extraStyle = col % 2 === 1 ? "mr-1" : "ml-1";
            const skinClass = s?.skin ? (skinMap[s.skin] || "bg-white") : "bg-white";
            const titleClass = s?.titleColor ? (titleMap[s.titleColor] || titleMap.black) : titleMap.black;

            return (
              <div
                key={idx}
                onClick={() => handleAttendance(s)}
                className={`h-24 border rounded flex flex-col items-center justify-center cursor-pointer select-none ${skinClass} ${extraStyle}`}
              >
                <div className="text-sm font-semibold">{s.name ?? "빈자리"}</div>
                <div className="text-xs">{s.points ?? ""}P</div>
                {s.title && (
                  <div className={`text-[11px] mt-1 ${titleClass}`}>
                    [{s.title}]
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">출석 & 상점 시스템</h1>
      <div className="flex gap-2 mb-4">
        <button className={`px-3 py-1 rounded ${view==="seating"?"bg-blue-600 text-white":"bg-white"}`} onClick={()=>setView("seating")}>좌석표</button>
        <button className={`px-3 py-1 rounded ${view==="shop"?"bg-blue-600 text-white":"bg-white"}`} onClick={()=>setView("shop")}>상점</button>
        <button className={`px-3 py-1 rounded ${view==="admin"?"bg-blue-600 text-white":"bg-white"}`} onClick={()=>setView("admin")}>관리자</button>
        <button className={`px-3 py-1 rounded ${view==="today"?"bg-blue-600 text-white":"bg-white"}`} onClick={()=>setView("today")}>오늘 출석 현황</button>
      </div>
      {view === "seating" && (
        <>
          {renderGrid()}
          <div className="mt-3 text-sm text-gray-700">{message}</div>
          <div className="mt-4 text-xs text-gray-500">
            안내: 좌석을 눌러 출석 처리합니다. (8:25 이전 100P, 8:40 이전 50P, 이후 지각 10P, 결석 0P)
          </div>
        </>
      )}
      {view === "shop" && <Shop onDone={loadSeating} />}
      {view === "admin" && <Admin onUpdated={loadSeating} />}
      {view === "today" && <Today seating={seating} />}
    </div>
  );
}