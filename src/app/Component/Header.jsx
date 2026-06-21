import React from "react";

const Header = ({ src = "/banner.jfif" }) => {
  return (
    <div className="w-full">
      <img
        src={src}
        alt="Event banner"
        className="w-full h-auto block"
      />
    </div>
  );
};

export default Header;
