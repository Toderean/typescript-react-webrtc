import React from "react";

type Props = {
  onClick: () => void;
  unreadCount: number;
};

export default function FloatingChatButton({ onClick, unreadCount }: Props) {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-4 right-4 bg-blue-600 text-white px-4 py-2 rounded-full shadow-lg z-40 flex items-center gap-2"
    >
      Chat
      {unreadCount > 0 && (
        <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full animate-pulse">
          {unreadCount}
        </span>
      )}
    </button>
  );
}
