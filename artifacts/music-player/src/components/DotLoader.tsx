// src/components/DotLoader.tsx
export function DotLoader() {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black">
      <div className="flex items-center gap-2">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="inline-block rounded-full bg-white"
            style={{
              width: "10px",
              height: "10px",
              animation: `dotPulse 1.5s ease-in-out ${i * 0.25}s infinite`,
            }}
          />
        ))}
      </div>
      <style>{`
        @keyframes dotPulse {
          0%, 100% { transform: scale(1); opacity: 0.6; }
          50%       { transform: scale(1.5); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
