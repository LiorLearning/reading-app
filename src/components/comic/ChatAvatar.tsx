import React from "react";

interface ChatAvatarProps {
  name?: string;
  avatar?: string;
  className?: string;
  size?: 'small' | 'medium' | 'large' | 'responsive';
}

const ChatAvatar: React.FC<ChatAvatarProps> = ({ 
  name = "", 
  avatar = "/avatars/krafty.png",
  className = "",
  size = "responsive"
}) => {
  const getSizeClasses = () => {
    switch (size) {
      case 'small':
        return 'w-20 h-20';
      case 'medium':
        return 'w-32 h-32';
      case 'large':
        return 'w-48 h-48';
      case 'responsive':
        return 'w-full h-full max-w-48 max-h-48 min-w-16 min-h-16';
      default:
        return 'w-32 h-32';
    }
  };

  // Check if the avatar is a video file
  const isVideo = avatar?.includes('.mp4') || avatar?.includes('.webm') || avatar?.includes('.mov');

  return (
    <div className={`flex flex-col items-center justify-center gap-2 p-4 bg-transparent h-full ${className}`}>
      {/* Avatar Image or Video */}
      <div className={`flex items-center justify-center hover:scale-105 transition-all duration-200 ${getSizeClasses()}`}>
        {isVideo ? (
          <video 
            src={avatar} 
            autoPlay 
            loop 
            muted 
            playsInline
            className="w-full h-full object-contain rounded-lg"
          />
        ) : (
          <img 
            src={avatar} 
            alt={name} 
            className="w-full h-full object-contain rounded-lg"
          />
        )}
      </div>
      
      {/* Pet name label */}
      <div className="text-center">
        {/* <p className="text-sm font-medium text-white/90 bg-black/20 px-2 py-1 rounded-full backdrop-blur-sm">
          {name}
        </p> */}
      </div>
    </div>
  );
};

export default ChatAvatar;
