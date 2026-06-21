import React from "react";

const Header = ({ src = "/banner.jfif" }) => {
  return (
    <div className="w-full overflow-hidden">
      <img
        src={src}
        alt="Event banner"
        className="w-full h-[170px] sm:h-[240px] md:h-[320px] lg:h-[400px] object-cover object-center"
      />
    </div>
  );
};

export default Header;
