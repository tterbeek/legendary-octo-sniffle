import { motion } from 'framer-motion';
import React, { useEffect, useRef } from 'react';

/**
 * CartHeader Component
 * --------------------
 * Displays the GrocLi logo (cart) driving in and pushing the list title into place.
 *
 * Props:
 * - title: string – The list name or title to display.
 */
export default function CartHeader({ title = 'Shopping List' }) {
  const titleRef = useRef(null);

  useEffect(() => {
    const el = titleRef.current;
    if (el) {
      // reset the title position when mounted
      el.style.transform = 'translateX(-10px)';
    }
  }, []);

  return (
    <div className="flex items-center justify-center gap-2 mb-4 mt-2 overflow-hidden">
      {/* Cart drives in from the left */}
      <motion.img
        src="/groclilogorectangle.png"
        alt="GrocLi Logo"
        className="h-9 w-auto drop-shadow-sm"
        initial={{ x: -100, opacity: 0, rotate: -10 }}
        animate={{ x: 0, opacity: 1, rotate: [-10, 0, -3, 0] }}
        transition={{
          duration: 1,
          ease: [0.42, 0, 0.58, 1],
        }}
        onAnimationComplete={() => {
          const el = titleRef.current;
          if (el) {
            el.animate(
              [
                { transform: 'translateX(-10px)' }, // waiting
                { transform: 'translateX(0px)' },   // pushed into place
              ],
              {
                duration: 400,
                easing: 'ease-out',
                fill: 'forwards',
              }
            );
          }
        }}
      />

      {/* Title starts slightly left, gets pushed by the cart */}
      <h1
        ref={titleRef}
        id="listTitle"
        className="text-xl sm:text-2xl font-bold text-gray-800 select-none"
      >
        {title}
      </h1>
    </div>
  );
}
