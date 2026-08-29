"use client";

import type { PetMood } from "@/lib/companion/companion-core";

type CompanionPetProps = {
  mood: PetMood;
  size?: "desktop" | "mobile";
};

export function CompanionPet({ mood, size = "desktop" }: CompanionPetProps) {
  return (
    <div
      className={`companion-pet companion-pet--${mood} companion-pet--${size}`}
      aria-label="Mochi, la compañera"
      role="img"
    >
      <div className="companion-pet-stage" aria-hidden>
        <svg viewBox="0 0 220 240" className="companion-pet-svg" fill="none">
          <ellipse className="pet-shadow" cx="110" cy="218" rx="58" ry="10" />
          <g className="pet-body-group">
            <path className="pet-ear pet-ear-left" d="M62 78 C48 22 86 18 94 72" />
            <path className="pet-ear-inner pet-ear-left" d="M68 74 C60 36 82 34 88 72" />
            <path className="pet-ear pet-ear-right" d="M158 78 C172 22 134 18 126 72" />
            <path className="pet-ear-inner pet-ear-right" d="M152 74 C160 36 138 34 132 72" />
            <ellipse className="pet-body" cx="110" cy="132" rx="78" ry="70" />
            <ellipse className="pet-belly" cx="110" cy="150" rx="46" ry="36" />
            <ellipse className="pet-blush pet-blush-left" cx="62" cy="138" rx="12" ry="7" />
            <ellipse className="pet-blush pet-blush-right" cx="158" cy="138" rx="12" ry="7" />
            <g className="pet-eyes">
              <ellipse className="pet-eye" cx="84" cy="124" rx="9" ry="11" />
              <ellipse className="pet-eye" cx="136" cy="124" rx="9" ry="11" />
              <circle className="pet-spark" cx="81" cy="120" r="2.4" />
              <circle className="pet-spark" cx="133" cy="120" r="2.4" />
              <rect className="pet-lid pet-lid-left" x="74" y="112" width="20" height="14" rx="7" />
              <rect className="pet-lid pet-lid-right" x="126" y="112" width="20" height="14" rx="7" />
            </g>
            <path className="pet-nose" d="M110 136 C107 136 105 138 110 141 C115 138 113 136 110 136Z" />
            <path className="pet-mouth" d="M102 146 Q110 152 118 146" />
            <ellipse className="pet-paw" cx="58" cy="178" rx="16" ry="11" />
            <ellipse className="pet-paw" cx="162" cy="178" rx="16" ry="11" />
            <ellipse className="pet-tail" cx="186" cy="158" rx="16" ry="12" />
          </g>
        </svg>
      </div>
      {mood === "sleepy" ? <span className="pet-zzz">zzz</span> : null}
      {mood === "delivering" ? <span className="pet-note">✉</span> : null}
      {mood === "thinking" ? (
        <span className="pet-think-dots" aria-hidden>
          <i />
          <i />
          <i />
        </span>
      ) : null}
    </div>
  );
}
