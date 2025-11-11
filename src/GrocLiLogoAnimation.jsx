import { motion } from 'framer-motion';
import React from 'react';

export default function GrocLiLogoAnimation({ onFinish }) {
  const screenWidth = typeof window !== 'undefined' ? window.innerWidth : 1000;

  return (
    <div className="relative flex items-center justify-center h-screen bg-[#f9f9f7] overflow-hidden">
      {/* Soft, subtle shadow that appears as it speeds up */}
      <motion.div
        className="absolute bottom-[45%] rounded-full blur-sm"
        style={{
          width: '7rem',
          height: '0.5rem',
          backgroundColor: 'rgba(87, 128, 128, 0.25)',
        }}
        initial={{ opacity: 0, scaleX: 0.6, x: 0 }}
        animate={{
          opacity: [0, 0.15, 0.25, 0],
          scaleX: [0.6, 0.8, 1.4, 2],
          x: [0, -20, screenWidth + 400],
        }}
        transition={{
          duration: 3.5,
          ease: [0.42, 0, 0.58, 1], // smooth ease-in-out acceleration curve
          times: [0, 0.25, 0.6, 1],
        }}
      />

      {/* GrocLi logo itself */}
      <motion.img
        src="/GrocLiLogo.png"
        alt="GrocLi Logo"
        className="w-56 h-56"
        initial={{ opacity: 0, scale: 0.9, x: 0 }}
        animate={{
          opacity: [0, 1, 1, 0],
          x: [0, -60, screenWidth + 300],
          rotate: [0, -5, 10], // slight tilt when moving
          scale: [0.9, 1, 1, 1.05], // small growth during motion
        }}
        transition={{
          duration: 3.5,
          ease: [0.42, 0, 0.58, 1],
          times: [0, 0.25, 0.6, 1], // left = decelerate, right = accelerate
        }}
        onAnimationComplete={() => {
          if (onFinish) onFinish();
        }}
      />
    </div>
  );
}
