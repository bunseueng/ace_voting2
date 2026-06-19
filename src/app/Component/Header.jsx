import React from "react";

const Header = ({ src = "/banner.jfif" }) => {
  return (
    <div className="w-full h-full">
      <img
        src={src}
        alt="Poster"
        className="w-full h-auto object-cover bg-center"
      />
    </div>
  );
};

export default Header;
