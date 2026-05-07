"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";

type Operator = "+" | "-" | "*" | "/" | null;
type Position = { x: number; y: number };
type DragState = {
  pointerId: number;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
  moved: boolean;
};

const POSITION_STORAGE_KEY = "recalc:floating-calculator-position";
const VIEWPORT_MARGIN = 10;

function formatDisplay(value: number) {
  if (!Number.isFinite(value)) return "Error";
  return new Intl.NumberFormat("es-MX", {
    maximumFractionDigits: 8,
  }).format(value);
}

function calculate(left: number, right: number, operator: Operator) {
  if (operator === "+") return left + right;
  if (operator === "-") return left - right;
  if (operator === "*") return left * right;
  if (operator === "/") return right === 0 ? Number.NaN : left / right;
  return right;
}

export default function FloatingCalculator() {
  const rootRef = useRef<HTMLElement | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const justDraggedRef = useRef(false);
  const [isOpen, setIsOpen] = useState(false);
  const [display, setDisplay] = useState("0");
  const [storedValue, setStoredValue] = useState<number | null>(null);
  const [operator, setOperator] = useState<Operator>(null);
  const [waitingForNextValue, setWaitingForNextValue] = useState(false);
  const [position, setPosition] = useState<Position>({ x: 16, y: 16 });
  const [isDragging, setIsDragging] = useState(false);

  const currentValue = Number(display.replace(/,/g, ""));

  const clampPosition = useCallback((nextPosition: Position) => {
    if (typeof window === "undefined") return nextPosition;

    const rect = rootRef.current?.getBoundingClientRect();
    const width = rect?.width ?? 120;
    const height = rect?.height ?? 54;
    const maxX = Math.max(VIEWPORT_MARGIN, window.innerWidth - width - VIEWPORT_MARGIN);
    const maxY = Math.max(VIEWPORT_MARGIN, window.innerHeight - height - VIEWPORT_MARGIN);

    return {
      x: Math.min(Math.max(nextPosition.x, VIEWPORT_MARGIN), maxX),
      y: Math.min(Math.max(nextPosition.y, VIEWPORT_MARGIN), maxY),
    };
  }, []);

  const persistPosition = useCallback((nextPosition: Position) => {
    window.localStorage.setItem(POSITION_STORAGE_KEY, JSON.stringify(nextPosition));
  }, []);

  useEffect(() => {
    const raf = window.requestAnimationFrame(() => {
      const storedPosition = window.localStorage.getItem(POSITION_STORAGE_KEY);
      if (storedPosition) {
        try {
          const parsed = JSON.parse(storedPosition) as Partial<Position>;
          if (typeof parsed.x === "number" && typeof parsed.y === "number") {
            setPosition(clampPosition({ x: parsed.x, y: parsed.y }));
            return;
          }
        } catch {
          window.localStorage.removeItem(POSITION_STORAGE_KEY);
        }
      }

      setPosition(clampPosition({
        x: 16,
        y: window.innerHeight - 68,
      }));
    });

    return () => window.cancelAnimationFrame(raf);
  }, [clampPosition]);

  useEffect(() => {
    const raf = window.requestAnimationFrame(() => {
      setPosition((current) => {
        const next = clampPosition(current);
        persistPosition(next);
        return next;
      });
    });

    return () => window.cancelAnimationFrame(raf);
  }, [clampPosition, isOpen, persistPosition]);

  useEffect(() => {
    const handleResize = () => {
      setPosition((current) => {
        const next = clampPosition(current);
        persistPosition(next);
        return next;
      });
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [clampPosition, persistPosition]);

  const clear = () => {
    setDisplay("0");
    setStoredValue(null);
    setOperator(null);
    setWaitingForNextValue(false);
  };

  const inputDigit = (digit: string) => {
    if (display === "Error") {
      setDisplay(digit);
      setWaitingForNextValue(false);
      return;
    }

    if (waitingForNextValue) {
      setDisplay(digit);
      setWaitingForNextValue(false);
      return;
    }

    setDisplay((value) => (value === "0" ? digit : `${value}${digit}`));
  };

  const inputDecimal = () => {
    if (waitingForNextValue || display === "Error") {
      setDisplay("0.");
      setWaitingForNextValue(false);
      return;
    }
    if (!display.includes(".")) setDisplay((value) => `${value}.`);
  };

  const toggleSign = () => {
    if (display === "0" || display === "Error") return;
    setDisplay((value) => (value.startsWith("-") ? value.slice(1) : `-${value}`));
  };

  const chooseOperator = (nextOperator: Exclude<Operator, null>) => {
    if (!Number.isFinite(currentValue)) {
      clear();
      return;
    }

    if (storedValue === null) {
      setStoredValue(currentValue);
    } else if (operator) {
      const result = calculate(storedValue, currentValue, operator);
      setDisplay(formatDisplay(result));
      setStoredValue(result);
    }

    setOperator(nextOperator);
    setWaitingForNextValue(true);
  };

  const finishCalculation = () => {
    if (storedValue === null || !operator) return;
    const result = calculate(storedValue, currentValue, operator);
    setDisplay(formatDisplay(result));
    setStoredValue(null);
    setOperator(null);
    setWaitingForNextValue(true);
  };

  const beginDrag = (event: PointerEvent<HTMLElement>) => {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: position.x,
      originY: position.y,
      moved: false,
    };
    setIsDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveDrag = (event: PointerEvent<HTMLElement>) => {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - dragState.startX;
    const deltaY = event.clientY - dragState.startY;
    if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
      dragState.moved = true;
    }

    setPosition(clampPosition({
      x: dragState.originX + deltaX,
      y: dragState.originY + deltaY,
    }));
  };

  const endDrag = (event: PointerEvent<HTMLElement>) => {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;

    const nextPosition = clampPosition({
      x: dragState.originX + event.clientX - dragState.startX,
      y: dragState.originY + event.clientY - dragState.startY,
    });
    setPosition(nextPosition);
    persistPosition(nextPosition);
    justDraggedRef.current = dragState.moved;
    dragStateRef.current = null;
    setIsDragging(false);

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    window.setTimeout(() => {
      justDraggedRef.current = false;
    }, 0);
  };

  const resetPosition = () => {
    const nextPosition = clampPosition({
      x: 16,
      y: window.innerHeight - 68,
    });
    setPosition(nextPosition);
    persistPosition(nextPosition);
  };

  return (
    <aside
      ref={rootRef}
      className={[
        "ui-floating-calculator",
        isOpen ? "ui-floating-calculator--open" : "",
        isDragging ? "ui-floating-calculator--dragging" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label="Calculadora flotante"
      style={{
        transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
      }}
      onPointerMove={moveDrag}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      {isOpen ? (
        <div className="ui-floating-calculator__panel">
          <div className="ui-floating-calculator__head">
            <div
              className="ui-floating-calculator__drag-handle"
              onPointerDown={beginDrag}
              title="Arrastrar calculadora"
            >
              <div className="ui-floating-calculator__eyebrow">Cotizador</div>
              <div className="ui-floating-calculator__title">Calculadora</div>
            </div>
            <div className="ui-floating-calculator__head-actions">
              <button
                type="button"
                className="ui-floating-calculator__close"
                onClick={resetPosition}
                aria-label="Restaurar posición de la calculadora"
              >
                Restaurar
              </button>
              <button
                type="button"
                className="ui-floating-calculator__close"
                onClick={() => setIsOpen(false)}
                aria-label="Contraer calculadora"
              >
                Contraer
              </button>
            </div>
          </div>

          <output className="ui-floating-calculator__display" aria-live="polite">
            {display}
          </output>

          <div className="ui-floating-calculator__keys">
            <button type="button" onClick={clear}>C</button>
            <button type="button" onClick={toggleSign}>+/-</button>
            <button type="button" onClick={() => setDisplay(formatDisplay(currentValue / 100))}>%</button>
            <button type="button" className="is-operator" onClick={() => chooseOperator("/")}>÷</button>
            {["7", "8", "9"].map((digit) => (
              <button key={digit} type="button" onClick={() => inputDigit(digit)}>{digit}</button>
            ))}
            <button type="button" className="is-operator" onClick={() => chooseOperator("*")}>×</button>
            {["4", "5", "6"].map((digit) => (
              <button key={digit} type="button" onClick={() => inputDigit(digit)}>{digit}</button>
            ))}
            <button type="button" className="is-operator" onClick={() => chooseOperator("-")}>-</button>
            {["1", "2", "3"].map((digit) => (
              <button key={digit} type="button" onClick={() => inputDigit(digit)}>{digit}</button>
            ))}
            <button type="button" className="is-operator" onClick={() => chooseOperator("+")}>+</button>
            <button type="button" className="is-wide" onClick={() => inputDigit("0")}>0</button>
            <button type="button" onClick={inputDecimal}>.</button>
            <button type="button" className="is-equals" onClick={finishCalculation}>=</button>
          </div>
        </div>
      ) : null}

      <button
        type="button"
        className="ui-floating-calculator__rail"
        onPointerDown={beginDrag}
        onClick={() => {
          if (justDraggedRef.current) return;
          setIsOpen((value) => !value);
        }}
        aria-expanded={isOpen}
        title="Abrir o arrastrar calculadora"
      >
        Calculadora
      </button>
    </aside>
  );
}
