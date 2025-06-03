import React from "react";
import { Search } from "lucide-react";
import LogoutButton from "./LogoutButton";

interface Props {
  searchQuery?: string;
  onSearchChange: (v: string) => void;
  inCall?: boolean;
  endCall?: () => Promise<void>;
}

const HeaderBar: React.FC<Props> = ({
  searchQuery,
  onSearchChange,
  inCall = false,
  endCall,
}) => {
  return (
    <header
      className="
        w-full flex items-center justify-between
        px-10 py-3
        bg-darkblue/80
        backdrop-blur-md
        shadow-2xl
        rounded-3xl
        mt-0 mb-8
        sticky top-0 z-30
      "
      style={{ minHeight: 70 }}
    >
      <div className="flex-1 flex items-center">
        <div className="relative w-[350px]">
          <span className="absolute inset-y-0 left-3 flex items-center text-gray-400">
            <Search size={20} />
          </span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-midnight text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-blue shadow-inner"
            placeholder="Caută utilizator..."
          />
        </div>
      </div>
      <div>
        <LogoutButton inCall={inCall} endCall={endCall} />
      </div>
    </header>
  );
};

export default HeaderBar;
