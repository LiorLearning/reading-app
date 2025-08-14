import React from "react";

interface ComicHeaderProps {}

const ComicHeader: React.FC<ComicHeaderProps> = () => {
  return (
    <header className="mb-2 flex items-center justify-center">
      <div className="flex items-center gap-4">
        {/* Header can be used for app branding or title if needed in the future */}
      </div>
    </header>
  );
};

export default ComicHeader;
