"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import crossImage from "@/assets/cross.png";
import ottersImage from "@/assets/otters.png";

interface ScrollRotatingLogoProps {
  size?: "sm" | "md" | "lg" | "xl" | "xxl" | "xxxl";
  className?: string;
}

export default function ScrollRotatingLogo({ size = "md", className = "" }: ScrollRotatingLogoProps) {
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      // 0.5 degrees per pixel of scroll
      setRotation(window.scrollY * 0.5);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-12 h-12", 
    lg: "w-16 h-16",
    xl: "w-32 h-32 md:w-40 md:h-40",
    xxl: "w-48 h-48 md:w-56 md:h-56",
    xxxl: "w-64 h-64 md:w-72 md:h-72"
  };

  const crossSize = {
    sm: 24,
    md: 32,
    lg: 48,
    xl: 96,
    xxl: 120,
    xxxl: 160
  };

  return (
    <div className={`relative ${sizeClasses[size]} ${className}`}>
      {/* STATIC LAYER: Medical Cross */}
      <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
        <Image
          src={crossImage}
          alt="Medical cross"
          width={crossSize[size]}
          height={crossSize[size]}
          className="object-contain"
          style={{ width: "55%", height: "55%" }}
        />
      </div>
      {/* DYNAMIC LAYER: Otters Ring */}
      <div
        className="absolute inset-0 pointer-events-none logo-rotate"
        style={{
          transform: `rotate(${rotation}deg)`,
        }}
      >
        <Image
          src={ottersImage}
          fill
          alt="Otters"
          className="object-contain"
        />
      </div>
    </div>
  );
}
