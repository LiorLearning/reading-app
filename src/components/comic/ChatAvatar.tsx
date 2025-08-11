import React from "react";

interface ChatAvatarProps {
  name?: string;
  avatar?: string;
  className?: string;
}

const ChatAvatar: React.FC<ChatAvatarProps> = ({ 
  name = "Krafty", 
  avatar = "👨‍🚀",
  className = "" 
}) => {
  return (
    <div className={`flex flex-col items-center gap-4 py-6 ${className}`}>
      {/* Avatar Circle */}
      <div className="w-28 h-28 rounded-full border-4 border-foreground bg-gradient-to-br from-orange-300 via-orange-400 to-orange-500 flex items-center justify-center text-5xl shadow-solid hover:shadow-none hover:translate-y-1 transition-all duration-200">
        {avatar}
      </div>
      
      {/* Avatar Name & Description */}
      <div className="text-center">
        <h3 className="font-bold text-xl text-foreground">{name}</h3>
        <p className="text-sm text-muted-foreground font-medium">Your Adventure Guide</p>
      </div>
    </div>
  );
};

export default ChatAvatar;
