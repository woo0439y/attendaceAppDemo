import React, { useEffect, useState } from "react";

export default function Today({ seating }) {
  const [todayList, setTodayList] = useState([]);

  // 오늘 출석 정보 불러오기
  async function loadTodayAttendance() {
    try {
      const r = await fetch("/api/today-attendance");
      const data = await r.json();
      setTodayList(data);
    } catch {
      // 에러 처리 필요시 추가
    }
  }

  useEffect(() => {
    loadTodayAttendance();
  }, []);

  // 좌석표 생성 및 출석 반영
  const grid = Array(36).fill(null);
  todayList.forEach(s => {
    if (typeof s.seat_index === "number") grid[s.seat_index] = s;
  });
  seating.forEach(seat => {
    if (!grid[seat.seat_index]) grid[seat.seat_index] = seat;
  });

  // 스킨/칭호 스타일 (AttendanceApp에서 복사)
  const skinMap = {
    desk_red: "bg-gradient-to-r from-red-400 to-red-700",
    desk_blue: "bg-gradient-to-r from-blue-400 to-blue-700",
    desk_green: "bg-gradient-to-r from-green-300 to-green-600",
    desk_yellow: "bg-gradient-to-r from-yellow-300 to-yellow-500",
    desk_gold: "bg-gradient-to-r from-yellow-300 via-yellow-400 to-yellow-600",
  };
  const titleMap = {
    gold: "bg-clip-text text-transparent bg-gradient-to-r from-yellow-400 via-yellow-300 to-yellow-600 font-bold",
    red: "text-red-600 font-semibold",
    blue: "text-blue-600 italic",
    green: "text-green-600",
    gray: "text-gray-500",
    black: "",
  };

  return (
    <div className="p-4 bg-white rounded shadow">
      <h2 className="text-lg font-bold mb-2">오늘 출석 현황 (좌석표)</h2>
      <div className="grid grid-cols-6 gap-y-2 gap-x-2">
        {grid.map((s, idx) => {
          const skinClass = s?.skin ? (skinMap[s.skin] || "bg-white") : "bg-white";
          const titleClass = s?.titleColor ? (titleMap[s.titleColor] || titleMap.black) : titleMap.black;
          if (!s.name) {
            return (
              <div key={idx} className="h-24 border rounded flex flex-col items-center justify-center bg-gray-100 text-gray-400">
                <div className="text-sm">빈자리</div>
              </div>
            );
          }
          if (!s.time) {
            return (
              <div key={idx} className="h-24 border rounded flex flex-col items-center justify-center bg-gray-100 text-gray-400">
                <div className="text-sm">{s.name}</div>
                <div className="text-xs mt-1">미출석</div>
              </div>
            );
          }
          return (
            <div key={idx} className={`h-24 border rounded flex flex-col items-center justify-center ${skinClass}`}>
              <div className="text-sm font-semibold">{s.name}</div>
              <div className="text-xs">{s.time}</div>
              <div className="text-xs">{s.status}</div>
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