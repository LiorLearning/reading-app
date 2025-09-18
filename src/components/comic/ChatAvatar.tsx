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

    <div className={`flex flex-col items-center gap-4 py-6 bg-transparent ${className}`}>
      {/* Avatar Image */}
      <div className="w-32 h-32 flex items-center justify-center hover:scale-105 transition-all duration-200">
        <img 
          src={avatar} 
          alt={name} 
          className="w-full h-full object-contain rounded-lg"
        />
      </div>

    </div>
  );
};

export default ChatAvatar;
