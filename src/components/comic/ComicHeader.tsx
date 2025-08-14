import React from "react";

interface ComicHeaderProps {}
  
const ComicHeader: React.FC<ComicHeaderProps> = () => {
  return (
    <header className="mb-2">
      {/* Header can be used for app branding or title if needed in the future */}
    </header>
  );
};

export default ComicHeader;
