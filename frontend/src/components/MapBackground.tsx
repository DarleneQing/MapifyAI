import { memo } from "react";

interface MapBackgroundProps {
  lat: number;
  lng: number;
}

const MapBackground = memo(({ lat, lng }: MapBackgroundProps) => {
  return (
    <div className="fixed inset-0 z-0">
      {/* Warm gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-background/30 via-background/10 to-background/70 z-10" />
      
      {/* Warm toned map background */}
      <div 
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse at 40% 40%, 
              hsla(36, 25%, 82%, 0.6) 0%, 
              hsla(30, 18%, 70%, 0.4) 40%, 
              hsla(25, 15%, 55%, 0.6) 100%
            ),
            linear-gradient(155deg, 
              hsl(36, 30%, 85%) 0%, 
              hsl(30, 20%, 75%) 30%, 
              hsl(25, 15%, 65%) 60%, 
              hsl(20, 12%, 55%) 100%
            )
          `,
        }}
      />

      {/* Subtle grid lines */}
      <div className="absolute inset-0 opacity-[0.04] z-[1]"
        style={{
          backgroundImage: `
            linear-gradient(hsla(30,10%,40%,0.3) 1px, transparent 1px),
            linear-gradient(90deg, hsla(30,10%,40%,0.3) 1px, transparent 1px)
          `,
          backgroundSize: "80px 80px",
        }}
      />

      {/* Center location indicator */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[2]">
        <div className="w-3 h-3 rounded-full bg-primary/80" />
        <div className="absolute -top-4 -left-4 w-11 h-11 rounded-full border border-primary/20 animate-ping" style={{ animationDuration: "3s" }} />
      </div>
    </div>
  );
});

MapBackground.displayName = "MapBackground";
export default MapBackground;
