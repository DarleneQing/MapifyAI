import { useState } from "react";

const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOURS = ["8a", "9a", "10a", "11a", "12p", "1p", "2p", "3p", "4p"];

interface Props {
  data: Record<string, number[]>;
}

export default function PopularTimesChart({ data }: Props) {
  const today = DAYS[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1];
  const [selectedDay, setSelectedDay] = useState(today);
  const values = data[selectedDay] || [];
  const max = Math.max(...values, 1);

  return (
    <div>
      {/* Day selector */}
      <div className="flex gap-1 mb-3 overflow-x-auto no-scrollbar">
        {DAYS.map((day, i) => (
          data[day] ? (
            <button
              key={day}
              onClick={() => setSelectedDay(day)}
              className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-colors ${
                selectedDay === day
                  ? "bg-foreground text-background"
                  : "bg-muted/60 text-muted-foreground"
              }`}
            >
              {DAY_LABELS[i]}
            </button>
          ) : null
        ))}
      </div>

      {/* Bar chart */}
      {values.length > 0 && (
        <div className="flex items-end gap-1 h-20">
          {values.map((val, i) => {
            const height = (val / max) * 100;
            const currentHour = new Date().getHours();
            const barHour = 8 + i;
            const isCurrent = selectedDay === today && barHour === currentHour;
            
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className={`w-full rounded-t-sm transition-all duration-300 ${
                    isCurrent ? "bg-primary" : val > 70 ? "bg-destructive/60" : val > 40 ? "bg-amber-400/60" : "bg-muted"
                  }`}
                  style={{ height: `${Math.max(height, 4)}%` }}
                />
                <span className="text-[8px] text-muted-foreground">{HOURS[i] || ""}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
