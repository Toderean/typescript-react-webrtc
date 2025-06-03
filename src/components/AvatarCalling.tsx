import React from "react";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  username: string;
  avatarUrl?: string;
}

const waves = [0, 1, 2];

const CallingAvatar: React.FC<Props> = ({ username, avatarUrl }) => (
  <div className="relative w-36 h-36 flex items-center justify-center">
    <AnimatePresence>
      {waves.map((i) => (
        <motion.div
          key={i}
          className="absolute rounded-full border-4 border-primary-blue"
          style={{
            width: "100%",
            height: "100%",
            left: 0,
            top: 0,
            zIndex: 1,
            borderColor: "#299fff",
          }}
          initial={{ scale: 0.8, opacity: 0.8 }}
          animate={{ scale: 1.8, opacity: 0 }}
          exit={{ opacity: 0 }}
          transition={{
            repeat: Infinity,
            duration: 1.4,
            delay: i * 0.45,
          }}
        />
      ))}
    </AnimatePresence>
    <div className="relative z-10 w-24 h-24 rounded-full bg-accent-blue flex items-center justify-center text-white text-3xl font-bold border-4 border-primary-blue shadow-lg">
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={username}
          className="w-full h-full rounded-full object-cover"
        />
      ) : (
        username.slice(0, 2).toUpperCase()
      )}
    </div>
  </div>
);

export default CallingAvatar;
