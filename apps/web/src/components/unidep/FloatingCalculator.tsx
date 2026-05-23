"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Operator = "+" | "-" | "*" | "/" | null;
type Position = { x: number; y: number };

const VIEWPORT_MARGIN = 10;
const DEFAULT_TOP_OFFSET = 176;
const DEFAULT_RIGHT_OFFSET = 58;
const DEFAULT_RAIL_WIDTH = 74;

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

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName);
}

export default function FloatingCalculator() {
  const rootRef = useRef<HTMLElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [display, setDisplay] = useState("0");
  const [storedValue, setStoredValue] = useState<number | null>(null);
  const [operator, setOperator] = useState<Operator>(null);
  const [waitingForNextValue, setWaitingForNextValue] = useState(false);
  const [position, setPosition] = useState<Position>({ x: 16, y: 16 });

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

  const getDefaultPosition = useCallback(() => {
    const rect = rootRef.current?.getBoundingClientRect();
    const width = rect?.width ?? DEFAULT_RAIL_WIDTH;

    return clampPosition({
      x: window.innerWidth - width - DEFAULT_RIGHT_OFFSET,
      y: DEFAULT_TOP_OFFSET,
    });
  }, [clampPosition]);

  useEffect(() => {
    const raf = window.requestAnimationFrame(() => setPosition(getDefaultPosition()));

    return () => window.cancelAnimationFrame(raf);
  }, [getDefaultPosition]);

  useEffect(() => {
    const raf = window.requestAnimationFrame(() => {
      setPosition(getDefaultPosition());
    });

    return () => window.cancelAnimationFrame(raf);
  }, [getDefaultPosition, isOpen]);

  useEffect(() => {
    const handleResize = () => {
      setPosition(getDefaultPosition());
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [getDefaultPosition]);

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

  const inputBackspace = () => {
    if (waitingForNextValue || display === "Error") {
      setDisplay("0");
      setWaitingForNextValue(false);
      return;
    }

    setDisplay((value) => {
      const next = value.slice(0, -1);
      return next && next !== "-" ? next : "0";
    });
  };

  const toggleSign = () => {
    if (display === "0" || display === "Error") return;
    setDisplay((value) => (value.startsWith("-") ? value.slice(1) : `-${value}`));
  };

  const applyPercent = () => {
    if (!Number.isFinite(currentValue)) {
      clear();
      return;
    }

    const percentValue =
      storedValue !== null && operator
        ? (storedValue * currentValue) / 100
        : currentValue / 100;

    setDisplay(formatDisplay(percentValue));
    setWaitingForNextValue(false);
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

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;

      const key = event.key;
      if (/^\d$/.test(key)) {
        event.preventDefault();
        inputDigit(key);
        return;
      }

      if (key === "." || key === ",") {
        event.preventDefault();
        inputDecimal();
        return;
      }

      if (key === "+" || key === "-" || key === "*" || key === "/") {
        event.preventDefault();
        chooseOperator(key as Exclude<Operator, null>);
        return;
      }

      if (key.toLowerCase() === "x") {
        event.preventDefault();
        chooseOperator("*");
        return;
      }

      if (key === "%") {
        event.preventDefault();
        applyPercent();
        return;
      }

      if (key === "Enter" || key === "=") {
        event.preventDefault();
        finishCalculation();
        return;
      }

      if (key === "Backspace") {
        event.preventDefault();
        inputBackspace();
        return;
      }

      if (key === "Escape") {
        event.preventDefault();
        clear();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    applyPercent,
    chooseOperator,
    currentValue,
    finishCalculation,
    inputBackspace,
    inputDecimal,
    inputDigit,
    isOpen,
  ]);

  return (
    <aside
      ref={rootRef}
      className={[
        "ui-floating-calculator",
        isOpen ? "ui-floating-calculator--open" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label="Calculadora flotante"
      style={{
        transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
      }}
    >
      {isOpen ? (
        <div className="ui-floating-calculator__panel">
          <div className="ui-floating-calculator__head">
            <div
              className="ui-floating-calculator__drag-handle"
            >
              <div className="ui-floating-calculator__eyebrow">Cotizador</div>
              <div className="ui-floating-calculator__title">Calculadora</div>
            </div>
            <div className="ui-floating-calculator__head-actions">
              <button
                type="button"
                className="ui-floating-calculator__close"
                onClick={() => setIsOpen(false)}
                aria-label="Contraer calculadora"
              >
                <img
                  src="/branding/floating-calculator.png"
                  alt=""
                  aria-hidden="true"
                  className="ui-floating-calculator__collapse-image"
                  draggable={false}
                />
                <span className="sr-only">Contraer</span>
              </button>
            </div>
          </div>

          <output className="ui-floating-calculator__display" aria-live="polite">
            {display}
          </output>

          <div className="ui-floating-calculator__keys">
            <button type="button" onClick={clear}>C</button>
            <button type="button" onClick={toggleSign}>+/-</button>
            <button type="button" onClick={applyPercent}>%</button>
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

      {!isOpen ? (
        <button
          type="button"
          className="ui-floating-calculator__rail"
          onClick={() => setIsOpen(true)}
          aria-expanded={isOpen}
          title="Abrir calculadora"
        >
          <img
            src="/branding/floating-calculator.png"
            alt=""
            aria-hidden="true"
            className="ui-floating-calculator__rail-image"
            draggable={false}
          />
          <span className="sr-only">Calculadora</span>
        </button>
      ) : null}
    </aside>
  );
}
