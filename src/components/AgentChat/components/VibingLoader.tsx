import React, { useEffect, useRef, useState } from "react";

const THINKING_WORDS = ["Working", "Computing", "Thinking", "Analyzing", "Processing"];

export function VibingLoader({ text }: { text?: string }): React.ReactElement {
  const [word, setWord] = useState(THINKING_WORDS[0]);
  const [dots, setDots] = useState(0);
  const [fade, setFade] = useState<"in" | "out">("in");
  const stateRef = useRef({ dots: 0, wordIdx: 0 });

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let running = true;

    const tick = () => {
      if (!running) return;
      const s = stateRef.current;

      if (s.dots < 3) {
        s.dots += 1;
        setDots(s.dots);
        timer = setTimeout(tick, 420);
      } else {
        setFade("out");
        timer = setTimeout(() => {
          if (!running) return;
          s.wordIdx = (s.wordIdx + 1) % THINKING_WORDS.length;
          s.dots = 0;
          setWord(THINKING_WORDS[s.wordIdx]);
          setDots(0);
          setFade("in");
          timer = setTimeout(tick, 420);
        }, 300);
      }
    };

    timer = setTimeout(tick, 420);
    return () => {
      running = false;
      clearTimeout(timer);
    };
  }, []);

  const displayWord = text !== undefined ? text : word;

  return (
    <div className="thinking">
      {displayWord && <span className={`thinking__word ${fade === "out" ? "out" : ""}`}>{displayWord}</span>}
      <span className="thinking__dots">
        {[0, 1, 2].map((i) => (
          <span key={i} className={`thinking__dot ${dots > i ? "on" : ""}`}>
            .
          </span>
        ))}
      </span>
    </div>
  );
}
