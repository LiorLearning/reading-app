import React from "react";

interface ChatAvatarProps {
  name?: string;
  avatar?: string;
  className?: string;
}

const ChatAvatar: React.FC<ChatAvatarProps> = ({ 
  name = "Krafty", 
  avatar = "/avatars/krafty.png",
  className = "" 
}) => {
  return (
    <div className={`flex flex-col items-center py-6 bg-transparent ${className}`}>
      {/* Avatar Circle */}
      <div className="w-28 h-28 rounded-full bg-gradient-to-br from-orange-300 via-orange-400 to-orange-500 flex items-center justify-center shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 overflow-hidden">
        <img 
          src={avatar} 
          alt={name} 
          className="w-full h-full object-cover scale-110"
        />
      </div>
    </div>
  );
};

export default ChatAvatar;
